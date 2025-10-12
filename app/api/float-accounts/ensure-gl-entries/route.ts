import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getDatabaseSession } from "@/lib/database-session-service"; // Fixed import
import { FloatAccountGLService } from "@/lib/services/float-account-gl-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getDatabaseSession(); // Fixed function call
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admins to run this operation
    if (session.user.role?.toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    console.log(
      "🔷 [ENSURE-GL-ENTRIES] Starting GL entries verification for all float accounts..."
    );

    // Get all float accounts
    const floatAccounts = await sql`
      SELECT 
        fa.id,
        fa.current_balance,
        fa.account_type,
        fa.provider,
        fa.branch_id,
        fa.created_at
      FROM float_accounts fa
      WHERE fa.is_active = true
      ORDER BY fa.created_at ASC
    `;

    console.log(
      `🔷 [ENSURE-GL-ENTRIES] Found ${floatAccounts.length} float accounts to check`
    );

    const results = {
      totalAccounts: floatAccounts.length,
      processedAccounts: 0,
      createdEntries: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const account of floatAccounts) {
      try {
        console.log(
          `🔍 [ENSURE-GL-ENTRIES] Processing account: ${account.id} (${account.account_type})`
        );

        // Check if GL entries exist for this account
        const existingEntries = await sql`
          SELECT COUNT(*) as count
          FROM gl_transactions
          WHERE source_module = 'float_operations'
          AND source_transaction_id = ${account.id}
        `;

        const hasGLEntries = Number(existingEntries[0]?.count || 0) > 0;

        if (hasGLEntries) {
          console.log(
            `ℹ️ [ENSURE-GL-ENTRIES] Account ${account.id} already has GL entries`
          );
          results.details.push({
            accountId: account.id,
            accountType: account.account_type,
            provider: account.provider,
            currentBalance: account.current_balance,
            status: "already_has_entries",
            glEntriesCount: existingEntries[0]?.count,
          });
        } else {
          console.log(
            `⚠️ [ENSURE-GL-ENTRIES] Account ${account.id} has no GL entries - creating initial balance entry`
          );

          // Create GL entries for initial balance
          const glResult =
            await FloatAccountGLService.createInitialBalanceGLEntries(
              account.id,
              Number(account.current_balance),
              session.user.id,
              account.branch_id
            );

          if (glResult.success) {
            console.log(
              `✅ [ENSURE-GL-ENTRIES] Created GL entries for account ${account.id}`
            );
            results.createdEntries++;
            results.details.push({
              accountId: account.id,
              accountType: account.account_type,
              provider: account.provider,
              currentBalance: account.current_balance,
              status: "created_entries",
              glResult: glResult,
            });
          } else {
            console.error(
              `❌ [ENSURE-GL-ENTRIES] Failed to create GL entries for account ${account.id}:`,
              glResult.error
            );
            results.errors.push(
              `Failed to create GL entries for account ${account.id}: ${glResult.error}`
            );
            results.details.push({
              accountId: account.id,
              accountType: account.account_type,
              provider: account.provider,
              currentBalance: account.current_balance,
              status: "failed",
              error: glResult.error,
            });
          }
        }

        results.processedAccounts++;
      } catch (error) {
        console.error(
          `❌ [ENSURE-GL-ENTRIES] Error processing account ${account.id}:`,
          error
        );
        results.errors.push(
          `Error processing account ${account.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        results.details.push({
          accountId: account.id,
          accountType: account.account_type,
          provider: account.provider,
          currentBalance: account.current_balance,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(`✅ [ENSURE-GL-ENTRIES] Completed GL entries verification:`, {
      totalAccounts: results.totalAccounts,
      processedAccounts: results.processedAccounts,
      createdEntries: results.createdEntries,
      errors: results.errors.length,
    });

    return NextResponse.json({
      success: true,
      message: "GL entries verification completed",
      results,
    });
  } catch (error) {
    console.error("❌ [ENSURE-GL-ENTRIES] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to ensure GL entries",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admins to view this information
    if (session.user.role?.toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (accountId) {
      // Get GL entries status for a specific account
      const account = await sql`
        SELECT 
          fa.id,
          fa.current_balance,
          fa.account_type,
          fa.provider,
          fa.branch_id
        FROM float_accounts fa
        WHERE fa.id = ${accountId}
        AND fa.is_active = true
      `;

      if (account.length === 0) {
        return NextResponse.json(
          { error: "Float account not found" },
          { status: 404 }
        );
      }

      const floatAccount = account[0];

      // Check GL entries
      const glEntries = await sql`
        SELECT 
          glt.id,
          glt.source_transaction_type,
          glt.amount,
          glt.reference,
          glt.date,
          COUNT(glje.id) as entry_count
        FROM gl_transactions glt
        LEFT JOIN gl_journal_entries glje ON glt.id = glje.transaction_id
        WHERE glt.source_module = 'float_operations'
        AND glt.source_transaction_id = ${accountId}
        GROUP BY glt.id, glt.source_transaction_type, glt.amount, glt.reference, glt.date
        ORDER BY glt.date DESC
      `;

      // Get GL balance
      const glBalance = await FloatAccountGLService.getFloatAccountGLBalance(
        accountId
      );

      // Reconcile balances
      const reconciliation =
        await FloatAccountGLService.reconcileFloatAccountBalance(accountId);

      return NextResponse.json({
        success: true,
        account: {
          id: floatAccount.id,
          accountType: floatAccount.account_type,
          provider: floatAccount.provider,
          currentBalance: Number(floatAccount.current_balance),
          branchId: floatAccount.branch_id,
        },
        glEntries: glEntries,
        glBalance: glBalance,
        reconciliation: reconciliation,
        hasGLEntries: glEntries.length > 0,
      });
    } else {
      // Get summary for all accounts
      const accounts = await sql`
        SELECT 
          fa.id,
          fa.account_type,
          fa.provider,
          fa.current_balance,
          fa.branch_id
        FROM float_accounts fa
        WHERE fa.is_active = true
        ORDER BY fa.account_type, fa.provider
      `;

      const summary = {
        totalAccounts: accounts.length,
        accountsWithGLEntries: 0,
        accountsWithoutGLEntries: 0,
        accountTypes: {} as Record<
          string,
          { total: number; withGL: number; withoutGL: number }
        >,
      };

      for (const account of accounts) {
        const glEntries = await sql`
          SELECT COUNT(*) as count
          FROM gl_transactions
          WHERE source_module = 'float_operations'
          AND source_transaction_id = ${account.id}
        `;

        const hasGL = Number(glEntries[0]?.count || 0) > 0;

        if (hasGL) {
          summary.accountsWithGLEntries++;
        } else {
          summary.accountsWithoutGLEntries++;
        }

        const accountType = account.account_type;
        if (!summary.accountTypes[accountType]) {
          summary.accountTypes[accountType] = {
            total: 0,
            withGL: 0,
            withoutGL: 0,
          };
        }

        summary.accountTypes[accountType].total++;
        if (hasGL) {
          summary.accountTypes[accountType].withGL++;
        } else {
          summary.accountTypes[accountType].withoutGL++;
        }
      }

      return NextResponse.json({
        success: true,
        summary,
      });
    }
  } catch (error) {
    console.error("❌ [ENSURE-GL-ENTRIES] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get GL entries status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
