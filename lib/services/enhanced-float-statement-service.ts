import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export interface FloatStatementFilters {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  accountType?: string;
  provider?: string;
  includeGL?: boolean;
}

export interface FloatStatementEntry {
  id: string;
  transactionDate: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  reference: string;
  sourceModule?: string;
  sourceTransactionId?: string;
  processedBy: string;
  branchId: string;
  branchName: string;
  glEntries?: GLEntry[];
}

export interface GLEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface FloatStatementSummary {
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  netChange: number;
  transactionCount: number;
  glTransactionCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export class EnhancedFloatStatementService {
  /**
   * Generate comprehensive float statement using GL journal entries
   */
  static async generateFloatStatement(
    floatAccountId: string,
    filters: FloatStatementFilters,
    user: any
  ): Promise<{
    success: boolean;
    data?: {
      entries: FloatStatementEntry[];
      summary: FloatStatementSummary;
      account: any;
    };
    error?: string;
  }> {
    try {
      console.log(
        "[FLOAT STATEMENT] Generating statement for account:",
        floatAccountId
      );

      // Get float account details
      const accountResult = await sql`
        SELECT 
          fa.*,
          b.name as branch_name,
          b.code as branch_code
        FROM float_accounts fa
        LEFT JOIN branches b ON fa.branch_id = b.id
        WHERE fa.id = ${floatAccountId}
      `;

      if (accountResult.length === 0) {
        return { success: false, error: "Float account not found" };
      }

      const account = accountResult[0];

      // Apply branch filtering based on user role
      const effectiveBranchId = this.getEffectiveBranchId(
        user,
        filters.branchId
      );

      if (effectiveBranchId && effectiveBranchId !== account.branch_id) {
        return { success: false, error: "Access denied to this float account" };
      }

      // Get all float transactions for the account
      const floatTransactions = await this.getFloatTransactions(
        floatAccountId,
        filters
      );

      console.log(
        `[FLOAT STATEMENT] Found ${floatTransactions.length} float transactions`
      );

      // Get GL journal entries only if includeGL is true or not specified
      let glEntries: any[] = [];
      if (filters.includeGL !== false) {
        glEntries = await this.getGLEntriesForFloatAccount(
          floatAccountId,
          filters
        );
        console.log(`[FLOAT STATEMENT] Found ${glEntries.length} GL entries`);
      } else {
        console.log(
          `[FLOAT STATEMENT] Skipping GL entries (includeGL = false)`
        );
      }

      // Merge float transactions with GL entries
      const mergedEntries = await this.mergeTransactionsWithGL(
        floatTransactions,
        glEntries,
        account,
        filters,
        floatAccountId
      );

      // Calculate summary
      const summary = this.calculateSummary(mergedEntries, filters);

      return {
        success: true,
        data: {
          entries: mergedEntries,
          summary,
          account: {
            id: account.id,
            accountType: account.account_type,
            provider: account.provider,
            accountNumber: account.account_number,
            currentBalance: Number(account.current_balance),
            minThreshold: Number(account.min_threshold),
            maxThreshold: Number(account.max_threshold),
            branchName: account.branch_name,
            branchCode: account.branch_code,
            isActive: account.is_active,
          },
        },
      };
    } catch (error) {
      console.error("Error generating float statement:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get float transactions for the account
   */
  private static async getFloatTransactions(
    floatAccountId: string,
    filters: FloatStatementFilters
  ): Promise<any[]> {
    // First, let's check if there are any transactions at all for this account
    const basicCheck = await sql`
      SELECT COUNT(*) as total_count
      FROM float_transactions 
      WHERE float_account_id = ${floatAccountId}
    `;

    console.log(
      `[FLOAT TRANSACTIONS] Total transactions for account: ${
        basicCheck[0]?.total_count || 0
      }`
    );

    if (basicCheck[0]?.total_count === 0) {
      console.log(
        `[FLOAT TRANSACTIONS] No transactions found for account ${floatAccountId}`
      );
      return [];
    }

    // Check transactions in date range
    if (filters.startDate && filters.endDate) {
      const dateRangeCheck = await sql`
        SELECT COUNT(*) as count_in_range
        FROM float_transactions 
        WHERE float_account_id = ${floatAccountId}
        AND created_at >= ${filters.startDate}::date
        AND created_at <= ${filters.endDate}::date + INTERVAL '1 day'
      `;

      console.log(
        `[FLOAT TRANSACTIONS] Transactions in date range: ${
          dateRangeCheck[0]?.count_in_range || 0
        }`
      );
    }
    // Build the complete query string with all conditions
    let queryString = `
      SELECT 
        ft.id,
        ft.created_at as transaction_date,
        ft.transaction_type,
        ft.amount,
        ft.balance_before,
        ft.balance_after,
        ft.description,
        ft.reference,
        ft.processed_by,
        ft.branch_id,
        b.name as branch_name,
        u.first_name,
        u.last_name,
        'float_transaction' as source_type
      FROM float_transactions ft
      LEFT JOIN branches b ON ft.branch_id = b.id
      LEFT JOIN float_accounts fa ON ft.float_account_id = fa.id
      LEFT JOIN users u ON ft.processed_by::uuid = u.id
      WHERE ft.float_account_id = $1
    `;

    const params = [floatAccountId];
    let paramIndex = 2;

    if (filters.startDate) {
      queryString += ` AND ft.created_at >= $${paramIndex}::date`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      queryString += ` AND ft.created_at <= $${paramIndex}::date + INTERVAL '1 day'`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.branchId) {
      queryString += ` AND ft.branch_id = $${paramIndex}`;
      params.push(filters.branchId);
      paramIndex++;
    }

    if (filters.accountType) {
      queryString += ` AND fa.account_type = $${paramIndex}`;
      params.push(filters.accountType);
      paramIndex++;
    }

    if (filters.provider) {
      queryString += ` AND fa.provider = $${paramIndex}`;
      params.push(filters.provider);
      paramIndex++;
    }

    queryString += ` ORDER BY ft.created_at DESC`;

    console.log(`[FLOAT TRANSACTIONS] Query: ${queryString}`);
    console.log(`[FLOAT TRANSACTIONS] Params:`, params);

    const result = await sql.query(queryString, params);
    console.log(`[FLOAT TRANSACTIONS] Result count: ${result.length}`);

    return result;
  }

  /**
   * Get GL journal entries related to this float account
   */
  private static async getGLEntriesForFloatAccount(
    floatAccountId: string,
    filters: FloatStatementFilters
  ): Promise<any[]> {
    // Get GL mappings for this float account
    const mappingsResult = await sql`
      SELECT 
        gm.gl_account_id,
        gm.mapping_type,
        ga.code as account_code,
        ga.name as account_name
      FROM gl_mappings gm
      JOIN gl_accounts ga ON gm.gl_account_id = ga.id
      WHERE gm.float_account_id = ${floatAccountId}
      AND gm.is_active = true
    `;

    if (mappingsResult.length === 0) {
      console.log(
        `[GL ENTRIES] No float-specific GL mappings found for float account ${floatAccountId} - trying transaction-type based mappings`
      );

      // Try to get transaction-type based mappings instead
      const accountResult = await sql`
        SELECT account_type, branch_id FROM float_accounts WHERE id = ${floatAccountId}
      `;

      if (accountResult.length > 0) {
        const account = accountResult[0];
        const transactionType = `${account.account_type.replace(
          /-/g,
          "_"
        )}_float`;

        const transactionTypeMappings = await sql`
          SELECT 
            gm.gl_account_id,
            gm.mapping_type,
            ga.code as account_code,
            ga.name as account_name
          FROM gl_mappings gm
          JOIN gl_accounts ga ON gm.gl_account_id = ga.id
          WHERE gm.transaction_type = ${transactionType}
          AND gm.branch_id = ${account.branch_id}
          AND gm.is_active = true
          AND gm.float_account_id IS NULL
        `;

        if (transactionTypeMappings.length > 0) {
          console.log(
            `[GL ENTRIES] Found ${transactionTypeMappings.length} transaction-type based mappings for ${transactionType}`
          );
          mappingsResult.push(...transactionTypeMappings);
        } else {
          console.log(
            `[GL ENTRIES] No transaction-type mappings found for ${transactionType} - continuing with float transactions only`
          );
          return [];
        }
      } else {
        console.log(
          `[GL ENTRIES] Float account not found - continuing with float transactions only`
        );
        return [];
      }
    }

    const glAccountIds = mappingsResult.map((m: any) => m.gl_account_id);
    console.log(
      `[GL ENTRIES] Found ${glAccountIds.length} GL account mappings for float account ${floatAccountId}`
    );

    // Build query to get GL entries for all modules that affect this float account
    let queryString = `
                    SELECT
                        glt.id,
                        glt.date as transaction_date,
                        glt.source_module,
                        glt.source_transaction_type as transaction_type,
                        glt.amount,
                        glt.reference,
                        glt.created_by as processed_by,
                        glt.branch_id,
                        glt.metadata,
                        glje.account_id,
                        glje.debit,
                        glje.credit,
                        glje.description,
                        ga.code as account_code,
                        ga.name as account_name,
                        b.name as branch_name,
                        u.first_name,
                        u.last_name,
                        'gl_entry' as source_type
                    FROM gl_transactions glt
                    JOIN gl_journal_entries glje ON glt.id = glje.transaction_id
                    JOIN gl_accounts ga ON glje.account_id = ga.id
                    LEFT JOIN branches b ON glt.branch_id = b.id
                    LEFT JOIN users u ON glt.created_by::uuid = u.id
                    WHERE glje.account_id = ANY($1::uuid[])
                `;

    const params = [glAccountIds];
    let paramIndex = 2;

    if (filters.startDate) {
      queryString += ` AND glt.date >= $${paramIndex}::date`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      queryString += ` AND glt.date <= $${paramIndex}::date + INTERVAL '1 day'`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.branchId) {
      queryString += ` AND glt.branch_id = $${paramIndex}`;
      params.push(filters.branchId);
      paramIndex++;
    }

    queryString += ` ORDER BY glt.date DESC, glt.created_at DESC`;

    console.log(`[GL ENTRIES] Query: ${queryString}`);
    console.log(`[GL ENTRIES] Params:`, params);

    const result = await sql.query(queryString, params);
    console.log(
      `[GL ENTRIES] Found ${result.length} GL entries for float account ${floatAccountId}`
    );

    return result;
  }

  /**
   * Merge float transactions with GL entries from all modules
   */
  private static async mergeTransactionsWithGL(
    floatTransactions: any[],
    glEntries: any[],
    account: any,
    filters: FloatStatementFilters,
    floatAccountId: string
  ): Promise<FloatStatementEntry[]> {
    const merged: FloatStatementEntry[] = [];
    const processedGLTransactions = new Set<string>();

    console.log(
      `[MERGE] Processing ${floatTransactions.length} float transactions and ${glEntries.length} GL entries`
    );

    // Add float transactions first
    for (const tx of floatTransactions) {
      // Get user name
      const userName =
        tx.first_name && tx.last_name
          ? `${tx.first_name} ${tx.last_name}`
          : tx.first_name || tx.last_name || tx.processed_by || "Unknown User";

      merged.push({
        id: tx.id,
        transactionDate: tx.transaction_date,
        transactionType: tx.transaction_type,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balance_before),
        balanceAfter: Number(tx.balance_after),
        description: tx.description,
        reference: tx.reference,
        processedBy: userName,
        branchId: tx.branch_id,
        branchName: tx.branch_name,
        sourceModule: "float_transactions",
      });
    }

    // Group GL entries by transaction ID
    const glTransactionsMap = new Map<string, any[]>();
    for (const gl of glEntries) {
      const transactionId = gl.id;
      if (!glTransactionsMap.has(transactionId)) {
        glTransactionsMap.set(transactionId, []);
      }
      glTransactionsMap.get(transactionId)!.push(gl);
    }

    console.log(
      `[MERGE] Found ${glTransactionsMap.size} unique GL transactions`
    );

    // Process GL transactions and convert them to float transaction format
    for (const [transactionId, glTransactionEntries] of glTransactionsMap) {
      if (processedGLTransactions.has(transactionId)) {
        continue;
      }

      // Get the first entry to extract common transaction data
      const firstEntry = glTransactionEntries[0];

      // Get user name
      const userName =
        firstEntry.first_name && firstEntry.last_name
          ? `${firstEntry.first_name} ${firstEntry.last_name}`
          : firstEntry.first_name ||
            firstEntry.last_name ||
            firstEntry.processed_by ||
            "Unknown User";

      // Calculate the net amount for this float account
      // Look for the main float account entry (the one that affects the float balance)
      let netAmount = 0;
      let fee = 0;
      let totalDebits = 0;
      let totalCredits = 0;

      // Find the main float account entry and calculate fees
      let mainFloatEntry = null;
      let maxAmount = 0;

      for (const entry of glTransactionEntries) {
        const debit = Number(entry.debit) || 0;
        const credit = Number(entry.credit) || 0;
        const amount = debit + credit;

        totalDebits += debit;
        totalCredits += credit;

        // Track the entry with the largest amount as the main float account entry
        if (amount > maxAmount) {
          maxAmount = amount;
          mainFloatEntry = entry;
        }

        // Calculate fee from fee-related entries
        if (
          entry.account_code.includes("FEE") ||
          entry.description.toLowerCase().includes("fee")
        ) {
          fee += credit; // Fees are typically credits
        }
      }

      // Calculate net amount based on the main float account entry
      if (mainFloatEntry) {
        const debit = Number(mainFloatEntry.debit) || 0;
        const credit = Number(mainFloatEntry.credit) || 0;

        // For float accounts: deposits increase balance (credit), withdrawals decrease balance (debit)
        if (credit > debit) {
          // This is a deposit/recharge
          netAmount = credit;
        } else {
          // This is a withdrawal
          netAmount = -debit;
        }
      }

      // Add fee to description if present
      let description = firstEntry.description || "GL Transaction";
      if (fee > 0) {
        description += ` (Fee: ${fee.toFixed(2)})`;
      }

      // Get reference
      const reference = firstEntry.reference || "No Reference";

      merged.push({
        id: transactionId,
        transactionDate: firstEntry.transaction_date,
        transactionType: firstEntry.transaction_type || "GL Entry",
        amount: netAmount,
        balanceBefore: 0, // Will be calculated below
        balanceAfter: 0, // Will be calculated below
        description,
        reference,
        processedBy: userName,
        branchId: firstEntry.branch_id,
        branchName: firstEntry.branch_name,
        sourceModule: firstEntry.source_module,
        sourceTransactionId: transactionId,
      });

      processedGLTransactions.add(transactionId);
    }

    // Sort all entries by date
    merged.sort(
      (a, b) =>
        new Date(a.transactionDate).getTime() -
        new Date(b.transactionDate).getTime()
    );

    // Calculate running balances properly
    let runningBalance = 0;

    // Get the actual opening balance for the start date
    let openingBalance = 0;
    if (filters.startDate) {
      const openingBalanceResult = await sql`
        SELECT COALESCE(
          (SELECT balance_after 
           FROM float_transactions 
           WHERE float_account_id = ${floatAccountId}
           AND created_at < ${filters.startDate}::date
           ORDER BY created_at DESC 
           LIMIT 1), 
          (SELECT current_balance 
           FROM float_accounts 
           WHERE id = ${floatAccountId})
        ) as opening_balance
      `;
      openingBalance = Number(openingBalanceResult[0]?.opening_balance || 0);
    } else {
      // If no start date, use current balance as opening
      openingBalance = Number(account.current_balance);
    }

    // Calculate forward from the opening balance
    runningBalance = openingBalance;

    for (const entry of merged) {
      entry.balanceBefore = runningBalance;
      runningBalance += entry.amount;
      entry.balanceAfter = runningBalance;
    }

    console.log(
      `[MERGE] Final merged entries: ${merged.length}, Opening balance: ${openingBalance}, Closing balance: ${runningBalance}`
    );

    return merged;
  }

  /**
   * Calculate statement summary
   */
  private static calculateSummary(
    entries: FloatStatementEntry[],
    filters: FloatStatementFilters
  ): FloatStatementSummary {
    if (entries.length === 0) {
      return {
        openingBalance: 0,
        closingBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        netChange: 0,
        transactionCount: 0,
        glTransactionCount: 0,
        period: {
          startDate: filters.startDate || "",
          endDate: filters.endDate || "",
        },
      };
    }

    // Calculate credits and debits based on positive/negative amounts
    const totalCredits = entries
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalDebits = entries
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const netChange = totalCredits - totalDebits;

    // Count different types of transactions
    const floatTransactions = entries.filter(
      (e) => e.sourceModule === "float_transactions"
    );
    const glTransactions = entries.filter(
      (e) => e.sourceModule && e.sourceModule !== "float_transactions"
    );

    // Sort entries by date to get opening and closing balances
    const sortedEntries = [...entries].sort(
      (a, b) =>
        new Date(a.transactionDate).getTime() -
        new Date(b.transactionDate).getTime()
    );

    // Use the calculated balances from the merge function
    const openingBalance =
      sortedEntries.length > 0 ? sortedEntries[0].balanceBefore : 0;
    const closingBalance =
      sortedEntries.length > 0
        ? sortedEntries[sortedEntries.length - 1].balanceAfter
        : 0;

    console.log(`[SUMMARY] Calculated summary:`, {
      totalEntries: entries.length,
      floatTransactions: floatTransactions.length,
      glTransactions: glTransactions.length,
      totalCredits,
      totalDebits,
      netChange,
      openingBalance,
      closingBalance,
    });

    return {
      openingBalance,
      closingBalance,
      totalCredits,
      totalDebits,
      netChange,
      transactionCount: entries.length,
      glTransactionCount: glTransactions.length,
      period: {
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
      },
    };
  }

  /**
   * Get effective branch ID for filtering based on user role
   */
  private static getEffectiveBranchId(
    user: any,
    requestedBranchId?: string
  ): string | null {
    // Admins can see all branches, others are restricted to their branch
    if (user.role?.toLowerCase() === "admin") {
      return requestedBranchId || null;
    }
    return user.branchId || null;
  }
}
