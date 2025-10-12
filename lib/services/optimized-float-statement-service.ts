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
        `📊 Generating statement for ${account.account_type} - ${account.provider}`
      );

      // Step 1: Get GL account mappings for this float
      // Payment floats (MoMo, Cash): Include both specific AND generic transaction-type mappings
      // Service floats (Agency, Jumia, Power, E-Zwich): Include ONLY specific mappings

      const paymentFloats = ["cash-in-till", "momo"];
      const isPaymentFloat = paymentFloats.includes(account.account_type);

      let glMappings;

      if (isPaymentFloat) {
        // For payment floats: Include specific mappings + generic transaction-type mappings
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
          AND gm.mapping_type IN ('main', 'asset', 'liability')
        `;
      } else {
        // For service floats: ONLY specific mappings
        glMappings = await sql`
          SELECT 
            ga.id as gl_account_id,
            ga.code as gl_code,
            ga.name as gl_name
          FROM gl_mappings gm
          JOIN gl_accounts ga ON gm.gl_account_id = ga.id
          WHERE gm.float_account_id = ${floatAccountId}
          AND gm.is_active = true
          AND gm.mapping_type IN ('main', 'asset', 'liability')
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
        `📌 Using ${glMappings.length} GL Account(s):`,
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
          ? sql`AND ft.created_at >= ${startDate}::date AND ft.created_at <= ${endDate}::date`
          : startDate
          ? sql`AND ft.created_at >= ${startDate}::date`
          : endDate
          ? sql`AND ft.created_at <= ${endDate}::date`
          : sql``;

      // Determine which source modules to include based on account type
      let sourceModuleFilter = sql``;

      if (isPaymentFloat) {
        // Payment floats: Show ALL transactions (no filter)
        // This includes their own service transactions + being used as payment for other services
        devLog.info(
          `💳 ${account.account_type}: Showing ALL transactions affecting this account`
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
          `🔒 ${account.account_type}: Filtering to modules:`,
          allowedModules
        );
        sourceModuleFilter = sql`AND glt.source_module = ANY(${allowedModules})`;
      }

      // Fetch GL entries
      const glEntries = await sql`
        SELECT 
          glt.id,
          glt.date as transaction_date,
          glt.source_module,
          glt.source_transaction_type,
          glt.reference,
          glt.description,
          glje.debit,
          glje.credit,
          glt.created_by,
          u.first_name || ' ' || u.last_name as processed_by,
          'gl_entry' as entry_source,
          glt.created_at
        FROM gl_transactions glt
        JOIN gl_journal_entries glje ON glt.id = glje.transaction_id
        LEFT JOIN users u ON glt.created_by::uuid = u.id
        WHERE glje.account_id = ANY(${glAccountIds})
        AND glt.status = 'posted'
        ${sourceModuleFilter}
        ${glDateFilter}
        ORDER BY glt.date DESC, glt.created_at DESC
      `;

      devLog.info(`📊 Found ${glEntries.length} GL entries`);

      // Fetch float_transactions
      const floatTransactions = await sql`
        SELECT 
          ft.id,
          ft.created_at::date as transaction_date,
          ft.transaction_type as source_transaction_type,
          ft.reference as reference,
          ft.description,
          CASE 
            WHEN ft.transaction_type = 'recharge' THEN ft.amount
            WHEN ft.transaction_type = 'transfer_in' THEN ft.amount
            ELSE 0
          END as debit,
          CASE 
            WHEN ft.transaction_type = 'withdrawal' THEN ft.amount
            WHEN ft.transaction_type = 'transfer_out' THEN ft.amount
            ELSE 0
          END as credit,
          ft.processed_by as created_by,
          COALESCE(
            u.first_name || ' ' || u.last_name,
            ft.processed_by,
            'System'
          ) as processed_by,
          'float_transaction' as entry_source,
          ft.created_at
        FROM float_transactions ft
        LEFT JOIN users u ON ft.processed_by::text = u.id::text
        WHERE ft.float_account_id = ${floatAccountId}
        AND ft.status = 'completed'
        ${floatDateFilter}
        ORDER BY ft.created_at DESC
      `;

      devLog.info(`📊 Found ${floatTransactions.length} float transactions`);

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
        `✅ Total merged entries: ${allEntries.length} (${glEntries.length} GL + ${floatTransactions.length} Float)`
      );

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
        account.account_type === "momo"; // MoMo is also an asset (cash equivalent)

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
        const balanceBefore = runningBalance - netChange;

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
          debit: debit,
          credit: credit,
          balance: runningBalance,
          source:
            entry.entry_source === "float_transaction"
              ? "float_transactions"
              : entry.source_module || "manual",
          processedBy: entry.processed_by || "System",
        });

        runningBalance = balanceBefore;
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
