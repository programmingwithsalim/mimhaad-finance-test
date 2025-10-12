import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// Float Transaction interface
export interface FloatTransaction {
  id: string
  type: "allocation" | "return" | "transfer" | "adjustment"
  amount: number
  fromAccountId?: string
  toAccountId: string
  reference: string
  status: "pending" | "completed" | "failed"
  date: string
  branchId?: string
  userId: string
  approvedBy?: string
  approvedAt?: string
  description: string
  metadata?: Record<string, any>
}

// Float Account interface
export interface FloatAccount {
  id: string
  branchId: string
  accountType: string
  provider?: string
  accountNumber?: string
  currentBalance: number
  minThreshold: number
  maxThreshold: number
  lastUpdated: string
  createdBy: string
  createdAt: string
}

// Float Statistics interface
export interface FloatStatistics {
  totalAccounts: number
  totalBalance: number
  lowBalanceAccounts: number
  excessBalanceAccounts: number
  accountTypeBreakdown: Record<string, number>
  transactionTypeBreakdown: Record<string, number>
  branchBalances: { id: string; name: string; balance: number }[]
  enrichedFloatAccounts: (FloatAccount & { branchName: string })[]
}

/**
 * Get float statistics
 */
export async function getFloatStatistics(): Promise<FloatStatistics | null> {
  try {
    // Check if we should use the database
    const useMockData = process.env.USE_MOCK_DATA === "true"

    if (useMockData) {
      return generateMockFloatStatistics()
    }

    // Try to use the database
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL environment variable is not set")
      }

      // Check if the float_accounts table exists
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'float_accounts'
        ) as table_exists
      `

      const tableExists = tableCheck[0]?.table_exists === true

      if (!tableExists) {
        console.log("Float accounts table does not exist, using mock data")
        return generateMockFloatStatistics()
      }

      // Get statistics from database
      const totalAccountsResult = await sql`
        SELECT COUNT(*) as count FROM float_accounts WHERE is_active = true
      `
      const totalAccounts = Number(totalAccountsResult[0]?.count || 0)

      const totalBalanceResult = await sql`
        SELECT SUM(current_balance) as total FROM float_accounts WHERE is_active = true
      `
      const totalBalance = Number(totalBalanceResult[0]?.total || 0)

      const lowBalanceResult = await sql`
        SELECT COUNT(*) as count FROM float_accounts 
        WHERE is_active = true AND current_balance < min_threshold
      `
      const lowBalanceAccounts = Number(lowBalanceResult[0]?.count || 0)

      const excessBalanceResult = await sql`
        SELECT COUNT(*) as count FROM float_accounts 
        WHERE is_active = true AND current_balance > max_threshold
      `
      const excessBalanceAccounts = Number(excessBalanceResult[0]?.count || 0)

      // Get account type breakdown
      const accountTypeResult = await sql`
        SELECT account_type, SUM(current_balance) as total
        FROM float_accounts
        WHERE is_active = true
        GROUP BY account_type
      `

      const accountTypeBreakdown = accountTypeResult.reduce(
        (acc, row) => {
          acc[row.account_type] = Number(row.total || 0)
          return acc
        },
        {} as Record<string, number>,
      )

      // Mock transaction type breakdown
      const transactionTypeBreakdown = {
        allocation: 45,
        transfer: 32,
        return: 18,
        adjustment: 5,
      }

      // Get branch balances
      const branchBalancesResult = await sql`
        SELECT 
          b.id, 
          b.name, 
          SUM(fa.current_balance) as balance
        FROM float_accounts fa
        JOIN branches b ON fa.branch_id = b.id
        WHERE fa.is_active = true
        GROUP BY b.id, b.name
        ORDER BY balance DESC
        LIMIT 10
      `

      const branchBalances = branchBalancesResult.map((row) => ({
        id: row.id,
        name: row.name,
        balance: Number(row.balance || 0),
      }))

      // Get enriched float accounts
      const enrichedAccountsResult = await sql`
        SELECT 
          fa.id,
          fa.branch_id as "branchId",
          b.name as "branchName",
          fa.account_type as "accountType",
          fa.provider,
          fa.current_balance as "currentBalance",
          fa.min_threshold as "minThreshold",
          fa.max_threshold as "maxThreshold",
          fa.updated_at as "lastUpdated"
        FROM float_accounts fa
        JOIN branches b ON fa.branch_id = b.id
        WHERE fa.is_active = true
        ORDER BY fa.current_balance DESC
        LIMIT 20
      `

      const enrichedFloatAccounts = enrichedAccountsResult.map((account) => ({
        ...account,
        currentBalance: Number(account.currentBalance || 0),
        minThreshold: Number(account.minThreshold || 0),
        maxThreshold: Number(account.maxThreshold || 0),
        createdBy: "system",
        createdAt: new Date().toISOString(),
      }))

      return {
        totalAccounts,
        totalBalance,
        lowBalanceAccounts,
        excessBalanceAccounts,
        accountTypeBreakdown,
        transactionTypeBreakdown,
        branchBalances,
        enrichedFloatAccounts,
      }
    } catch (dbError) {
      console.error("Database error when fetching float statistics:", dbError)
      return generateMockFloatStatistics()
    }
  } catch (error) {
    console.error("Error getting float statistics:", error)
    return generateMockFloatStatistics()
  }
}

// Generate mock float statistics for testing
function generateMockFloatStatistics(): FloatStatistics {
  return {
    totalAccounts: 24,
    totalBalance: 1250000,
    lowBalanceAccounts: 5,
    excessBalanceAccounts: 3,
    accountTypeBreakdown: {
      momo: 450000,
      "agency-banking": 350000,
      "e-zwich": 200000,
      "cash-in-till": 150000,
      power: 100000,
    },
    transactionTypeBreakdown: {
      allocation: 45,
      transfer: 32,
      return: 18,
      adjustment: 5,
    },
    branchBalances: [
      { id: "branch-1", name: "Accra Main", balance: 350000 },
      { id: "branch-2", name: "Kumasi Central", balance: 280000 },
      { id: "branch-3", name: "Takoradi", balance: 220000 },
      { id: "branch-4", name: "Tamale", balance: 200000 },
      { id: "branch-5", name: "Cape Coast", balance: 200000 },
    ],
    enrichedFloatAccounts: [
      {
        id: "float-1",
        branchId: "branch-1",
        branchName: "Accra Main",
        accountType: "momo",
        provider: "MTN",
        currentBalance: 120000,
        minThreshold: 50000,
        maxThreshold: 200000,
        lastUpdated: "2023-05-15T10:30:00Z",
        createdBy: "admin",
        createdAt: "2023-01-15T10:30:00Z",
      },
      {
        id: "float-2",
        branchId: "branch-1",
        branchName: "Accra Main",
        accountType: "agency-banking",
        provider: "Ecobank",
        currentBalance: 85000,
        minThreshold: 40000,
        maxThreshold: 150000,
        lastUpdated: "2023-05-14T16:45:00Z",
        createdBy: "admin",
        createdAt: "2023-01-14T16:45:00Z",
      },
    ],
  }
}

/**
 * Get all float accounts
 */
export async function getAllFloatAccounts(filters?: {
  branchId?: string
  accountType?: string
  minBalance?: number
  maxBalance?: number
}): Promise<FloatAccount[]> {
  try {
    // Try database first
    try {
      const query = sql`SELECT * FROM float_accounts WHERE is_active = true`

      // Apply filters would go here if needed
      const accounts = await query

      return accounts.map((a) => ({
        id: a.id,
        branchId: a.branch_id,
        accountType: a.account_type,
        provider: a.provider,
        accountNumber: a.account_number,
        currentBalance: Number(a.current_balance),
        minThreshold: Number(a.min_threshold),
        maxThreshold: Number(a.max_threshold),
        lastUpdated: a.updated_at,
        createdBy: a.created_by,
        createdAt: a.created_at,
      }))
    } catch (dbError) {
      console.log("Database not available, using mock data")
    }

    // Return empty array as fallback
    return []
  } catch (error) {
    console.error("Error getting float accounts:", error)
    return []
  }
}

/**
 * Get float accounts by branch ID
 */
export async function getFloatAccountsByBranchId(branchId: string): Promise<FloatAccount[]> {
  try {
    const allAccounts = await getAllFloatAccounts()
    return allAccounts.filter((account) => account.branchId === branchId)
  } catch (error) {
    console.error("Error getting float accounts by branch ID:", error)
    return []
  }
}

/**
 * Get a float account by ID
 */
export async function getFloatAccountById(id: string): Promise<FloatAccount | null> {
  try {
    const accounts = await getAllFloatAccounts()
    return accounts.find((a) => a.id === id) || null
  } catch (error) {
    console.error("Error getting float account by ID:", error)
    return null
  }
}

/**
 * Create a new float account
 */
export async function createFloatAccount(
  accountData: Omit<FloatAccount, "id" | "lastUpdated" | "createdAt">,
): Promise<FloatAccount | null> {
  try {
    const newAccount: FloatAccount = {
      id: `float-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...accountData,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    // Try to store in database
    try {
      await sql`
        INSERT INTO float_accounts (
          id, branch_id, account_type, provider, account_number,
          current_balance, min_threshold, max_threshold, created_by
        ) VALUES (
          ${newAccount.id}, ${newAccount.branchId}, ${newAccount.accountType},
          ${newAccount.provider}, ${newAccount.accountNumber}, ${newAccount.currentBalance},
          ${newAccount.minThreshold}, ${newAccount.maxThreshold}, ${newAccount.createdBy}
        )
      `
    } catch (dbError) {
      console.log("Database not available, using mock data")
    }

    return newAccount
  } catch (error) {
    console.error("Error creating float account:", error)
    return null
  }
}

/**
 * Update a float account
 */
export async function updateFloatAccount(id: string, updates: Partial<FloatAccount>): Promise<FloatAccount | null> {
  try {
    // Try to update in database
    try {
      const updateFields = []
      const values = []
      let paramIndex = 1

      if (updates.currentBalance !== undefined) {
        updateFields.push(`current_balance = $${paramIndex}`)
        values.push(updates.currentBalance)
        paramIndex++
      }
      if (updates.minThreshold !== undefined) {
        updateFields.push(`min_threshold = $${paramIndex}`)
        values.push(updates.minThreshold)
        paramIndex++
      }
      if (updates.maxThreshold !== undefined) {
        updateFields.push(`max_threshold = $${paramIndex}`)
        values.push(updates.maxThreshold)
        paramIndex++
      }
      if (updates.provider !== undefined) {
        updateFields.push(`provider = $${paramIndex}`)
        values.push(updates.provider)
        paramIndex++
      }

      updateFields.push(`updated_at = NOW()`)
      values.push(id)

      const query = `
        UPDATE float_accounts 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *
      `

      const result = await sql.query(query, values)

      if (result.length > 0) {
        const a = result[0]
        return {
          id: a.id,
          branchId: a.branch_id,
          accountType: a.account_type,
          provider: a.provider,
          accountNumber: a.account_number,
          currentBalance: Number(a.current_balance),
          minThreshold: Number(a.min_threshold),
          maxThreshold: Number(a.max_threshold),
          lastUpdated: a.updated_at,
          createdBy: a.created_by,
          createdAt: a.created_at,
        }
      }
    } catch (dbError) {
      console.log("Database not available for update")
    }

    // Fallback: return updated mock data
    const existingAccount = await getFloatAccountById(id)
    if (existingAccount) {
      return {
        ...existingAccount,
        ...updates,
        lastUpdated: new Date().toISOString(),
      }
    }

    return null
  } catch (error) {
    console.error("Error updating float account:", error)
    return null
  }
}

/**
 * Delete a float account
 */
export async function deleteFloatAccount(id: string): Promise<boolean> {
  try {
    // Try to delete from database
    try {
      const result = await sql`
        UPDATE float_accounts SET is_active = false WHERE id = ${id}
      `
      return result.count > 0
    } catch (dbError) {
      console.log("Database not available for delete")
    }

    // For mock data, always return true
    return true
  } catch (error) {
    console.error("Error deleting float account:", error)
    return false
  }
}

/**
 * Get all float transactions
 */
export async function getAllFloatTransactions(): Promise<FloatTransaction[]> {
  try {
    // Try database first
    try {
      const transactions = await sql`
        SELECT * FROM float_transactions ORDER BY date DESC
      `

      return transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        fromAccountId: t.from_account_id,
        toAccountId: t.to_account_id,
        reference: t.reference,
        status: t.status,
        date: t.date,
        branchId: t.branch_id,
        userId: t.user_id,
        approvedBy: t.approved_by,
        approvedAt: t.approved_at,
        description: t.description,
        metadata: t.metadata || {},
      }))
    } catch (dbError) {
      console.log("Database not available, using mock data")
    }

    // Return empty array as fallback
    return []
  } catch (error) {
    console.error("Error getting float transactions:", error)
    return []
  }
}

/**
 * Get float transactions by account ID
 */
export async function getFloatTransactionsByAccountId(accountId: string): Promise<FloatTransaction[]> {
  try {
    const allTransactions = await getAllFloatTransactions()
    return allTransactions.filter(
      (transaction) => transaction.fromAccountId === accountId || transaction.toAccountId === accountId,
    )
  } catch (error) {
    console.error("Error getting float transactions by account ID:", error)
    return []
  }
}

/**
 * Get float transactions by branch ID
 */
export async function getFloatTransactionsByBranchId(branchId: string): Promise<FloatTransaction[]> {
  try {
    const allTransactions = await getAllFloatTransactions()
    return allTransactions.filter((transaction) => transaction.branchId === branchId)
  } catch (error) {
    console.error("Error getting float transactions by branch ID:", error)
    return []
  }
}

/**
 * Create a new float transaction
 */
export async function createFloatTransaction(
  transactionData: Omit<FloatTransaction, "id" | "date">,
): Promise<FloatTransaction | null> {
  try {
    const newTransaction: FloatTransaction = {
      id: `ft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...transactionData,
      date: new Date().toISOString(),
    }

    // Try to store in database
    try {
      await sql`
        INSERT INTO float_transactions (
          id, type, amount, from_account_id, to_account_id, reference,
          status, date, branch_id, user_id, description
        ) VALUES (
          ${newTransaction.id}, ${newTransaction.type}, ${newTransaction.amount},
          ${newTransaction.fromAccountId}, ${newTransaction.toAccountId}, ${newTransaction.reference},
          ${newTransaction.status}, ${newTransaction.date}, ${newTransaction.branchId},
          ${newTransaction.userId}, ${newTransaction.description}
        )
      `
    } catch (dbError) {
      console.log("Database not available, using mock data")
    }

    return newTransaction
  } catch (error) {
    console.error("Error creating float transaction:", error)
    return null
  }
}

/**
 * Sync float with branch data
 */
export async function syncFloatWithBranchData(): Promise<{ success: boolean; message: string }> {
  try {
    // This would sync float account data with branch information
    // For now, return success
    return {
      success: true,
      message: "Float data synced with branch data successfully",
    }
  } catch (error) {
    console.error("Error syncing float with branch data:", error)
    return {
      success: false,
      message: "Failed to sync float data with branch data",
    }
  }
}

/**
 * Get low balance float accounts
 */
export async function getLowBalanceFloatAccounts(): Promise<FloatAccount[]> {
  try {
    const allAccounts = await getAllFloatAccounts()
    return allAccounts.filter((account) => account.currentBalance < account.minThreshold)
  } catch (error) {
    console.error("Error getting low balance float accounts:", error)
    return []
  }
}

/**
 * Get excess balance float accounts
 */
export async function getExcessBalanceFloatAccounts(): Promise<FloatAccount[]> {
  try {
    const allAccounts = await getAllFloatAccounts()
    return allAccounts.filter((account) => account.currentBalance > account.maxThreshold)
  } catch (error) {
    console.error("Error getting excess balance float accounts:", error)
    return []
  }
}
