import { GLDatabase, type GLTransactionEntry } from "./gl-database";
import { getMoMoTransactions } from "./momo-service";
// Note: This module is deprecated. GL sync is now automatic via UnifiedGLPostingService
// import { filterCommissions } from "./commission-service";
// import { getExpenses } from "./expense-service";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to get agency banking transactions
async function getAgencyBankingTransactions(filters: { status?: string } = {}) {
  try {
    let query = `
      SELECT * FROM agency_banking_transactions 
      WHERE deleted = false
    `;

    if (filters.status) {
      query += ` AND status = '${filters.status}'`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await sql.unsafe(query);
    return result || [];
  } catch (error) {
    console.error("Error fetching agency banking transactions:", error);
    return [];
  }
}

// Sync status interface
export interface SyncStatus {
  module: string;
  lastSyncTime: string;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  status: "success" | "failed" | "partial";
  error?: string;
}

// Sync all modules
export async function syncAllModules(): Promise<SyncStatus[]> {
  const results: SyncStatus[] = [];

  try {
    // Sync MoMo transactions
    results.push(await syncMoMoTransactions());

    // Sync Agency Banking transactions
    results.push(await syncAgencyBankingTransactions());

    // Sync Commission transactions
    results.push(await syncCommissionTransactions());

    // Sync Expense transactions
    results.push(await syncExpenseTransactions());

    return results;
  } catch (error) {
    console.error("Error syncing all modules:", error);

    // Log the error
    await GLDatabase.addSyncLogEntry({
      module: "system",
      operation: "sync",
      status: "failed",
      details: "Failed to sync all modules",
      error: error instanceof Error ? error.message : String(error),
    });

    return results;
  }
}

// Sync MoMo transactions
export async function syncMoMoTransactions(): Promise<SyncStatus> {
  const syncStatus: SyncStatus = {
    module: "momo",
    lastSyncTime: new Date().toISOString(),
    recordsProcessed: 0,
    recordsSucceeded: 0,
    recordsFailed: 0,
    status: "success",
  };

  try {
    // Get all MoMo transactions that are completed
    const momoTransactions = await getMoMoTransactions({ status: "completed" });

    syncStatus.recordsProcessed = momoTransactions.length;

    // Process each transaction
    for (const transaction of momoTransactions) {
      try {
        // Check if this transaction has already been processed
        const existingGLTransactions =
          await GLDatabase.getGLTransactionsBySourceId(transaction.id);

        if (existingGLTransactions.length > 0) {
          // Already processed, skip
          syncStatus.recordsSucceeded++;
          continue;
        }

        // Create GL transaction entries based on transaction type
        const entries: GLTransactionEntry[] = [];

        // Get GL accounts based on transaction type
        const { debitAccount, creditAccount } =
          await getGLAccountsForMoMoTransaction(transaction.type);

        if (!debitAccount || !creditAccount) {
          throw new Error(
            `GL accounts not found for MoMo transaction type: ${transaction.type}`
          );
        }

        // Create debit entry
        entries.push({
          accountId: debitAccount.id,
          accountCode: debitAccount.code,
          debit: transaction.amount,
          credit: 0,
          description: `MoMo ${transaction.type} - ${transaction.phoneNumber}`,
        });

        // Create credit entry
        entries.push({
          accountId: creditAccount.id,
          accountCode: creditAccount.code,
          debit: 0,
          credit: transaction.amount,
          description: `MoMo ${transaction.type} - ${transaction.phoneNumber}`,
        });

        // Create GL transaction
        const glTransaction = await GLDatabase.createGLTransaction({
          date: transaction.date,
          sourceModule: "momo",
          sourceTransactionId: transaction.id,
          sourceTransactionType: transaction.type,
          description: `MoMo ${transaction.type} - ${transaction.phoneNumber}`,
          entries,
          createdBy: transaction.userId || "system",
          metadata: {
            provider: transaction.provider,
            phoneNumber: transaction.phoneNumber,
            customerName: transaction.customerName,
            reference: transaction.reference,
          },
        });

        // Post the transaction
        await GLDatabase.postGLTransaction(glTransaction.id, "system");

        syncStatus.recordsSucceeded++;
      } catch (error) {
        console.error(
          `Error processing MoMo transaction ${transaction.id}:`,
          error
        );

        // Log the error
        await GLDatabase.addSyncLogEntry({
          module: "momo",
          operation: "sync",
          status: "failed",
          details: `Failed to process MoMo transaction ${transaction.id}`,
          error: error instanceof Error ? error.message : String(error),
        });

        syncStatus.recordsFailed++;
      }
    }

    // Update sync status
    if (syncStatus.recordsFailed > 0) {
      syncStatus.status =
        syncStatus.recordsSucceeded > 0 ? "partial" : "failed";
    }

    // Log the sync
    await GLDatabase.addSyncLogEntry({
      module: "momo",
      operation: "sync",
      status: syncStatus.status,
      details: `Synced ${syncStatus.recordsSucceeded} of ${syncStatus.recordsProcessed} MoMo transactions`,
      affectedRecords: syncStatus.recordsSucceeded,
      error:
        syncStatus.recordsFailed > 0
          ? `Failed to sync ${syncStatus.recordsFailed} transactions`
          : undefined,
    });

    return syncStatus;
  } catch (error) {
    console.error("Error syncing MoMo transactions:", error);

    syncStatus.status = "failed";
    syncStatus.error = error instanceof Error ? error.message : String(error);

    // Log the error
    await GLDatabase.addSyncLogEntry({
      module: "momo",
      operation: "sync",
      status: "failed",
      details: "Failed to sync MoMo transactions",
      error: syncStatus.error,
    });

    return syncStatus;
  }
}

// Get GL accounts for MoMo transaction
async function getGLAccountsForMoMoTransaction(
  type: string
): Promise<{ debitAccount: any; creditAccount: any }> {
  // This is a simplified implementation. In a real system, you would have a more sophisticated
  // mapping system that could be configured by users.

  switch (type) {
    case "cash-in":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("1001"), // Cash
        creditAccount: await GLDatabase.getGLAccountByCode("2001"), // Customer Liability
      };
    case "cash-out":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("2001"), // Customer Liability
        creditAccount: await GLDatabase.getGLAccountByCode("1001"), // Cash
      };
    case "transfer":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("2001"), // Customer Liability (source)
        creditAccount: await GLDatabase.getGLAccountByCode("2001"), // Customer Liability (destination)
      };
    case "payment":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("2001"), // Customer Liability
        creditAccount: await GLDatabase.getGLAccountByCode("2002"), // Merchant Payable
      };
    case "commission":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("1001"), // Cash
        creditAccount: await GLDatabase.getGLAccountByCode("4001"), // Commission Revenue
      };
    default:
      throw new Error(`Unknown MoMo transaction type: ${type}`);
  }
}

// Sync Agency Banking transactions
export async function syncAgencyBankingTransactions(): Promise<SyncStatus> {
  const syncStatus: SyncStatus = {
    module: "agency-banking",
    lastSyncTime: new Date().toISOString(),
    recordsProcessed: 0,
    recordsSucceeded: 0,
    recordsFailed: 0,
    status: "success",
  };

  try {
    // Get all Agency Banking transactions that are completed
    const agencyTransactions = await getAgencyBankingTransactions({
      status: "completed",
    });

    syncStatus.recordsProcessed = agencyTransactions.length;

    // Process each transaction
    for (const transaction of agencyTransactions) {
      try {
        // Check if this transaction has already been processed
        const existingGLTransactions =
          await GLDatabase.getGLTransactionsBySourceId(transaction.id);

        if (existingGLTransactions.length > 0) {
          // Already processed, skip
          syncStatus.recordsSucceeded++;
          continue;
        }

        // Create GL transaction entries based on transaction type
        const entries: GLTransactionEntry[] = [];

        // Get GL accounts based on transaction type
        const { debitAccount, creditAccount } =
          await getGLAccountsForAgencyTransaction(transaction.type);

        if (!debitAccount || !creditAccount) {
          throw new Error(
            `GL accounts not found for Agency Banking transaction type: ${transaction.type}`
          );
        }

        // Create debit entry
        entries.push({
          accountId: debitAccount.id,
          accountCode: debitAccount.code,
          debit: transaction.amount,
          credit: 0,
          description: `Agency Banking ${transaction.type} - ${transaction.customerName}`,
        });

        // Create credit entry
        entries.push({
          accountId: creditAccount.id,
          accountCode: creditAccount.code,
          debit: 0,
          credit: transaction.amount,
          description: `Agency Banking ${transaction.type} - ${transaction.customerName}`,
        });

        // If there's a fee, add fee entries
        if (transaction.fee > 0) {
          const {
            debitAccount: feeDebitAccount,
            creditAccount: feeCreditAccount,
          } = await getGLAccountsForAgencyFee();

          // Create fee debit entry
          entries.push({
            accountId: feeDebitAccount.id,
            accountCode: feeDebitAccount.code,
            debit: transaction.fee,
            credit: 0,
            description: `Agency Banking fee - ${transaction.customerName}`,
          });

          // Create fee credit entry
          entries.push({
            accountId: feeCreditAccount.id,
            accountCode: feeCreditAccount.code,
            debit: 0,
            credit: transaction.fee,
            description: `Agency Banking fee - ${transaction.customerName}`,
          });
        }

        // Create GL transaction
        const glTransaction = await GLDatabase.createGLTransaction({
          date: transaction.date,
          sourceModule: "agency-banking",
          sourceTransactionId: transaction.id,
          sourceTransactionType: transaction.type,
          description: `Agency Banking ${transaction.type} - ${transaction.customerName}`,
          entries,
          createdBy: transaction.userId,
          metadata: {
            partnerBank: transaction.partnerBank,
            partnerBankCode: transaction.partnerBankCode,
            accountNumber: transaction.accountNumber,
            customerName: transaction.customerName,
            fee: transaction.fee,
            reference: transaction.reference,
          },
        });

        // Post the transaction
        await GLDatabase.postGLTransaction(glTransaction.id, "system");

        syncStatus.recordsSucceeded++;
      } catch (error) {
        console.error(
          `Error processing Agency Banking transaction ${transaction.id}:`,
          error
        );

        // Log the error
        await GLDatabase.addSyncLogEntry({
          module: "agency-banking",
          operation: "sync",
          status: "failed",
          details: `Failed to process Agency Banking transaction ${transaction.id}`,
          error: error instanceof Error ? error.message : String(error),
        });

        syncStatus.recordsFailed++;
      }
    }

    // Update sync status
    if (syncStatus.recordsFailed > 0) {
      syncStatus.status =
        syncStatus.recordsSucceeded > 0 ? "partial" : "failed";
    }

    // Log the sync
    await GLDatabase.addSyncLogEntry({
      module: "agency-banking",
      operation: "sync",
      status: syncStatus.status,
      details: `Synced ${syncStatus.recordsSucceeded} of ${syncStatus.recordsProcessed} Agency Banking transactions`,
      affectedRecords: syncStatus.recordsSucceeded,
      error:
        syncStatus.recordsFailed > 0
          ? `Failed to sync ${syncStatus.recordsFailed} transactions`
          : undefined,
    });

    return syncStatus;
  } catch (error) {
    console.error("Error syncing Agency Banking transactions:", error);

    syncStatus.status = "failed";
    syncStatus.error = error instanceof Error ? error.message : String(error);

    // Log the error
    await GLDatabase.addSyncLogEntry({
      module: "agency-banking",
      operation: "sync",
      status: "failed",
      details: "Failed to sync Agency Banking transactions",
      error: syncStatus.error,
    });

    return syncStatus;
  }
}

// Get GL accounts for Agency Banking transaction
async function getGLAccountsForAgencyTransaction(
  type: string
): Promise<{ debitAccount: any; creditAccount: any }> {
  switch (type) {
    case "deposit":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("1001"), // Cash
        creditAccount: await GLDatabase.getGLAccountByCode("2003"), // Bank Partner Liability
      };
    case "withdrawal":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("2003"), // Bank Partner Liability
        creditAccount: await GLDatabase.getGLAccountByCode("1001"), // Cash
      };
    case "interbank":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("2003"), // Bank Partner Liability (source)
        creditAccount: await GLDatabase.getGLAccountByCode("2003"), // Bank Partner Liability (destination)
      };
    case "commission":
      return {
        debitAccount: await GLDatabase.getGLAccountByCode("1001"), // Cash
        creditAccount: await GLDatabase.getGLAccountByCode("4002"), // Agency Banking Revenue
      };
    default:
      throw new Error(`Unknown Agency Banking transaction type: ${type}`);
  }
}

// Get GL accounts for Agency Banking fee
async function getGLAccountsForAgencyFee(): Promise<{
  debitAccount: any;
  creditAccount: any;
}> {
  return {
    debitAccount: await GLDatabase.getGLAccountByCode("2003"), // Bank Partner Liability
    creditAccount: await GLDatabase.getGLAccountByCode("4003"), // Fee Income
  };
}

// Sync Commission transactions
export async function syncCommissionTransactions(): Promise<SyncStatus> {
  const syncStatus: SyncStatus = {
    module: "commissions",
    lastSyncTime: new Date().toISOString(),
    recordsProcessed: 0,
    recordsSucceeded: 0,
    recordsFailed: 0,
    status: "success",
  };

  try {
    // Note: This sync is deprecated. Commissions are now automatically synced via UnifiedGLPostingService
    // const commissions = await filterCommissions({ status: ["paid"] });
    const commissions: any[] = []; // Deprecated

    syncStatus.recordsProcessed = commissions.length;

    // Process each commission
    for (const commission of commissions) {
      try {
        // Check if this commission has already been processed
        const existingGLTransactions =
          await GLDatabase.getGLTransactionsBySourceId(commission.id);

        if (existingGLTransactions.length > 0) {
          // Already processed, skip
          syncStatus.recordsSucceeded++;
          continue;
        }

        // Create GL transaction entries
        const entries: GLTransactionEntry[] = [];

        // Get GL accounts for commission
        const { debitAccount, creditAccount } =
          await getGLAccountsForCommission(commission.source);

        if (!debitAccount || !creditAccount) {
          throw new Error(
            `GL accounts not found for Commission source: ${commission.source}`
          );
        }

        // Create debit entry
        entries.push({
          accountId: debitAccount.id,
          accountCode: debitAccount.code,
          debit: commission.amount,
          credit: 0,
          description: `Commission - ${commission.description}`,
        });

        // Create credit entry
        entries.push({
          accountId: creditAccount.id,
          accountCode: creditAccount.code,
          debit: 0,
          credit: commission.amount,
          description: `Commission - ${commission.description}`,
        });

        // Create GL transaction
        const glTransaction = await GLDatabase.createGLTransaction({
          date: commission.createdAt,
          sourceModule: "commissions",
          sourceTransactionId: commission.id,
          sourceTransactionType: commission.source,
          description: `Commission - ${commission.description}`,
          entries,
          createdBy: commission.createdBy.id,
          metadata: {
            source: commission.source,
            sourceName: commission.sourceName,
            reference: commission.reference,
            month: commission.month,
            paymentMethod: commission.payment?.method,
            paymentReference: commission.payment?.referenceNumber,
          },
        });

        // Post the transaction
        await GLDatabase.postGLTransaction(glTransaction.id, "system");

        syncStatus.recordsSucceeded++;
      } catch (error) {
        console.error(`Error processing Commission ${commission.id}:`, error);

        // Log the error
        await GLDatabase.addSyncLogEntry({
          module: "commissions",
          operation: "sync",
          status: "failed",
          details: `Failed to process Commission ${commission.id}`,
          error: error instanceof Error ? error.message : String(error),
        });

        syncStatus.recordsFailed++;
      }
    }

    // Update sync status
    if (syncStatus.recordsFailed > 0) {
      syncStatus.status =
        syncStatus.recordsSucceeded > 0 ? "partial" : "failed";
    }

    // Log the sync
    await GLDatabase.addSyncLogEntry({
      module: "commissions",
      operation: "sync",
      status: syncStatus.status,
      details: `Synced ${syncStatus.recordsSucceeded} of ${syncStatus.recordsProcessed} Commissions`,
      affectedRecords: syncStatus.recordsSucceeded,
      error:
        syncStatus.recordsFailed > 0
          ? `Failed to sync ${syncStatus.recordsFailed} commissions`
          : undefined,
    });

    return syncStatus;
  } catch (error) {
    console.error("Error syncing Commissions:", error);

    syncStatus.status = "failed";
    syncStatus.error = error instanceof Error ? error.message : String(error);

    // Log the error
    await GLDatabase.addSyncLogEntry({
      module: "commissions",
      operation: "sync",
      status: "failed",
      details: "Failed to sync Commissions",
      error: syncStatus.error,
    });

    return syncStatus;
  }
}

// Get GL accounts for Commission
async function getGLAccountsForCommission(
  source: string
): Promise<{ debitAccount: any; creditAccount: any }> {
  // This is a simplified implementation. In a real system, you would have a more sophisticated
  // mapping system that could be configured by users.

  // For all commission types, we'll use the same accounts for now
  return {
    debitAccount: await GLDatabase.getGLAccountByCode("5002"), // Commission Expense
    creditAccount: await GLDatabase.getGLAccountByCode("2004"), // Commission Payable
  };
}

// Sync Expense transactions
export async function syncExpenseTransactions(): Promise<SyncStatus> {
  const syncStatus: SyncStatus = {
    module: "expenses",
    lastSyncTime: new Date().toISOString(),
    recordsProcessed: 0,
    recordsSucceeded: 0,
    recordsFailed: 0,
    status: "success",
  };

  try {
    // Note: This sync is deprecated. Expenses are now automatically synced via UnifiedGLPostingService
    // const expenses = await getExpenses({ status: "paid" });
    const expenses: any[] = []; // Deprecated

    syncStatus.recordsProcessed = expenses.length;

    // Process each expense
    for (const expense of expenses) {
      try {
        // Check if this expense has already been processed
        const existingGLTransactions =
          await GLDatabase.getGLTransactionsBySourceId(expense.id);

        if (existingGLTransactions.length > 0) {
          // Already processed, skip
          syncStatus.recordsSucceeded++;
          continue;
        }

        // Create GL transaction entries
        const entries: GLTransactionEntry[] = [];

        // Get GL accounts for expense
        const { debitAccount, creditAccount } = await getGLAccountsForExpense(
          expense.expenseHeadId
        );

        if (!debitAccount || !creditAccount) {
          throw new Error(
            `GL accounts not found for Expense head: ${expense.expenseHeadId}`
          );
        }

        // Create debit entry
        entries.push({
          accountId: debitAccount.id,
          accountCode: debitAccount.code,
          debit: expense.amount,
          credit: 0,
          description: `Expense - ${expense.description}`,
        });

        // Create credit entry
        entries.push({
          accountId: creditAccount.id,
          accountCode: creditAccount.code,
          debit: 0,
          credit: expense.amount,
          description: `Expense - ${expense.description}`,
        });

        // Create GL transaction
        const glTransaction = await GLDatabase.createGLTransaction({
          date: expense.date,
          sourceModule: "expenses",
          sourceTransactionId: expense.id,
          sourceTransactionType: expense.type,
          description: `Expense - ${expense.description}`,
          entries,
          createdBy: expense.userId,
          metadata: {
            type: expense.type,
            expenseHeadId: expense.expenseHeadId,
            branchId: expense.branchId,
            receiptUrl: expense.receiptUrl,
          },
        });

        // Post the transaction
        await GLDatabase.postGLTransaction(glTransaction.id, "system");

        syncStatus.recordsSucceeded++;
      } catch (error) {
        console.error(`Error processing Expense ${expense.id}:`, error);

        // Log the error
        await GLDatabase.addSyncLogEntry({
          module: "expenses",
          operation: "sync",
          status: "failed",
          details: `Failed to process Expense ${expense.id}`,
          error: error instanceof Error ? error.message : String(error),
        });

        syncStatus.recordsFailed++;
      }
    }

    // Update sync status
    if (syncStatus.recordsFailed > 0) {
      syncStatus.status =
        syncStatus.recordsSucceeded > 0 ? "partial" : "failed";
    }

    // Log the sync
    await GLDatabase.addSyncLogEntry({
      module: "expenses",
      operation: "sync",
      status: syncStatus.status,
      details: `Synced ${syncStatus.recordsSucceeded} of ${syncStatus.recordsProcessed} Expenses`,
      affectedRecords: syncStatus.recordsSucceeded,
      error:
        syncStatus.recordsFailed > 0
          ? `Failed to sync ${syncStatus.recordsFailed} expenses`
          : undefined,
    });

    return syncStatus;
  } catch (error) {
    console.error("Error syncing Expenses:", error);

    syncStatus.status = "failed";
    syncStatus.error = error instanceof Error ? error.message : String(error);

    // Log the error
    await GLDatabase.addSyncLogEntry({
      module: "expenses",
      operation: "sync",
      status: "failed",
      details: "Failed to sync Expenses",
      error: syncStatus.error,
    });

    return syncStatus;
  }
}

// Get GL accounts for Expense
async function getGLAccountsForExpense(
  expenseHeadId: string
): Promise<{ debitAccount: any; creditAccount: any }> {
  // In a real system, you would look up the expense head to determine the appropriate expense account
  // For now, we'll use a generic expense account

  return {
    debitAccount: await GLDatabase.getGLAccountByCode("5001"), // General Expense
    creditAccount: await GLDatabase.getGLAccountByCode("1001"), // Cash
  };
}

// Export the module
export const GLSyncManager = {
  syncAllModules,
  syncMoMoTransactions,
  syncAgencyBankingTransactions,
  syncCommissionTransactions,
  syncExpenseTransactions,
};
