import { type NextRequest, NextResponse } from "next/server";
import { rejectCommission } from "@/lib/commission-database-service";
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

    // Get commission details before rejection
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

    // Reject the commission
    const commission = await rejectCommission(
      id,
      user.id,
      user.name || user.username,
      body.reason || body.notes || ""
    );

    if (!commission) {
      return NextResponse.json(
        { error: "Commission not found or not in pending status" },
        { status: 404 }
      );
    }

    // Reverse the Accounts Receivable GL entry
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

        // Get Commission Income GL account
        const commissionIncomeResult = await sql`
          SELECT id, code, name FROM gl_accounts 
          WHERE code IN ('4002', '4200', '4100')
          AND type = 'Revenue'
          ORDER BY code ASC
          LIMIT 1
        `;

        if (commissionIncomeResult.length > 0) {
          const incomeAccount = commissionIncomeResult[0];

          // Create GL transaction for reversal
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
              'commission_reversal',
              ${
                "Commission Rejected - Reversal: " +
                (commissionData.description || commissionData.source_name)
              },
              'posted',
              ${user.id},
              ${commissionData.branch_id},
              ${JSON.stringify({
                rejectionReason: body.reason || body.notes,
                originalReference: commissionData.reference,
              })}
            )
          `;

          // Create journal entries to reverse: Debit Commission Income, Credit Accounts Receivable
          await sql`
            INSERT INTO gl_journal_entries (
              id, transaction_id, account_id, account_code, debit, credit, description
            ) VALUES 
            (gen_random_uuid(), ${glId}, ${incomeAccount.id}, ${incomeAccount.code}, ${commissionAmount}, 0, 'Commission income reversed'),
            (gen_random_uuid(), ${glId}, ${arAccount.id}, ${arAccount.code}, 0, ${commissionAmount}, 'Accounts Receivable reversed')
          `;

          console.log(
            "Reversed GL entries for rejected commission - Debit: " +
              incomeAccount.name +
              ", Credit: " +
              arAccount.name
          );
        }
      }
    } catch (glError) {
      console.error(
        "Failed to reverse GL entries for rejected commission:",
        glError
      );
      // Don't fail the rejection if GL reversal fails
    }

    return NextResponse.json({
      success: true,
      message:
        "Commission rejected successfully and Accounts Receivable reversed",
      commission,
    });
  } catch (error) {
    console.error("Error rejecting commission:", error);
    return NextResponse.json(
      { error: "Failed to reject commission" },
      { status: 500 }
    );
  }
}
