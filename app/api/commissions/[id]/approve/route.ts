import { type NextRequest, NextResponse } from "next/server";
import { approveCommission } from "@/lib/commission-database-service";
import { getCurrentUser } from "@/lib/auth-utils";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get commission details before approval
    const commissionResult = await sql`
      SELECT * FROM commissions WHERE id = ${id}
    `;

    if (commissionResult.length === 0) {
      return NextResponse.json(
        { error: "Commission not found" },
        { status: 404 }
      );
    }

    const commissionData = commissionResult[0];

    if (commissionData.status !== "pending") {
      return NextResponse.json(
        { error: "Commission is not in pending status" },
        { status: 400 }
      );
    }

    // Approve the commission
    const commission = await approveCommission(
      id,
      user.id,
      user.name || user.username,
      body.notes || ""
    );

    if (!commission) {
      return NextResponse.json(
        { error: "Commission not found or not in pending status" },
        { status: 404 }
      );
    }

    // Create GL entries to clear Accounts Receivable and credit float account
    try {
      // Get Accounts Receivable GL account
      const arAccountResult = await sql`
        SELECT id, code, name FROM gl_accounts 
        WHERE code IN ('1200', '1201') 
        AND type = 'Asset'
        ORDER BY code ASC
        LIMIT 1
      `;

      if (arAccountResult.length > 0) {
        const arAccount = arAccountResult[0];
        const commissionAmount = Number(commissionData.amount);

        // Get float account GL mapping
        let floatGLAccount;
        const floatAccountResult = await sql`
          SELECT id, account_type, provider FROM float_accounts WHERE id = ${commissionData.source}
        `;

        if (floatAccountResult.length > 0) {
          const floatAccount = floatAccountResult[0];

          // Get GL mapping for this float account
          const mappingResult = await sql`
            SELECT gl_account_id, ga.code, ga.name
            FROM gl_mappings gm
            JOIN gl_accounts ga ON gm.gl_account_id = ga.id
            WHERE (gm.float_account_id = ${
              commissionData.source
            } OR gm.transaction_type = ${floatAccount.account_type + "_float"})
            AND gm.mapping_type = 'asset'
            AND gm.is_active = true
            ORDER BY gm.float_account_id DESC NULLS LAST
            LIMIT 1
          `;

          if (mappingResult.length > 0) {
            floatGLAccount = {
              id: mappingResult[0].gl_account_id,
              code: mappingResult[0].code,
              name: mappingResult[0].name,
            };
          }
        }

        // If no specific float account mapping, default to Cash in Till
        if (!floatGLAccount) {
          const cashResult = await sql`
            SELECT id, code, name FROM gl_accounts 
            WHERE code IN ('1001', '1100')
            AND type = 'Asset'
            ORDER BY code ASC
            LIMIT 1
          `;

          if (cashResult.length > 0) {
            floatGLAccount = cashResult[0];
          }
        }

        if (floatGLAccount) {
          // Create GL transaction for commission receipt
          const glTransactionId = await sql`SELECT gen_random_uuid() as id`;
          const glId = glTransactionId[0].id;

          await sql`
            INSERT INTO gl_transactions (
              id, date, source_module, source_transaction_id, source_transaction_type,
              description, status, created_by, branch_id, metadata
            ) VALUES (
              ${glId},
              CURRENT_DATE,
              'commissions',
              ${id},
              'commission_received',
              ${
                "Commission Received: " +
                (commissionData.description || commissionData.source_name)
              },
              'posted',
              ${user.id},
              ${commissionData.branch_id},
              ${JSON.stringify({
                source: commissionData.source,
                sourceName: commissionData.source_name,
                reference: commissionData.reference,
              })}
            )
          `;

          // Create journal entries: Debit Float Account, Credit Accounts Receivable
          await sql`
            INSERT INTO gl_journal_entries (
              id, transaction_id, account_id, account_code, debit, credit, description
            ) VALUES 
            (gen_random_uuid(), ${glId}, ${floatGLAccount.id}, ${floatGLAccount.code}, ${commissionAmount}, 0, 'Commission received'),
            (gen_random_uuid(), ${glId}, ${arAccount.id}, ${arAccount.code}, 0, ${commissionAmount}, 'Accounts Receivable cleared')
          `;

          console.log(
            "Created GL entries for commission approval - Debit: " +
              floatGLAccount.name +
              ", Credit: " +
              arAccount.name
          );
        }
      }
    } catch (glError) {
      console.error(
        "Failed to create GL entries for commission approval:",
        glError
      );
      // Don't fail the approval if GL posting fails
    }

    return NextResponse.json({
      success: true,
      message:
        "Commission approved successfully and Accounts Receivable cleared",
      commission,
    });
  } catch (error) {
    console.error("Error approving commission:", error);
    return NextResponse.json(
      { error: "Failed to approve commission" },
      { status: 500 }
    );
  }
}
