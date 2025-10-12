import { fileExists, readJsonFile, writeJsonFile } from "./file-utils";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.CONNECTION_STRING!);

// File paths
const GL_DATABASE_PATH = "data/gl-database.json";
const GL_TRANSACTIONS_PATH = "data/gl-transactions.json";
const GL_BALANCES_PATH = "data/gl-balances.json";
const GL_SYNC_LOG_PATH = "data/gl-sync-log.json";

// GL Account Types
export type GLAccountType =
  | "Asset"
  | "Liability"
  | "Equity"
  | "Revenue"
  | "Expense";

// GL Account Structure
export interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  parentId?: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// GL Transaction Structure
export interface GLTransaction {
  id: string;
  date: string;
  sourceModule: string;
  sourceTransactionId: string;
  sourceTransactionType: string;
  description: string;
  entries: GLTransactionEntry[];
  status: "pending" | "posted" | "reversed";
  createdBy: string;
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  branchId?: string;
  metadata?: Record<string, any>;
}

// GL Transaction Entry
export interface GLTransactionEntry {
  accountId: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
  metadata?: Record<string, any>;
}

// GL Account Balance
export interface GLAccountBalance {
  accountId: string;
  accountCode: string;
  currentBalance: number;
  lastUpdated: string;
  periodBalances: {
    [period: string]: number; // Format: YYYY-MM
  };
}

// GL Sync Log Entry
export interface GLSyncLogEntry {
  id: string;
  timestamp: string;
  module: "momo" | "agency-banking" | "commissions" | "expenses" | "system";
  operation: "sync" | "update" | "create" | "delete" | "error";
  status: "success" | "failed" | "partial";
  details: string;
  affectedRecords?: number;
  error?: string;
}

export interface SyncLogEntry {
  id?: string;
  module: string;
  operation: string;
  status: "success" | "failed" | "pending";
  details: string;
  error?: string;
  createdAt?: string;
}

/**
 * GL Database service for managing GL accounts and transactions
 */
export class GLDatabase {
  /**
   * Get GL account by code
   */
  static async getGLAccountByCode(code: string): Promise<GLAccount | null> {
    try {
      const accounts = await sql`
        SELECT id, code, name, type, parent_id as "parentId", 
               COALESCE(balance, 0) as balance, is_active as "isActive",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM gl_accounts 
        WHERE code = ${code} AND is_active = true
      `;

      if (accounts.length === 0) return null;
      return accounts[0];
    } catch (error) {
      console.error(`Error fetching GL account by code ${code}:`, error);
      return null;
    }
  }

  /**
   * Get GL account by ID
   */
  static async getGLAccountById(id: string): Promise<GLAccount | null> {
    try {
      const accounts = await sql`
        SELECT id, code, name, type, parent_id as "parentId", 
               COALESCE(balance, 0) as balance, is_active as "isActive",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM gl_accounts 
        WHERE id = ${id} AND is_active = true
      `;

      if (accounts.length === 0) return null;
      return accounts[0];
    } catch (error) {
      console.error(`Error fetching GL account by ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new GL account
   */
  static async createGLAccount(account: {
    code: string;
    name: string;
    type: string;
    parentCode?: string;
    description?: string;
  }): Promise<GLAccount> {
    try {
      // Check if account already exists
      const existing = await this.getGLAccountByCode(account.code);
      if (existing) {
        console.log(
          `GL account ${account.code} already exists, returning existing account`
        );
        return existing;
      }

      // Normalize the type to match our enum
      let normalizedType = account.type.toLowerCase();
      if (normalizedType === "asset") normalizedType = "Asset";
      else if (normalizedType === "liability") normalizedType = "Liability";
      else if (normalizedType === "equity") normalizedType = "Equity";
      else if (normalizedType === "revenue") normalizedType = "Revenue";
      else normalizedType = account.type; // Use as-is if already properly formatted

      // Generate a UUID for the ID
      const uuidResult = await sql`SELECT gen_random_uuid() as id`;
      const accountId = uuidResult[0].id;

      const newAccount = await sql`
        INSERT INTO gl_accounts (id, code, name, type, parent_id, balance, is_active)
        VALUES (${accountId}, ${account.code}, ${
        account.name
      }, ${normalizedType}, ${null}, 0, true)
        RETURNING id, code, name, type, parent_id as "parentId", 
                  COALESCE(balance, 0) as balance, is_active as "isActive",
                  created_at as "createdAt", updated_at as "updatedAt"
      `;

      console.log(`Created GL account: ${account.code} - ${account.name}`);
      return newAccount[0];
    } catch (error) {
      console.error("Error creating GL account:", error);
      throw error;
    }
  }

  /**
   * Get GL transactions by source transaction ID
   */
  static async getGLTransactionsBySourceId(
    sourceTransactionId: string
  ): Promise<GLTransaction[]> {
    try {
      const transactions = await sql`
        SELECT id, date, source_module as "sourceModule", 
               source_transaction_id as "sourceTransactionId",
               source_transaction_type as "sourceTransactionType",
               description, status, created_by as "createdBy",
               created_at as "createdAt", posted_by as "postedBy",
               posted_at as "postedAt", metadata
        FROM gl_transactions 
        WHERE source_transaction_id = ${sourceTransactionId}
      `;

      // For each transaction, get its entries
      for (const transaction of transactions) {
        const entries = await sql`
          SELECT account_id as "accountId", account_code as "accountCode",
                 debit, credit, description, metadata
          FROM gl_journal_entries
          WHERE transaction_id = ${transaction.id}
        `;
        transaction.entries = entries;
      }

      return transactions;
    } catch (error) {
      console.error(
        `Error fetching GL transactions for source ID ${sourceTransactionId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Create a new GL transaction
   */
  static async createGLTransaction(
    transaction: Omit<GLTransaction, "id" | "createdAt">
  ): Promise<GLTransaction> {
    try {
      // Generate a UUID for the transaction ID
      const uuidResult = await sql`SELECT gen_random_uuid() as id`;
      const transactionId = uuidResult[0].id;

      console.log(`Creating GL transaction with ID: ${transactionId}`);

      // Insert the main transaction record
      const newTransaction = await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_id, source_transaction_type,
          description, status, created_by, metadata${
            transaction.branchId ? ", branch_id" : ""
          }
        )
        VALUES (
          ${transactionId}, ${transaction.date}, ${transaction.sourceModule},
          ${transaction.sourceTransactionId}, ${
        transaction.sourceTransactionType
      },
          ${transaction.description}, ${transaction.status || "pending"}, ${
        transaction.createdBy
      },
          ${JSON.stringify(transaction.metadata || {})}${
        transaction.branchId ? ", " + transaction.branchId : ""
      }
        )
        RETURNING id, date, source_module as "sourceModule", 
                  source_transaction_id as "sourceTransactionId",
                  source_transaction_type as "sourceTransactionType",
                  description, status, created_by as "createdBy",
                  created_at as "createdAt", metadata${
                    transaction.branchId ? ', branch_id as "branchId"' : ""
                  }
      `;

      console.log(`GL transaction record created: ${newTransaction[0].id}`);

      // Insert the journal entries
      for (const entry of transaction.entries) {
        console.log(
          `Creating journal entry for account: ${entry.accountCode} (${entry.accountId})`
        );

        await sql`
          INSERT INTO gl_journal_entries (
            transaction_id, account_id, account_code, debit, credit, description, metadata
          )
          VALUES (
            ${transactionId}, ${entry.accountId}, ${entry.accountCode},
            ${entry.debit}, ${entry.credit}, ${entry.description},
            ${JSON.stringify(entry.metadata || {})}
          )
        `;
      }

      console.log(`Created ${transaction.entries.length} journal entries`);

      return { ...newTransaction[0], entries: transaction.entries };
    } catch (error) {
      console.error("Error creating GL transaction:", error);
      console.error("Transaction data:", JSON.stringify(transaction, null, 2));
      throw error;
    }
  }

  /**
   * Post a GL transaction (mark as posted)
   */
  static async postGLTransaction(
    transactionId: string,
    postedBy: string
  ): Promise<void> {
    try {
      await sql`
        UPDATE gl_transactions 
        SET status = 'posted', posted_by = ${postedBy}, posted_at = NOW()
        WHERE id = ${transactionId}
      `;

      // Update account balances
      const entries = await sql`
        SELECT account_id, debit, credit
        FROM gl_journal_entries 
        WHERE transaction_id = ${transactionId}
      `;

      for (const entry of entries) {
        if (entry.debit > 0) {
          await sql`
            UPDATE gl_accounts 
            SET balance = COALESCE(balance, 0) + ${entry.debit}
            WHERE id = ${entry.account_id}
          `;
        }
        if (entry.credit > 0) {
          await sql`
            UPDATE gl_accounts 
            SET balance = COALESCE(balance, 0) - ${entry.credit}
            WHERE id = ${entry.account_id}
          `;
        }
      }
    } catch (error) {
      console.error(`Error posting GL transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Add a sync log entry
   */
  static async addSyncLogEntry(
    entry: Omit<SyncLogEntry, "id" | "createdAt">
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO gl_sync_logs (module, operation, status, details, error)
        VALUES (${entry.module}, ${entry.operation}, ${entry.status}, ${
        entry.details
      }, ${entry.error || null})
      `;
    } catch (error) {
      console.error("Error adding sync log entry:", error);
      // Don't throw here as this is just logging
    }
  }

  /**
   * Ensure required GL accounts exist
   */
  static async ensureGLAccountsExist(): Promise<void> {
    const requiredAccounts = [
      { code: "1001", name: "Cash", type: "Asset" },
      { code: "1002", name: "E-Zwich Settlement Account", type: "Asset" },
      { code: "1003", name: "Petty Cash / Float Account", type: "Asset" },
      { code: "1004", name: "Power Float Account", type: "Asset" },
      { code: "2001", name: "Customer Liability", type: "Liability" },
      { code: "2002", name: "Jumia Payable", type: "Liability" },
      { code: "2003", name: "Bank Partner Liability", type: "Liability" },
      { code: "4001", name: "MoMo Commission Revenue", type: "Revenue" },
      { code: "4002", name: "E-Zwich Revenue", type: "Revenue" },
      { code: "4003", name: "Transaction Fee Income", type: "Revenue" },
      { code: "4004", name: "Power Commission Revenue", type: "Revenue" },
      { code: "4005", name: "Jumia Commission Revenue", type: "Revenue" },
      { code: "5001", name: "General Expenses", type: "Expense" },
    ];

    for (const account of requiredAccounts) {
      const existing = await this.getGLAccountByCode(account.code);
      if (!existing) {
        try {
          await this.createGLAccount(account);
          console.log(
            `Created missing GL account: ${account.code} - ${account.name}`
          );
        } catch (error) {
          console.error(`Failed to create GL account ${account.code}:`, error);
        }
      }
    }
  }
}

/**
 * Ensure GL accounts exist - standalone function
 */
export async function ensureGLAccountsExist(): Promise<void> {
  return GLDatabase.ensureGLAccountsExist();
}

// Initialize GL database files
async function initGLDatabaseFiles() {
  try {
    // Check and initialize GL database file
    if (!(await fileExists(GL_DATABASE_PATH))) {
      await writeJsonFile(GL_DATABASE_PATH, { accounts: [] });
    }

    // Check and initialize GL transactions file
    if (!(await fileExists(GL_TRANSACTIONS_PATH))) {
      await writeJsonFile(GL_TRANSACTIONS_PATH, { transactions: [] });
    }

    // Check and initialize GL balances file
    if (!(await fileExists(GL_BALANCES_PATH))) {
      await writeJsonFile(GL_BALANCES_PATH, { balances: [] });
    }

    // Check and initialize GL sync log file
    if (!(await fileExists(GL_SYNC_LOG_PATH))) {
      await writeJsonFile(GL_SYNC_LOG_PATH, { logs: [] });
    }

    return true;
  } catch (error) {
    console.error("Error initializing GL database files:", error);
    return false;
  }
}

// Get all GL accounts
export async function getAllGLAccounts(): Promise<GLAccount[]> {
  try {
    const accounts = await sql`
      SELECT id, code, name, type, parent_id as "parentId", 
             COALESCE(balance, 0) as balance, is_active as "isActive",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM gl_accounts 
      WHERE is_active = true
      ORDER BY code
    `;
    return accounts;
  } catch (error) {
    console.error("Error getting all GL accounts:", error);
    return [];
  }
}

// Update a GL account
export async function updateGLAccount(
  id: string,
  updates: Partial<Omit<GLAccount, "id" | "createdAt" | "updatedAt">>
): Promise<GLAccount | null> {
  try {
    await initGLDatabaseFiles();

    const data = await readJsonFile<{ accounts: GLAccount[] }>(
      GL_DATABASE_PATH
    );
    const accounts = data.accounts || [];

    const accountIndex = accounts.findIndex((account) => account.id === id);
    if (accountIndex === -1) {
      return null;
    }

    // If code is being updated, check if the new code already exists
    if (updates.code && updates.code !== accounts[accountIndex].code) {
      const existingAccount = accounts.find(
        (account) => account.code === updates.code
      );
      if (existingAccount) {
        throw new Error(`GL account with code ${updates.code} already exists`);
      }
    }

    // Update the account
    const updatedAccount = {
      ...accounts[accountIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    accounts[accountIndex] = updatedAccount;

    await writeJsonFile(GL_DATABASE_PATH, { accounts });

    // If code was updated, update the account balance record
    if (updates.code && updates.code !== accounts[accountIndex].code) {
      await updateAccountBalanceCode(id, updates.code);
    }

    // Log the update
    await GLDatabase.addSyncLogEntry({
      module: "system",
      operation: "update",
      status: "success",
      details: `Updated GL account: ${updatedAccount.code} - ${updatedAccount.name}`,
    });

    return updatedAccount;
  } catch (error) {
    console.error(`Error updating GL account ${id}:`, error);

    // Log the error
    await GLDatabase.addSyncLogEntry({
      module: "system",
      operation: "update",
      status: "failed",
      details: `Failed to update GL account ${id}`,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

// Update account balance code
async function updateAccountBalanceCode(
  accountId: string,
  newCode: string
): Promise<void> {
  try {
    const data = await readJsonFile<{ balances: GLAccountBalance[] }>(
      GL_BALANCES_PATH
    );
    const balances = data.balances || [];

    const balanceIndex = balances.findIndex(
      (balance) => balance.accountId === accountId
    );
    if (balanceIndex === -1) {
      return;
    }

    // Update the code
    balances[balanceIndex].accountCode = newCode;
    balances[balanceIndex].lastUpdated = new Date().toISOString();

    await writeJsonFile(GL_BALANCES_PATH, { balances });
  } catch (error) {
    console.error(
      `Error updating account balance code for ${accountId}:`,
      error
    );
    throw error;
  }
}

// Get account balance
export async function getAccountBalance(
  accountId: string
): Promise<GLAccountBalance | null> {
  try {
    await initGLDatabaseFiles();

    const data = await readJsonFile<{ balances: GLAccountBalance[] }>(
      GL_BALANCES_PATH
    );
    const balances = data.balances || [];

    return balances.find((balance) => balance.accountId === accountId) || null;
  } catch (error) {
    console.error(`Error getting account balance for ${accountId}:`, error);
    return null;
  }
}

// Get account balance by code
export async function getAccountBalanceByCode(
  accountCode: string
): Promise<GLAccountBalance | null> {
  try {
    await initGLDatabaseFiles();

    const data = await readJsonFile<{ balances: GLAccountBalance[] }>(
      GL_BALANCES_PATH
    );
    const balances = data.balances || [];

    return (
      balances.find((balance) => balance.accountCode === accountCode) || null
    );
  } catch (error) {
    console.error(
      `Error getting account balance for code ${accountCode}:`,
      error
    );
    return null;
  }
}

// Get GL transactions
export async function getGLTransactions(filters?: {
  status?: "pending" | "posted" | "reversed";
  sourceModule?: string;
  sourceTransactionType?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  branchId?: string;
}): Promise<GLTransaction[]> {
  try {
    await initGLDatabaseFiles();
    const data = await readJsonFile<{ transactions: GLTransaction[] }>(
      GL_TRANSACTIONS_PATH
    );
    let transactions = data.transactions || [];
    // Apply filters
    if (filters) {
      if (filters.status) {
        transactions = transactions.filter(
          (transaction) => transaction.status === filters.status
        );
      }
      if (filters.sourceModule) {
        transactions = transactions.filter(
          (transaction) => transaction.sourceModule === filters.sourceModule
        );
      }
      if (filters.sourceTransactionType) {
        transactions = transactions.filter(
          (transaction) =>
            transaction.sourceTransactionType === filters.sourceTransactionType
        );
      }
      if (filters.startDate) {
        transactions = transactions.filter(
          (transaction) => transaction.date >= filters.startDate
        );
      }
      if (filters.endDate) {
        transactions = transactions.filter(
          (transaction) => transaction.date <= filters.endDate
        );
      }
      if (filters.createdBy) {
        transactions = transactions.filter(
          (transaction) => transaction.createdBy === filters.createdBy
        );
      }
      if (filters.branchId) {
        transactions = transactions.filter(
          (transaction) => transaction.branchId === filters.branchId
        );
      }
    }
    return transactions;
  } catch (error) {
    console.error("Error getting GL transactions:", error);
    return [];
  }
}

// Get GL transaction by ID
export async function getGLTransactionById(
  id: string
): Promise<GLTransaction | null> {
  try {
    await initGLDatabaseFiles();

    const data = await readJsonFile<{ transactions: GLTransaction[] }>(
      GL_TRANSACTIONS_PATH
    );
    const transactions = data.transactions || [];

    return transactions.find((transaction) => transaction.id === id) || null;
  } catch (error) {
    console.error(`Error getting GL transaction by ID ${id}:`, error);
    return null;
  }
}

// Get sync logs
export async function getSyncLogs(
  limit = 100,
  module?: string,
  status?: "success" | "failed" | "partial"
): Promise<GLSyncLogEntry[]> {
  try {
    await initGLDatabaseFiles();

    const data = await readJsonFile<{ logs: GLSyncLogEntry[] }>(
      GL_SYNC_LOG_PATH
    );
    let logs = data.logs || [];

    // Apply filters
    if (module) {
      logs = logs.filter((log) => log.module === module);
    }

    if (status) {
      logs = logs.filter((log) => log.status === status);
    }

    // Sort by timestamp (newest first) and limit
    logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return logs.slice(0, limit);
  } catch (error) {
    console.error("Error getting sync logs:", error);
    return [];
  }
}

// Get GL account tree (with parent-child relationships)
export async function getGLAccountTree(): Promise<Record<string, any>[]> {
  try {
    const accounts = await getAllGLAccounts();

    // Group accounts by type
    const accountsByType: Record<GLAccountType, GLAccount[]> = {
      Asset: [],
      Liability: [],
      Equity: [],
      Revenue: [],
      Expense: [],
    };

    accounts.forEach((account) => {
      if (account.isActive) {
        accountsByType[account.type].push(account);
      }
    });

    // Build tree structure
    const tree: Record<string, any>[] = [];

    // Add type groups
    const typeOrder: GLAccountType[] = [
      "Asset",
      "Liability",
      "Equity",
      "Revenue",
      "Expense",
    ];

    typeOrder.forEach((type) => {
      const typeAccounts = accountsByType[type];

      if (typeAccounts.length > 0) {
        tree.push({
          id: `type-${type}`,
          name: `${type} Accounts`,
          code: "",
          type,
          isGroup: true,
          children: buildAccountTree(typeAccounts),
        });
      }
    });

    return tree;
  } catch (error) {
    console.error("Error getting GL account tree:", error);
    return [];
  }
}

// Build account tree (recursive)
function buildAccountTree(
  accounts: GLAccount[],
  parentId?: string
): Record<string, any>[] {
  const children = accounts.filter((account) => account.parentId === parentId);

  return children.map((account) => {
    const hasChildren = accounts.some((a) => a.parentId === account.id);

    return {
      id: account.id,
      name: account.name,
      code: account.code,
      type: account.type,
      isGroup: hasChildren,
      children: hasChildren ? buildAccountTree(accounts, account.id) : [],
    };
  });
}

// Get trial balance
export async function getTrialBalance(asOfDate?: string): Promise<{
  accounts: {
    id: string;
    code: string;
    name: string;
    type: GLAccountType;
    debit: number;
    credit: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}> {
  try {
    const accounts = await getAllGLAccounts();
    const balances = await readJsonFile<{ balances: GLAccountBalance[] }>(
      GL_BALANCES_PATH
    );

    const result = {
      accounts: [] as {
        id: string;
        code: string;
        name: string;
        type: GLAccountType;
        debit: number;
        credit: number;
      }[],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: false,
    };

    // Process each active account
    for (const account of accounts) {
      if (!account.isActive) continue;

      // Find the balance for this account
      const balance = balances.balances.find((b) => b.accountId === account.id);

      if (!balance) continue;

      let accountBalance = balance.currentBalance;

      // If asOfDate is provided, calculate the balance as of that date
      if (asOfDate) {
        const asOfPeriod = asOfDate.substring(0, 7); // YYYY-MM

        // Reset the balance
        accountBalance = 0;

        // Add up all period balances up to and including the asOfDate period
        for (const [period, amount] of Object.entries(balance.periodBalances)) {
          if (period <= asOfPeriod) {
            accountBalance += amount;
          }
        }
      }

      // Determine if this is a debit or credit balance based on account type
      let debit = 0;
      let credit = 0;

      if (account.type === "Asset" || account.type === "Expense") {
        // For Asset and Expense accounts, positive balance is debit, negative is credit
        if (accountBalance > 0) {
          debit = accountBalance;
        } else {
          credit = -accountBalance;
        }
      } else {
        // For Liability, Equity, and Revenue accounts, positive balance is credit, negative is debit
        if (accountBalance > 0) {
          credit = accountBalance;
        } else {
          debit = -accountBalance;
        }
      }

      // Add to result
      result.accounts.push({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
      });

      // Update totals
      result.totalDebit += debit;
      result.totalCredit += credit;
    }

    // Sort by account code
    result.accounts.sort((a, b) => a.code.localeCompare(b.code));

    // Check if balanced
    result.isBalanced = Math.abs(result.totalDebit - result.totalCredit) < 0.01;

    return result;
  } catch (error) {
    console.error("Error generating trial balance:", error);
    return {
      accounts: [],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: false,
    };
  }
}

// Export the module
export const GLDatabaseOld = {
  initGLDatabaseFiles,
  getAllGLAccounts,
  getGLAccountById: GLDatabase.getGLAccountById,
  getGLAccountByCode: GLDatabase.getGLAccountByCode,
  createGLAccount: GLDatabase.createGLAccount,
  updateGLAccount,
  getAccountBalance,
  getAccountBalanceByCode,
  createGLTransaction: GLDatabase.createGLTransaction,
  postGLTransaction: GLDatabase.postGLTransaction,
  getGLTransactions,
  getGLTransactionById,
  getGLTransactionsBySourceId: GLDatabase.getGLTransactionsBySourceId,
  addSyncLogEntry: GLDatabase.addSyncLogEntry,
  getSyncLogs,
  getGLAccountTree,
  getTrialBalance,
};

// Export the main GLDatabase class and utility functions
