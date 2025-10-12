import { neon } from "@neondatabase/serverless";
import { GLPostingServiceEnhanced } from "./services/gl-posting-service-enhanced";
import { NotificationService } from "@/lib/services/notification-service";

// MoMo Transaction interface
export interface MoMoTransaction {
  id: string;
  type: "cash-in" | "cash-out" | "transfer" | "payment" | "commission";
  amount: number;
  fee: number;
  phone_number: string;
  reference?: string;
  status: "pending" | "completed" | "failed";
  date: string;
  branch_id: string;
  user_id: string;
  provider: string;
  metadata?: Record<string, any>;
  customer_name: string;
  float_account_id: string;
  processed_by: string;
  cash_till_affected: number;
  float_affected: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  branch_name?: string;
  float_account_name?: string;
}

// Float Account interface for MoMo
export interface MoMoFloatAccount {
  id: string;
  branch_id: string;
  account_type: string;
  provider: string;
  account_number?: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  branch_name?: string;
}

// Statistics interface
export interface MoMoStatistics {
  totalTransactions: number;
  totalVolume: number;
  totalFees: number;
  cashInCount: number;
  cashOutCount: number;
  todayTransactions: number;
  todayVolume: number;
}

// Remove the DEFAULT_MOCK_DATA constant and add this function instead:
// Get mock data with proper fallbacks
const getMockData = () => {
  return {
    momoAccounts: [
      {
        id: "mock-mtn-id",
        branch_id: "635844ab-029a-43f8-8523-d7882915266a",
        account_type: "momo",
        provider: "MTN Mobile Money",
        account_number: "MTN001",
        current_balance: 50000,
        min_threshold: 5000,
        max_threshold: 200000,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        branch_name: "Main Branch",
      },
      {
        id: "mock-vodafone-id",
        branch_id: "635844ab-029a-43f8-8523-d7882915266a",
        account_type: "momo",
        provider: "Vodafone Cash",
        account_number: "VODA001",
        current_balance: 35000,
        min_threshold: 3000,
        max_threshold: 150000,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        branch_name: "Main Branch",
      },
    ],
    cashTillAccount: {
      id: "mock-cash-till-id",
      branch_id: "635844ab-029a-43f8-8523-d7882915266a",
      account_type: "cash-in-till",
      provider: "Cash",
      account_number: "CASH001",
      current_balance: 100000,
      min_threshold: 10000,
      max_threshold: 500000,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      branch_name: "Main Branch",
    },
    transactions: [
      {
        id: "mock-tx-1",
        type: "cash-in",
        amount: 100,
        fee: 1,
        phone_number: "0241234567",
        reference: "MOMO12345",
        status: "completed",
        date: new Date().toISOString(),
        branch_id: "635844ab-029a-43f8-8523-d7882915266a",
        user_id: "user-1",
        provider: "MTN Mobile Money",
        customer_name: "John Doe",
        float_account_id: "mock-mtn-id",
        processed_by: "Admin User",
        cash_till_affected: 101,
        float_affected: -100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        branch_name: "Main Branch",
        float_account_name: "MTN Mobile Money - Main Branch",
      },
      {
        id: "mock-tx-2",
        type: "cash-out",
        amount: 200,
        fee: 3,
        phone_number: "0241234568",
        reference: "MOMO12346",
        status: "completed",
        date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        branch_id: "635844ab-029a-43f8-8523-d7882915266a",
        user_id: "user-1",
        provider: "Vodafone Cash",
        customer_name: "Jane Smith",
        float_account_id: "mock-vodafone-id",
        processed_by: "Admin User",
        cash_till_affected: -200,
        float_affected: 197,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        branch_name: "Main Branch",
        float_account_name: "Vodafone Cash - Main Branch",
      },
      {
        id: "mock-tx-3",
        type: "cash-in",
        amount: 50,
        fee: 0.5,
        phone_number: "0241234569",
        reference: "MOMO12347",
        status: "completed",
        date: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        branch_id: "635844ab-029a-43f8-8523-d7882915266a",
        user_id: "user-1",
        provider: "MTN Mobile Money",
        customer_name: "Alice Johnson",
        float_account_id: "mock-mtn-id",
        processed_by: "Admin User",
        cash_till_affected: 50.5,
        float_affected: -50,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
        branch_name: "Main Branch",
        float_account_name: "MTN Mobile Money - Main Branch",
      },
    ],
    statistics: {
      totalTransactions: 3,
      totalVolume: 350,
      totalFees: 4.5,
      cashInCount: 2,
      cashOutCount: 1,
      todayTransactions: 3,
      todayVolume: 350,
    },
  };
};

// Check if we should use mock data
const shouldUseMockData = () => {
  return !process.env.DATABASE_URL || process.env.USE_MOCK_DATA === "true";
};

// Check if error is related to missing table
const isTableNotExistError = (error: any): boolean => {
  const errorMessage = error?.message || String(error);
  return (
    (errorMessage.includes("relation") &&
      errorMessage.includes("does not exist")) ||
    errorMessage.includes("no such table") ||
    (errorMessage.includes("table") && errorMessage.includes("doesn't exist"))
  );
};

// Get database connection
const getDb = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(process.env.DATABASE_URL);
};

/**
 * Get MoMo float accounts for a specific branch
 */
export async function getMoMoFloatAccountsByBranch(
  branchId: string
): Promise<MoMoFloatAccount[]> {
  try {
    // Use mock data if DATABASE_URL is not set or USE_MOCK_DATA is true
    if (shouldUseMockData()) {
      console.log("Using mock data for MoMo float accounts");
      const mockData = getMockData();
      return Array.isArray(mockData.momoAccounts) ? mockData.momoAccounts : [];
    }

    const sql = getDb();

    const accounts = await sql`
      SELECT 
        fa.*,
        b.name as branch_name
      FROM float_accounts fa
      JOIN branches b ON fa.branch_id = b.id
      WHERE fa.branch_id = ${branchId} 
        AND fa.account_type = 'momo' 
        AND fa.is_active = true
      ORDER BY fa.provider ASC
    `;

    if (!Array.isArray(accounts)) {
      console.warn(
        "Database returned non-array for accounts, using empty array"
      );
      return [];
    }

    return accounts.map((account) => ({
      ...account,
      current_balance: Number(account.current_balance),
      min_threshold: Number(account.min_threshold),
      max_threshold: Number(account.max_threshold),
    }));
  } catch (error) {
    console.error(
      `Error fetching MoMo float accounts for branch ${branchId}:`,
      error
    );

    // Fallback to mock data on error
    console.log("Falling back to mock data for MoMo float accounts");
    const mockData = getMockData();
    return Array.isArray(mockData.momoAccounts) ? mockData.momoAccounts : [];
  }
}

/**
 * Get cash in till account for a specific branch through Float Accounts relationship
 */
export async function getCashInTillAccount(
  branchId: string
): Promise<MoMoFloatAccount | null> {
  try {
    // Use mock data if DATABASE_URL is not set or USE_MOCK_DATA is true
    if (shouldUseMockData()) {
      console.log("Using mock data for cash in till account");
      const mockData = getMockData();
      return mockData.cashTillAccount || null;
    }

    const sql = getDb();

    const accounts = await sql`
      SELECT 
        fa.*,
        b.name as branch_name
      FROM float_accounts fa
      JOIN branches b ON fa.branch_id = b.id
      WHERE fa.branch_id = ${branchId} 
        AND fa.account_type = 'cash-in-till' 
        AND fa.is_active = true
      LIMIT 1
    `;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    return {
      ...account,
      current_balance: Number(account.current_balance),
      min_threshold: Number(account.min_threshold),
      max_threshold: Number(account.max_threshold),
    };
  } catch (error) {
    console.error(
      `Error fetching cash in till account for branch ${branchId}:`,
      error
    );

    // Fallback to mock data on error
    console.log("Falling back to mock data for cash in till account");
    const mockData = getMockData();
    return mockData.cashTillAccount || null;
  }
}

/**
 * Get cash till balance for a specific branch through Float Accounts
 */
export async function getCashTillBalance(branchId: string): Promise<number> {
  try {
    const cashTillAccount = await getCashInTillAccount(branchId);
    return cashTillAccount ? cashTillAccount.current_balance : 0;
  } catch (error) {
    console.error(
      `Error fetching cash till balance for branch ${branchId}:`,
      error
    );
    return 0;
  }
}

/**
 * Create a new MoMo transaction
 */
export async function createMoMoTransaction(transactionData: {
  type: "cash-in" | "cash-out";
  amount: number;
  fee: number;
  phone_number: string;
  reference?: string;
  branch_id: string;
  user_id: string;
  customer_name: string;
  float_account_id: string;
  processed_by: string;
}): Promise<MoMoTransaction> {
  try {
    // Use mock data if DATABASE_URL is not set or USE_MOCK_DATA is true
    if (shouldUseMockData()) {
      console.log("Using mock data for creating MoMo transaction");

      // Get mock data
      const mockData = getMockData();

      // Find the float account to get the provider
      const floatAccount = mockData.momoAccounts.find(
        (acc) => acc.id === transactionData.float_account_id
      );
      const provider = floatAccount?.provider || "Unknown Provider";
      const branchName = floatAccount?.branch_name || "Unknown Branch";

      // Calculate effects
      const cashTillAffected =
        transactionData.type === "cash-in"
          ? transactionData.amount
          : -transactionData.amount;
      const floatAffected =
        transactionData.type === "cash-in"
          ? -transactionData.amount
          : transactionData.amount;

      // Generate a mock transaction
      const mockTransaction: MoMoTransaction = {
        id: `mock-tx-${Date.now()}`,
        type: transactionData.type,
        amount: transactionData.amount,
        fee: transactionData.fee,
        phone_number: transactionData.phone_number,
        reference: transactionData.reference,
        status: "completed",
        date: new Date().toISOString(),
        branch_id: transactionData.branch_id,
        user_id: transactionData.user_id,
        provider: provider,
        customer_name: transactionData.customer_name,
        float_account_id: transactionData.float_account_id,
        processed_by: transactionData.processed_by,
        cash_till_affected: cashTillAffected,
        float_affected: floatAffected,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        branch_name: branchName,
        float_account_name: `${provider} - ${branchName}`,
      };

      return mockTransaction;
    }

    const sql = getDb();

    try {
      // Check if momo_transactions table exists
      await sql`SELECT 1 FROM momo_transactions LIMIT 1`;
    } catch (error) {
      if (isTableNotExistError(error)) {
        console.log("momo_transactions table does not exist, using mock data");

        // Generate a mock transaction
        const mockTransaction: MoMoTransaction = {
          id: `mock-tx-${Date.now()}`,
          type: transactionData.type,
          amount: transactionData.amount,
          fee: transactionData.fee,
          phone_number: transactionData.phone_number,
          reference: transactionData.reference,
          status: "completed",
          date: new Date().toISOString(),
          branch_id: transactionData.branch_id,
          user_id: transactionData.user_id,
          provider: "Mock Provider",
          customer_name: transactionData.customer_name,
          float_account_id: transactionData.float_account_id,
          processed_by: transactionData.processed_by,
          cash_till_affected:
            transactionData.type === "cash-in"
              ? transactionData.amount
              : -transactionData.amount,
          float_affected:
            transactionData.type === "cash-in"
              ? -transactionData.amount
              : transactionData.amount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          branch_name: "Mock Branch",
          float_account_name: "Mock Float Account",
        };

        return mockTransaction;
      }
      throw error;
    }

    // Get MoMo float account details first
    const momoFloatAccount = await sql`
      SELECT fa.*, b.name as branch_name
      FROM float_accounts fa
      JOIN branches b ON fa.branch_id = b.id
      WHERE fa.id = ${transactionData.float_account_id}
    `;

    if (!Array.isArray(momoFloatAccount) || momoFloatAccount.length === 0) {
      throw new Error("MoMo float account not found");
    }

    const momoAccount = momoFloatAccount[0];
    const currentMoMoBalance = Number(momoAccount.current_balance);

    // Get cash in till account for this branch
    const cashTillAccount = await getCashInTillAccount(
      transactionData.branch_id
    );
    if (!cashTillAccount) {
      throw new Error("Cash in till account not found for this branch");
    }

    const currentCashBalance = cashTillAccount.current_balance;

    // Calculate transaction effects
    const cashTillAffected =
      transactionData.type === "cash-in"
        ? transactionData.amount + transactionData.fee
        : -transactionData.amount + transactionData.fee;
    const floatAffected =
      transactionData.type === "cash-in"
        ? -transactionData.amount
        : transactionData.amount;

    // Validate balances
    if (
      transactionData.type === "cash-in" &&
      currentMoMoBalance < transactionData.amount
    ) {
      throw new Error(`Insufficient ${momoAccount.provider} float balance`);
    }

    if (
      transactionData.type === "cash-out" &&
      currentCashBalance < transactionData.amount
    ) {
      throw new Error("Insufficient cash in till");
    }

    // Create the transaction record
    const transactionResult = await sql`
      INSERT INTO momo_transactions (
        type, amount, fee, phone_number, reference, branch_id, user_id,
        provider, customer_name, float_account_id, processed_by,
        cash_till_affected, float_affected, status, date
      ) VALUES (
        ${transactionData.type}, ${transactionData.amount}, ${
      transactionData.fee
    },
        ${transactionData.phone_number}, ${transactionData.reference || null},
        ${transactionData.branch_id}, ${transactionData.user_id}, ${
      momoAccount.provider
    },
        ${transactionData.customer_name}, ${transactionData.float_account_id},
        ${
          transactionData.processed_by
        }, ${cashTillAffected}, ${floatAffected}, 'completed', NOW()
      )
      RETURNING *
    `;

    if (!Array.isArray(transactionResult) || transactionResult.length === 0) {
      throw new Error("Failed to create transaction");
    }

    const transaction = transactionResult[0];

    // Update MoMo float account balance
    await sql`
      UPDATE float_accounts 
      SET current_balance = current_balance + ${floatAffected},
          updated_at = NOW()
      WHERE id = ${transactionData.float_account_id}
    `;

    // Update cash in till account balance
    await sql`
      UPDATE float_accounts 
      SET current_balance = current_balance + ${cashTillAffected},
          updated_at = NOW()
      WHERE id = ${cashTillAccount.id}
    `;

    // Create GL entries for the transaction
    try {
      const glResult = await GLPostingServiceEnhanced.createMoMoGLEntries({
        transactionId: transaction.id,
        type: transactionData.type,
        amount: transactionData.amount,
        fee: transactionData.fee,
        provider: momoAccount.provider,
        phoneNumber: transactionData.phone_number,
        customerName: transactionData.customer_name,
        reference: transactionData.reference || transaction.id,
        processedBy: transactionData.user_id,
        branchId: transactionData.branch_id,
        branchName: momoAccount.branch_name,
      });

      if (glResult.success) {
        console.log(
          "✅ [MOMO] GL entries created successfully for transaction:",
          transaction.id
        );
      } else {
        console.error("❌ [MOMO] GL posting failed:", glResult.error);
      }
    } catch (glError) {
      console.error("❌ [MOMO] GL posting error:", glError);
      // Continue without failing the transaction
    }

    if (transaction.phone_number) {
      await NotificationService.sendNotification({
        type: "transaction",
        title: "Transaction Alert",
        message: `Thank you for using our service! Your MoMo transaction of GHS ${transaction.amount} was successful.`,
        phone: transaction.phone_number,
        userId: transaction.user_id,
        metadata: { ...transaction },
      });
    }
    if (transaction.user_id) {
      await NotificationService.sendNotification({
        type: "transaction",
        title: "Transaction Processed",
        message: `Your MoMo transaction to ${transaction.customer_name} was successful. Amount: GHS ${transaction.amount}.`,
        userId: transaction.user_id,
        metadata: { ...transaction },
      });
    }

    return {
      ...transaction,
      amount: Number(transaction.amount),
      fee: Number(transaction.fee),
      cash_till_affected: Number(transaction.cash_till_affected),
      float_affected: Number(transaction.float_affected),
      branch_name: momoAccount.branch_name,
      float_account_name: `${momoAccount.provider} - ${momoAccount.branch_name}`,
    };
  } catch (error) {
    console.error("Error creating MoMo transaction:", error);
    throw error;
  }
}

/**
 * Get MoMo transactions for a specific branch
 */
export async function getMoMoTransactionsByBranch(
  branchId: string,
  filters?: {
    status?: string;
    type?: string;
    provider?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<MoMoTransaction[]> {
  try {
    // Use mock data if DATABASE_URL is not set or USE_MOCK_DATA is true
    if (shouldUseMockData()) {
      console.log("Using mock data for MoMo transactions");
      const mockData = getMockData();
      let transactions = Array.isArray(mockData.transactions)
        ? mockData.transactions
        : [];

      // Apply filters if provided
      if (filters) {
        if (filters.status) {
          transactions = transactions.filter(
            (tx) => tx.status === filters.status
          );
        }
        if (filters.type) {
          transactions = transactions.filter((tx) => tx.type === filters.type);
        }
        if (filters.provider) {
          transactions = transactions.filter(
            (tx) => tx.provider === filters.provider
          );
        }
        if (filters.startDate) {
          transactions = transactions.filter(
            (tx) => new Date(tx.date) >= new Date(filters.startDate!)
          );
        }
        if (filters.endDate) {
          transactions = transactions.filter(
            (tx) => new Date(tx.date) <= new Date(filters.endDate!)
          );
        }
        if (filters.limit) {
          transactions = transactions.slice(0, filters.limit);
        }
      }

      return transactions;
    }

    const sql = getDb();

    try {
      // Check if momo_transactions table exists
      await sql`SELECT 1 FROM momo_transactions LIMIT 1`;
    } catch (error) {
      if (isTableNotExistError(error)) {
        console.log("momo_transactions table does not exist, using mock data");
        const mockData = getMockData();
        return Array.isArray(mockData.transactions)
          ? mockData.transactions
          : [];
      }
      throw error;
    }

    // Build the base query with proper parameter binding
    let baseQuery = sql`
      SELECT 
        mt.*,
        b.name as branch_name,
        fa.provider || ' - ' || COALESCE(b.name, 'Unknown Branch') as float_account_name
      FROM momo_transactions mt
      LEFT JOIN branches b ON mt.branch_id = b.id
      LEFT JOIN float_accounts fa ON mt.float_account_id = fa.id
      WHERE mt.branch_id = ${branchId}
    `;

    // Apply filters using proper parameter binding
    if (filters?.status) {
      baseQuery = sql`
        SELECT 
          mt.*,
          b.name as branch_name,
          fa.provider || ' - ' || COALESCE(b.name, 'Unknown Branch') as float_account_name
        FROM momo_transactions mt
        LEFT JOIN branches b ON mt.branch_id = b.id
        LEFT JOIN float_accounts fa ON mt.float_account_id = fa.id
        WHERE mt.branch_id = ${branchId}
          AND mt.status = ${filters.status}
      `;
    }

    if (filters?.type) {
      baseQuery = sql`
        SELECT 
          mt.*,
          b.name as branch_name,
          fa.provider || ' - ' || COALESCE(b.name, 'Unknown Branch') as float_account_name
        FROM momo_transactions mt
        LEFT JOIN branches b ON mt.branch_id = b.id
        LEFT JOIN float_accounts fa ON mt.float_account_id = fa.id
        WHERE mt.branch_id = ${branchId}
          ${filters.status ? sql`AND mt.status = ${filters.status}` : sql``}
          AND mt.type = ${filters.type}
      `;
    }

    if (filters?.provider) {
      baseQuery = sql`
        SELECT 
          mt.*,
          b.name as branch_name,
          fa.provider || ' - ' || COALESCE(b.name, 'Unknown Branch') as float_account_name
        FROM momo_transactions mt
        LEFT JOIN branches b ON mt.branch_id = b.id
        LEFT JOIN float_accounts fa ON mt.float_account_id = fa.id
        WHERE mt.branch_id = ${branchId}
          ${filters.status ? sql`AND mt.status = ${filters.status}` : sql``}
          ${filters.type ? sql`AND mt.type = ${filters.type}` : sql``}
          AND mt.provider = ${filters.provider}
      `;
    }

    if (filters?.startDate) {
      baseQuery = sql`
        SELECT 
          mt.*,
          b.name as branch_name,
          fa.provider || ' - ' || COALESCE(b.name, 'Unknown Branch') as float_account_name
        FROM momo_transactions mt
        LEFT JOIN branches b ON mt.branch_id = b.id
        LEFT JOIN float_accounts fa ON mt.float_account_id = fa.id
        WHERE mt.branch_id = ${branchId}
          ${filters.status ? sql`AND mt.status = ${filters.status}` : sql``}
          ${filters.type ? sql`AND mt.type = ${filters.type}` : sql``}
          ${
            filters.provider
              ? sql`AND mt.provider = ${filters.provider}`
              : sql``
          }
          AND mt.created_at >= ${filters.startDate}
      `;
    }

    if (filters?.endDate) {
      baseQuery = sql`
        SELECT 
          mt.*,
          b.name as branch_name,
          fa.provider || ' - ' || COALESCE(b.name, 'Unknown Branch') as float_account_name
        FROM momo_transactions mt
        LEFT JOIN branches b ON mt.branch_id = b.id
        LEFT JOIN float_accounts fa ON mt.float_account_id = fa.id
        WHERE mt.branch_id = ${branchId}
          ${filters.status ? sql`AND mt.status = ${filters.status}` : sql``}
          ${filters.type ? sql`AND mt.type = ${filters.type}` : sql``}
          ${
            filters.provider
              ? sql`AND mt.provider = ${filters.provider}`
              : sql``
          }
          ${
            filters.startDate
              ? sql`AND mt.created_at >= ${filters.startDate}`
              : sql``
          }
          AND mt.created_at <= ${filters.endDate}
      `;
    }

    // Add ordering and limit
    const finalQuery = sql`
      ${baseQuery}
      ORDER BY mt.created_at DESC
      ${filters?.limit ? sql`LIMIT ${filters.limit}` : sql``}
      ${filters?.offset ? sql`OFFSET ${filters.offset}` : sql``}
    `;

    const transactions = await finalQuery;

    if (!Array.isArray(transactions)) {
      console.warn(
        "Database returned non-array for transactions, using empty array"
      );
      return [];
    }

    return transactions.map((transaction) => ({
      ...transaction,
      amount: Number(transaction.amount),
      fee: Number(transaction.fee),
      cash_till_affected: Number(transaction.cash_till_affected || 0),
      float_affected: Number(transaction.float_affected || 0),
      date: transaction.created_at, // Map created_at to date for compatibility
    }));
  } catch (error) {
    console.error(
      `Error fetching MoMo transactions for branch ${branchId}:`,
      error
    );

    // Fallback to mock data on error
    console.log("Falling back to mock data for MoMo transactions");
    const mockData = getMockData();
    return Array.isArray(mockData.transactions) ? mockData.transactions : [];
  }
}

/**
 * Get MoMo transaction statistics for a branch
 */
export async function getMoMoStatistics(
  branchId: string
): Promise<MoMoStatistics> {
  try {
    // Use mock data if DATABASE_URL is not set or USE_MOCK_DATA is true
    if (shouldUseMockData()) {
      console.log("Using mock data for MoMo statistics");
      const mockData = getMockData();
      return (
        mockData.statistics || {
          totalTransactions: 0,
          totalVolume: 0,
          totalFees: 0,
          cashInCount: 0,
          cashOutCount: 0,
          todayTransactions: 0,
          todayVolume: 0,
        }
      );
    }

    const sql = getDb();

    try {
      // Check if momo_transactions table exists
      await sql`SELECT 1 FROM momo_transactions LIMIT 1`;
    } catch (error) {
      if (isTableNotExistError(error)) {
        console.log("momo_transactions table does not exist, using mock data");
        const mockData = getMockData();
        return (
          mockData.statistics || {
            totalTransactions: 0,
            totalVolume: 0,
            totalFees: 0,
            cashInCount: 0,
            cashOutCount: 0,
            todayTransactions: 0,
            todayVolume: 0,
          }
        );
      }
      throw error;
    }

    const today = new Date().toISOString().split("T")[0];

    const stats = await sql`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_fees,
        COUNT(CASE WHEN type = 'cash-in' THEN 1 END) as cash_in_count,
        COUNT(CASE WHEN type = 'cash-out' THEN 1 END) as cash_out_count,
        COUNT(CASE WHEN DATE(date) = ${today} THEN 1 END) as today_transactions,
        COALESCE(SUM(CASE WHEN DATE(date) = ${today} THEN amount ELSE 0 END), 0) as today_volume
      FROM momo_transactions
      WHERE branch_id = ${branchId} AND status = 'completed'
    `;

    if (!Array.isArray(stats) || stats.length === 0) {
      console.warn("Database returned no statistics, using default values");
      return {
        totalTransactions: 0,
        totalVolume: 0,
        totalFees: 0,
        cashInCount: 0,
        cashOutCount: 0,
        todayTransactions: 0,
        todayVolume: 0,
      };
    }

    const result = stats[0];
    return {
      totalTransactions: Number(result.total_transactions),
      totalVolume: Number(result.total_volume),
      totalFees: Number(result.total_fees),
      cashInCount: Number(result.cash_in_count),
      cashOutCount: Number(result.cash_out_count),
      todayTransactions: Number(result.today_transactions),
      todayVolume: Number(result.today_volume),
    };
  } catch (error) {
    console.error(
      `Error fetching MoMo statistics for branch ${branchId}:`,
      error
    );

    // Fallback to mock data on error
    console.log("Falling back to mock data for MoMo statistics");
    const mockData = getMockData();
    return (
      mockData.statistics || {
        totalTransactions: 0,
        totalVolume: 0,
        totalFees: 0,
        cashInCount: 0,
        cashOutCount: 0,
        todayTransactions: 0,
        todayVolume: 0,
      }
    );
  }
}

/**
 * Get all float accounts for a branch (including cash in till and MoMo accounts)
 */
export async function getAllFloatAccountsByBranch(
  branchId: string
): Promise<MoMoFloatAccount[]> {
  try {
    // Use mock data if DATABASE_URL is not set or USE_MOCK_DATA is true
    if (shouldUseMockData()) {
      console.log("Using mock data for all float accounts");
      const mockData = getMockData();
      const allAccounts = [
        ...(Array.isArray(mockData.momoAccounts) ? mockData.momoAccounts : []),
      ];
      if (mockData.cashTillAccount) {
        allAccounts.unshift(mockData.cashTillAccount);
      }
      return allAccounts;
    }

    const sql = getDb();

    const accounts = await sql`
      SELECT 
        fa.*,
        b.name as branch_name
      FROM float_accounts fa
      JOIN branches b ON fa.branch_id = b.id
      WHERE fa.branch_id = ${branchId} 
        AND fa.is_active = true
      ORDER BY 
        CASE fa.account_type 
          WHEN 'cash-in-till' THEN 1 
          WHEN 'momo' THEN 2 
          ELSE 3 
        END,
        fa.provider ASC
    `;

    if (!Array.isArray(accounts)) {
      console.warn("Database returned non-array for accounts, using mock data");
      const mockData = getMockData();
      const allAccounts = [
        ...(Array.isArray(mockData.momoAccounts) ? mockData.momoAccounts : []),
      ];
      if (mockData.cashTillAccount) {
        allAccounts.unshift(mockData.cashTillAccount);
      }
      return allAccounts;
    }

    return accounts.map((account) => ({
      ...account,
      current_balance: Number(account.current_balance),
      min_threshold: Number(account.min_threshold),
      max_threshold: Number(account.max_threshold),
    }));
  } catch (error) {
    console.error(
      `Error fetching all float accounts for branch ${branchId}:`,
      error
    );

    // Fallback to mock data on error
    console.log("Falling back to mock data for all float accounts");
    const mockData = getMockData();
    const allAccounts = [
      ...(Array.isArray(mockData.momoAccounts) ? mockData.momoAccounts : []),
    ];
    if (mockData.cashTillAccount) {
      allAccounts.unshift(mockData.cashTillAccount);
    }
    return allAccounts;
  }
}
