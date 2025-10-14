import { neon } from "@neondatabase/serverless";
import { devLog } from "@/lib/dev-logger";

const sql = neon(process.env.DATABASE_URL!);

export interface FloatStatementEntry {
  id: string;
  date: string;
  type: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  source: string;
  processedBy: string;
}

export interface FloatStatementOptions {
  floatAccountId: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export class OptimizedFloatStatementService {
  /**
   * Generate optimized float statement with pagination
   */
  static async generateStatement(options: FloatStatementOptions): Promise<{
    success: boolean;
    data?: {
      entries: FloatStatementEntry[];
      summary: {
        openingBalance: number;
        closingBalance: number;
        totalDebits: number;
        totalCredits: number;
        transactionCount: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
      };
      account: any;
    };
    error?: string;
  }> {
    try {
      const {
        floatAccountId,
        startDate,
        endDate,
        page = 1,
        pageSize = 50,
      } = options;

      // Get float account details
      const accountResult = await sql`
        SELECT 
          fa.*,
          b.name as branch_name
        FROM float_accounts fa
        LEFT JOIN branches b ON fa.branch_id = b.id
        WHERE fa.id = ${floatAccountId}
      `;

      if (accountResult.length === 0) {
        return { success: false, error: "Float account not found" };
      }

      const account = accountResult[0];

      devLog.info(
        `Generating statement for ${account.account_type} - ${account.provider}`
      );

      // Step 1: Get GL account mappings for this float
      // Payment floats (MoMo, Cash): Include both specific AND generic transaction-type mappings
      // Service floats (Agency, Jumia, Power, E-Zwich): Include ONLY specific mappings

      const paymentFloats = ["cash-in-till", "momo"];
      const isPaymentFloat = paymentFloats.includes(account.account_type);

      let glMappings;

      if (isPaymentFloat) {
        // For payment floats: Include specific mappings + generic transaction-type mappings
        // ONLY show 'main' mapping type to avoid duplicate entries
        glMappings = await sql`
          SELECT 
            ga.id as gl_account_id,
            ga.code as gl_code,
            ga.name as gl_name
          FROM gl_mappings gm
          JOIN gl_accounts ga ON gm.gl_account_id = ga.id
          WHERE (
            gm.float_account_id = ${floatAccountId}
            OR (
              gm.transaction_type IN (
                ${account.account_type.replace(/-/g, "_") + "_float"},
                'withdrawal', 'deposit', 'cash-in', 'cash-out'
              )
              AND gm.branch_id = ${account.branch_id}
              AND gm.float_account_id IS NULL
            )
          )
          AND gm.is_active = true
          AND gm.mapping_type = 'main'
        `;
      } else {
        // For service floats: ONLY specific 'main' mappings
        glMappings = await sql`
          SELECT 
            ga.id as gl_account_id,
            ga.code as gl_code,
            ga.name as gl_name
          FROM gl_mappings gm
          JOIN gl_accounts ga ON gm.gl_account_id = ga.id
          WHERE gm.float_account_id = ${floatAccountId}
          AND gm.is_active = true
          AND gm.mapping_type = 'main'
        `;
      }

      if (glMappings.length === 0) {
        return {
          success: false,
          error: `No GL mappings found for ${account.account_type}. Please set up GL mappings first.`,
        };
      }

      const glAccountIds = glMappings.map((m: any) => m.gl_account_id);

      devLog.info(
        ` Using ${glMappings.length} GL Account(s):`,
        glMappings.map((m: any) => `${m.gl_code} - ${m.gl_name}`)
      );

      // Step 2: Fetch both GL entries AND float_transactions

      // Build date filters
      const glDateFilter =
        startDate && endDate
          ? sql`AND glt.date >= ${startDate}::date AND glt.date <= ${endDate}::date`
          : startDate
          ? sql`AND glt.date >= ${startDate}::date`
          : endDate
          ? sql`AND glt.date <= ${endDate}::date`
          : sql``;

      const floatDateFilter =
        startDate && endDate
          ? sql`AND ft.created_at::date >= ${startDate}::date AND ft.created_at::date <= ${endDate}::date`
          : startDate
          ? sql`AND ft.created_at::date >= ${startDate}::date`
          : endDate
          ? sql`AND ft.created_at::date <= ${endDate}::date`
          : sql``;

      // Determine which source modules to include based on account type
      let sourceModuleFilter = sql``;

      if (isPaymentFloat) {
        // Payment floats: Show ALL transactions (no filter)
        // This includes their own service transactions + being used as payment for other services
        devLog.info(
          `${account.account_type}: Showing ALL transactions affecting this account`
        );
        sourceModuleFilter = sql``;
      } else {
        // Service floats: Only show their own transactions
        const allowedModules = [
          account.account_type.replace(/-/g, "_"),
          "manual",
          "gl_sync",
        ];
        devLog.info(
          `${account.account_type}: Filtering to modules:`,
          allowedModules
        );
        sourceModuleFilter = sql`AND glt.source_module = ANY(${allowedModules})`;
      }

      // First, let's debug raw GL journal entries before aggregation
      const rawGLEntries = await sql`
        SELECT 
          glt.id as transaction_id,
          glt.reference,
          glt.source_transaction_type,
          glje.debit,
          glje.credit,
          glje.account_id
        FROM gl_transactions glt
        JOIN gl_journal_entries glje ON glt.id = glje.transaction_id
        WHERE glje.account_id = ANY(${glAccountIds})
        AND glt.status = 'posted'
        ${sourceModuleFilter}
        ${glDateFilter}
        ORDER BY glt.date DESC
        LIMIT 5
      `;

      console.log(
        "🔍 Raw GL journal entries (before aggregation):",
        rawGLEntries
      );

      // Fetch GL entries - show ACTUAL debit/credit for this account
      // Fix wrong entries: deposits should credit main account, withdrawals should debit
      const glEntries = await sql`
        SELECT 
          glt.id || '-' || glje.id as id,
          glt.date as transaction_date,
          glt.source_module,
          glt.source_transaction_type,
          glt.reference,
          glt.description,
          -- Fix reversed entries: deposit should be credit, withdrawal should be debit
          CASE 
            WHEN glt.source_transaction_type IN ('deposit', 'cash-in') AND glje.debit > 0 
            THEN 0  -- Wrong: deposit with debit, flip to credit
            WHEN glt.source_transaction_type IN ('withdrawal', 'cash-out') AND glje.credit > 0 
            THEN glje.credit  -- Wrong: withdrawal with credit, flip to debit
            ELSE glje.debit
          END as debit,
          CASE 
            WHEN glt.source_transaction_type IN ('deposit', 'cash-in') AND glje.debit > 0 
            THEN glje.debit  -- Wrong: deposit with debit, flip to credit
            WHEN glt.source_transaction_type IN ('withdrawal', 'cash-out') AND glje.credit > 0 
            THEN 0  -- Wrong: withdrawal with credit, flip to debit
            ELSE glje.credit
          END as credit,
          glt.created_by,
          u.first_name || ' ' || u.last_name as processed_by,
          'gl_entry' as entry_source,
          glt.created_at
        FROM gl_transactions glt
        JOIN gl_journal_entries glje ON glt.id = glje.transaction_id
        LEFT JOIN users u ON glt.created_by::uuid = u.id
        WHERE glje.account_id = ANY(${glAccountIds})
        AND glt.status = 'posted'
        AND (glje.debit > 0 OR glje.credit > 0)
        ${sourceModuleFilter}
        ${glDateFilter}
        ORDER BY glt.date DESC, glt.created_at DESC
      `;

      devLog.info(`Found ${glEntries.length} GL entries`);

      // Debug GL entries
      if (glEntries.length > 0) {
        console.log(
          "Sample GL entries:",
          glEntries.slice(0, 3).map((e) => ({
            ref: e.reference,
            type: e.source_transaction_type,
            debit: e.debit,
            credit: e.credit,
            date: e.transaction_date,
          }))
        );
      }

      // Debug: Check what's in float_transactions for this account
      console.log(
        `Checking float_transactions for account ${floatAccountId}...`
      );
      const debugCheck = await sql`
        SELECT COUNT(*) as total, 
               COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as with_account_id,
               COUNT(CASE WHEN float_account_id IS NOT NULL THEN 1 END) as with_float_account_id,
               COUNT(CASE WHEN COALESCE(status, 'completed') = 'completed' THEN 1 END) as with_completed_status
        FROM float_transactions 
        WHERE account_id = ${floatAccountId} OR float_account_id = ${floatAccountId}
      `;
      console.log(`Float transactions in DB:`, debugCheck[0]);

      // Fetch float_transactions (handle both column name variations)
      // EXCLUDE transactions that already have GL entries to avoid duplicates
      const floatTransactions = await sql`
        SELECT 
          ft.id,
          ft.created_at::date as transaction_date,
          COALESCE(ft.transaction_type, ft.type) as source_transaction_type,
          ft.reference as reference,
          ft.description,
          ft.amount,
          CASE 
            -- DEBIT: Money coming IN to the float (increases balance)
            WHEN COALESCE(ft.transaction_type, ft.type) = 'recharge' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'purchase' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'transfer_in' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'deposit' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'cash-in' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'pod_collection' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'commission_payment' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'adjustment' AND ft.amount > 0 THEN ft.amount
            ELSE 0
          END as debit,
          CASE 
            -- CREDIT: Money going OUT of the float (decreases balance)
            WHEN COALESCE(ft.transaction_type, ft.type) = 'sale' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'power_sale' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'withdrawal' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'cash-out' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'transfer_out' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'settlement' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'jumia_settlement' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'ezwich_settlement' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'e_zwich_settlement' THEN ft.amount
            WHEN COALESCE(ft.transaction_type, ft.type) = 'adjustment' AND ft.amount < 0 THEN ABS(ft.amount)
            ELSE 0
          END as credit,
          COALESCE(ft.processed_by::text, ft.created_by::text) as created_by,
          COALESCE(
            u.first_name || ' ' || u.last_name,
            'System'
          ) as processed_by,
          'float_transaction' as entry_source,
          ft.created_at
        FROM float_transactions ft
        LEFT JOIN users u ON COALESCE(ft.processed_by::text, ft.created_by::text) = u.id::text
        WHERE (ft.float_account_id = ${floatAccountId} OR ft.account_id = ${floatAccountId})
        AND COALESCE(ft.status, 'completed') = 'completed'
        AND NOT EXISTS (
          -- Exclude only if this transaction has GL entries that affect THIS float account
          -- This prevents duplicates while allowing transactions without GL entries
          SELECT 1 FROM gl_transactions glt
          JOIN gl_journal_entries glje ON glt.id = glje.transaction_id
          WHERE glt.reference = ft.reference
          AND glt.status = 'posted'
          AND glje.account_id = ANY(${glAccountIds})
        )
        ${floatDateFilter}
        ORDER BY ft.created_at DESC
      `;

      console.log(
        `Float transactions query returned: ${floatTransactions.length} rows`
      );
      if (floatTransactions.length > 0) {
        console.log(
          `Sample float_transactions:`,
          floatTransactions.slice(0, 5).map((ft) => ({
            ref: ft.reference,
            type: ft.source_transaction_type,
            debit: ft.debit,
            credit: ft.credit,
            amount: ft.amount,
          }))
        );
      }

      devLog.info(`Found ${floatTransactions.length} float transactions`);

      // Merge and sort all entries by date
      const allEntries = [...glEntries, ...floatTransactions].sort((a, b) => {
        const dateCompare =
          new Date(b.transaction_date).getTime() -
          new Date(a.transaction_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        // If dates are equal, sort by created_at
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      devLog.info(
        `Total merged entries: ${allEntries.length} (${glEntries.length} GL + ${floatTransactions.length} Float)`
      );

      // Debug: Show breakdown by transaction type
      const depositCount = allEntries.filter(
        (e) =>
          e.source_transaction_type === "deposit" ||
          e.source_transaction_type === "cash-in"
      ).length;
      const withdrawalCount = allEntries.filter(
        (e) =>
          e.source_transaction_type === "withdrawal" ||
          e.source_transaction_type === "cash-out"
      ).length;

      console.log(`📊 Transaction breakdown:`, {
        deposits: depositCount,
        withdrawals: withdrawalCount,
        fromGL: glEntries.length,
        fromFloatTransactions: floatTransactions.length,
      });

      // Apply pagination AFTER merging
      const totalCount = allEntries.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const offset = (page - 1) * pageSize;
      const paginatedEntries = allEntries.slice(offset, offset + pageSize);

      // Step 3: Determine account type for balance calculation
      // Assets increase with debits, decrease with credits
      // Liabilities increase with credits, decrease with debits
      const isAsset =
        account.account_type === "cash-in-till" ||
        account.account_type === "bank" ||
        account.account_type === "cash" ||
        account.account_type === "momo" || // MoMo is also an asset (cash equivalent)
        account.account_type === "agency-banking" || // Agency banking is an asset (money we hold)
        account.account_type === "power" || // Power float is inventory/asset
        account.account_type === "e-zwich"; // E-Zwich is an asset

      console.log(
        `Account type: ${account.account_type}, Classified as: ${
          isAsset ? "Asset" : "Liability"
        }`
      );

      // Calculate running balance
      const statementEntries: FloatStatementEntry[] = [];
      let runningBalance = Number(account.current_balance);

      // Process entries in reverse (oldest first) to calculate balance
      const reversedEntries = [...paginatedEntries].reverse();

      for (const entry of reversedEntries) {
        const debit = Number(entry.debit || 0);
        const credit = Number(entry.credit || 0);

        // For asset accounts: Debit increases, Credit decreases
        // For liability accounts: Credit increases, Debit decreases
        const netChange = isAsset ? debit - credit : credit - debit;
        const balanceBefore =
          Math.round((runningBalance - netChange) * 100) / 100;

        console.log(`Processing entry ${entry.reference}:`, {
          debit,
          credit,
          isAsset,
          netChange,
          balanceBefore,
          runningBalance,
          accountType: account.account_type,
        });

        statementEntries.unshift({
          id: entry.id,
          date: entry.transaction_date,
          type:
            entry.source_transaction_type ||
            entry.transaction_type ||
            "Unknown",
          description:
            entry.description ||
            `${entry.source_module || entry.entry_source} transaction`,
          reference: entry.reference || "",
          debit: Math.round(debit * 100) / 100,
          credit: Math.round(credit * 100) / 100,
          balance: Math.round(runningBalance * 100) / 100,
          source:
            entry.entry_source === "float_transaction"
              ? "float_transactions"
              : entry.source_module || "manual",
          processedBy: entry.processed_by || "System",
        });

        runningBalance = Math.round(balanceBefore * 100) / 100;
      }

      // Calculate summary
      const totalDebits = statementEntries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = statementEntries.reduce(
        (sum, e) => sum + e.credit,
        0
      );
      const openingBalance =
        statementEntries.length > 0
          ? statementEntries[statementEntries.length - 1].balance -
            (isAsset
              ? statementEntries[statementEntries.length - 1].debit -
                statementEntries[statementEntries.length - 1].credit
              : statementEntries[statementEntries.length - 1].credit -
                statementEntries[statementEntries.length - 1].debit)
          : Number(account.current_balance);

      return {
        success: true,
        data: {
          entries: statementEntries,
          summary: {
            openingBalance,
            closingBalance: Number(account.current_balance),
            totalDebits,
            totalCredits,
            transactionCount: totalCount,
            currentPage: page,
            totalPages,
            hasMore: page < totalPages,
          },
          account: {
            id: account.id,
            accountType: account.account_type,
            provider: account.provider,
            accountNumber: account.account_number,
            branchName: account.branch_name,
            currentBalance: Number(account.current_balance),
            minThreshold: Number(account.min_threshold),
            maxThreshold: Number(account.max_threshold),
          },
        },
      };
    } catch (error) {
      devLog.error("Error generating float statement:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Helper to determine if account type is asset
function isAssetAccount(accountType: string): boolean {
  return ["cash-in-till", "bank", "cash"].includes(accountType);
}
