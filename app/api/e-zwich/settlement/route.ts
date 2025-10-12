import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Get E-Zwich settlement accounts (partner accounts)
    // Check if isezwichpartner column exists
    let hasIsezwichpartner = false;
    try {
      const columnCheck = await sql`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'float_accounts' 
          AND column_name = 'isezwichpartner'
        ) as exists
      `;
      hasIsezwichpartner = columnCheck[0]?.exists || false;
    } catch (error) {
      console.warn(
        "Could not check isezwichpartner column, using account_type filter:",
        error
      );
      hasIsezwichpartner = false;
    }

    const settlementAccounts = await sql`
      SELECT 
        id,
        account_name,
        current_balance,
        account_type,
        provider,
        is_active,
        created_at,
        updated_at
      FROM float_accounts 
      WHERE branch_id = ${branchId}
        AND is_active = true
        AND ${
          hasIsezwichpartner
            ? sql`(isezwichpartner = true OR account_type = 'e-zwich')`
            : sql`account_type = 'e-zwich'`
        }
      ORDER BY account_name ASC
    `;

    // Get settlement statistics
    const settlementStats = await sql`
      SELECT 
        COALESCE(SUM(current_balance), 0) as total_balance,
        COUNT(*) as total_accounts
      FROM float_accounts 
      WHERE branch_id = ${branchId}
        AND is_active = true
        AND ${
          hasIsezwichpartner
            ? sql`(isezwichpartner = true OR account_type = 'e-zwich')`
            : sql`account_type = 'e-zwich'`
        }
    `;

    return NextResponse.json({
      success: true,
      data: {
        accounts: settlementAccounts,
        statistics: {
          totalBalance: Number(settlementStats[0]?.total_balance || 0),
          totalAccounts: Number(settlementStats[0]?.total_accounts || 0),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching E-Zwich settlement data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch settlement data",
        data: {
          accounts: [],
          statistics: {
            totalBalance: 0,
            totalAccounts: 0,
          },
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      settlement_account_id,
      partner_account_id,
      notes,
      reference,
      branch_id,
      processed_by,
    } = body;

    // Get current user
    const user = getCurrentUser(request);

    if (!amount || !settlement_account_id || !partner_account_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if isezwichpartner column exists
    let hasIsezwichpartner = false;
    try {
      const columnCheck = await sql`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'float_accounts' 
          AND column_name = 'isezwichpartner'
        ) as exists
      `;
      hasIsezwichpartner = columnCheck[0]?.exists || false;
    } catch (error) {
      console.warn(
        "Could not check isezwichpartner column, using account_type filter:",
        error
      );
      hasIsezwichpartner = false;
    }

    // Validate settlement account exists and is E-Zwich partner
    const settlementAccount = await sql`
      SELECT * FROM float_accounts 
      WHERE id = ${settlement_account_id}
        AND is_active = true
        AND ${
          hasIsezwichpartner
            ? sql`(isezwichpartner = true OR account_type = 'e-zwich')`
            : sql`account_type = 'e-zwich'`
        }
    `;

    if (settlementAccount.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid settlement account" },
        { status: 400 }
      );
    }

    // Validate partner account exists
    const partnerAccount = await sql`
      SELECT * FROM float_accounts 
      WHERE id = ${partner_account_id}
        AND is_active = true
    `;

    if (partnerAccount.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid partner account" },
        { status: 400 }
      );
    }

    const settlementBalance = Number(settlementAccount[0].current_balance) || 0;
    const partnerBalance = Number(partnerAccount[0].current_balance) || 0;
    const transferAmount = Number(amount);

    if (settlementBalance < transferAmount) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance in settlement account" },
        { status: 400 }
      );
    }

    // Process the settlement transfer
    await sql`
      UPDATE float_accounts 
      SET current_balance = current_balance - ${transferAmount}, updated_at = NOW()
      WHERE id = ${settlement_account_id}
    `;

    await sql`
      UPDATE float_accounts 
      SET current_balance = current_balance + ${transferAmount}, updated_at = NOW()
      WHERE id = ${partner_account_id}
    `;

    // Create GL entries for the settlement transfer
    try {
      const glTransactionId = await sql`SELECT gen_random_uuid() as id`;
      const glId = glTransactionId[0].id;

      // Get GL mappings for settlement transfer
      const mappings = await sql`
        SELECT mapping_type, gl_account_id
        FROM gl_mappings
        WHERE transaction_type = 'settlement_transfer'
          AND branch_id = ${branch_id || user.branchId}
          AND is_active = true
      `;

      if (mappings.length > 0) {
        // Get account codes and names
        const accountIds = mappings.map((m: any) => m.gl_account_id);
        const accounts = await sql`
          SELECT id, code, name FROM gl_accounts 
          WHERE id = ANY(${accountIds})
        `;

        // Build accounts mapping
        const accountsMap: Record<string, any> = {};
        for (const mapping of mappings) {
          const account = accounts.find(
            (a: any) => a.id === mapping.gl_account_id
          );
          if (mapping.mapping_type === "settlement") {
            accountsMap.settlement = mapping.gl_account_id;
            accountsMap.settlementCode = account?.code || "1000";
          } else if (mapping.mapping_type === "partner") {
            accountsMap.partner = mapping.gl_account_id;
            accountsMap.partnerCode = account?.code || "1000";
          }
        }

        if (accountsMap.settlement && accountsMap.partner) {
          // Create GL transaction record
          await sql`
            INSERT INTO gl_transactions (id, date, source_module, source_transaction_id, source_transaction_type, description, status, created_by, metadata)
            VALUES (${glId}, CURRENT_DATE, 'e_zwich', ${glId}, 'settlement_transfer', 'E-Zwich settlement transfer', 'posted', ${
            user.username || user.name || processed_by
          }, ${JSON.stringify({
            settlementAccountId: settlement_account_id,
            partnerAccountId: partner_account_id,
            amount: transferAmount,
            reference,
            notes,
          })})
          `;

          // Create journal entries
          await sql`
            INSERT INTO gl_journal_entries (id, transaction_id, account_id, account_code, debit, credit, description, metadata)
            VALUES (gen_random_uuid(), ${glId}, ${accountsMap.settlement}, ${
            accountsMap.settlementCode
          }, ${transferAmount}, 0, 'Settlement account debit', ${JSON.stringify(
            {
              settlementAccountId: settlement_account_id,
              partnerAccountId: partner_account_id,
            }
          )})
          `;

          await sql`
            INSERT INTO gl_journal_entries (id, transaction_id, account_id, account_code, debit, credit, description, metadata)
            VALUES (gen_random_uuid(), ${glId}, ${accountsMap.partner}, ${
            accountsMap.partnerCode
          }, 0, ${transferAmount}, 'Partner account credit', ${JSON.stringify({
            settlementAccountId: settlement_account_id,
            partnerAccountId: partner_account_id,
          })})
          `;

          console.log(
            "🔷 [GL] Settlement transfer GL entries created successfully"
          );
        }
      }
    } catch (glError) {
      console.error(
        "🔷 [GL] Failed to create settlement transfer GL entries:",
        glError
      );
      // Don't fail the settlement if GL posting fails
    }

    // Log the settlement operation
    await sql`
      INSERT INTO audit_logs (
        user_id, username, action_type, entity_type, entity_id, 
        description, details, severity, branch_id, status
      ) VALUES (
        ${user.id}, ${
      user.username || user.name || processed_by
    }, 'settlement_transfer', 
        'float_account', ${settlement_account_id}, 
        ${`E-Zwich settlement transfer of ${transferAmount} GHS`}, 
        ${JSON.stringify({
          settlementAccountId: settlement_account_id,
          settlementAccountName: settlementAccount[0].account_name,
          partnerAccountId: partner_account_id,
          partnerAccountName: partnerAccount[0].account_name,
          amount: transferAmount,
          notes,
          reference,
          previousSettlementBalance: settlementBalance,
          newSettlementBalance: settlementBalance - transferAmount,
          previousPartnerBalance: partnerBalance,
          newPartnerBalance: partnerBalance + transferAmount,
        })}, 
        'medium', ${branch_id || user.branchId}, 'success'
      )
    `;

    return NextResponse.json({
      success: true,
      message: `Settlement transfer successful`,
      data: {
        settlementAccountId: settlement_account_id,
        partnerAccountId: partner_account_id,
        amount: transferAmount,
        previousSettlementBalance: settlementBalance,
        newSettlementBalance: settlementBalance - transferAmount,
        previousPartnerBalance: partnerBalance,
        newPartnerBalance: partnerBalance + transferAmount,
      },
    });
  } catch (error) {
    console.error("Error processing E-Zwich settlement:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process settlement",
      },
      { status: 500 }
    );
  }
}
