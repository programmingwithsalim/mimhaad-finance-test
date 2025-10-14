import { neon } from "@neondatabase/serverless";
import { UnifiedGLPostingService } from "./services/unified-gl-posting-service";
import { NotificationService } from "@/lib/services/notification-service";
import { CustomerNotificationService } from "@/lib/services/customer-notification-service";

const sql = neon(process.env.DATABASE_URL!);

export interface JumiaTransaction {
  id?: number;
  transaction_id: string;
  branch_id: string;
  user_id: string;
  transaction_type: "package_receipt" | "pod_collection" | "settlement";
  tracking_id?: string;
  customer_name?: string;
  customer_phone?: string;
  amount: number;
  settlement_reference?: string;
  settlement_from_date?: string;
  settlement_to_date?: string;
  status: string;
  delivery_status?: string;
  notes?: string;
  float_account_id?: string; // For settlements - which account was used to pay
  payment_method?: string; // NEW: payment method used for pod_collection/settlement
  created_at?: string;
  updated_at?: string;
}

export interface JumiaLiability {
  branch_id: string;
  amount: number;
  last_updated?: string;
}

export interface JumiaStatistics {
  total_packages: number;
  packages_collected: number;
  total_pod_amount: number;
  unsettled_amount: number;
  total_settlements: number;
}

// Check if tables exist
async function tablesExist(): Promise<boolean> {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jumia_transactions'
      ) as table_exists
    `;
    return result[0]?.table_exists || false;
  } catch (error) {
    console.error("Error checking Jumia tables:", error);
    return false;
  }
}

// Initialize Jumia tables if they don't exist
async function initializeJumiaTables(): Promise<void> {
  try {
    console.log("🏗️ [JUMIA] Initializing Jumia database tables...");

    // Create jumia_transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS jumia_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id VARCHAR(255) UNIQUE NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        tracking_id VARCHAR(255),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(20),
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        settlement_reference VARCHAR(255),
        settlement_from_date DATE,
        settlement_to_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        delivery_status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        float_account_id VARCHAR(255),
        payment_method VARCHAR(50),
        package_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create jumia_packages table
    await sql`
      CREATE TABLE IF NOT EXISTS jumia_packages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        package_id VARCHAR(255) UNIQUE NOT NULL,
        tracking_id VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        branch_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        pod_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) NOT NULL DEFAULT 'received',
        delivery_status VARCHAR(20) DEFAULT 'pending',
        settlement_reference VARCHAR(255),
        settlement_amount DECIMAL(10,2),
        settlement_date DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create indexes for better performance
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_transactions_branch_id ON jumia_transactions(branch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_transactions_status ON jumia_transactions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_transactions_transaction_type ON jumia_transactions(transaction_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_transactions_created_at ON jumia_transactions(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_transactions_tracking_id ON jumia_transactions(tracking_id)`;

    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_packages_branch_id ON jumia_packages(branch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_packages_status ON jumia_packages(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_packages_tracking_id ON jumia_packages(tracking_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jumia_packages_created_at ON jumia_packages(created_at)`;

    console.log("[JUMIA] Database tables initialized successfully");
  } catch (error) {
    console.error("[JUMIA] Error initializing database tables:", error);
    throw error;
  }
}

// Check if float accounts table exists
async function floatAccountsTableExists(): Promise<boolean> {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'float_accounts'
      ) as table_exists
    `;
    return result[0]?.table_exists || false;
  } catch (error) {
    console.error("Error checking float_accounts table:", error);
    return false;
  }
}

// Update float account balance directly in database
async function updateFloatAccountBalance(
  accountId: string,
  amount: number,
  transactionType: string,
  description: string
): Promise<void> {
  try {
    const tableExists = await floatAccountsTableExists();
    if (!tableExists) {
      console.log(
        "Float accounts table does not exist, skipping balance update"
      );
      return;
    }

    // Get current balance
    const accountResult = await sql`
      SELECT current_balance FROM float_accounts 
      WHERE id = ${accountId}
    `;

    if (!Array.isArray(accountResult) || accountResult.length === 0) {
      console.log(`Float account ${accountId} not found`);
      return;
    }

    // Ensure we get a proper number
    const currentBalanceRaw = accountResult[0].current_balance;
    const currentBalance = Number.parseFloat(String(currentBalanceRaw || "0"));

    // Ensure amount is also a proper number
    const adjustmentAmount = Number.parseFloat(String(amount || "0"));
    const newBalance = currentBalance + adjustmentAmount;

    // Check for negative balance (only for debits)
    if (amount < 0 && newBalance < 0) {
      console.log(
        `Insufficient balance in account ${accountId}. Current: ${currentBalance}, Requested: ${Math.abs(
          amount
        )}`
      );
      throw new Error(
        `Insufficient balance. Current: GHS ${currentBalance.toFixed(
          2
        )}, Required: GHS ${Math.abs(amount).toFixed(2)}`
      );
    }

    // Update the account balance
    await sql`
      UPDATE float_accounts 
      SET 
        current_balance = ${newBalance}::numeric,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${accountId}
    `;

    // Keep only essential logging:
    console.log(
      `Updated float account ${accountId}: ${currentBalance} -> ${newBalance}`
    );

    // Log transaction if float_transactions table exists
    await logFloatTransaction(
      accountId,
      transactionType,
      adjustmentAmount,
      currentBalance,
      newBalance,
      description
    );
  } catch (error) {
    console.error("Error updating float account balance:", error);
    throw error; // Throw error for settlements to prevent processing with insufficient funds
  }
}

// Log float transaction (optional)
async function logFloatTransaction(
  accountId: string,
  transactionType: string,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  description: string
): Promise<void> {
  try {
    // Check if float_transactions table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'float_transactions'
      ) as table_exists
    `;

    if (!tableCheck[0]?.table_exists) {
      console.log(
        "float_transactions table doesn't exist, skipping transaction log"
      );
      return;
    }

    // Check which columns exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'float_transactions' 
      AND table_schema = 'public'
    `;

    const columnNames = columns.map((col) => col.column_name);
    const hasBalanceColumns =
      columnNames.includes("balance_before") &&
      columnNames.includes("balance_after");

    if (hasBalanceColumns) {
      // Use full schema with balance columns
      await sql`
        INSERT INTO float_transactions (
          account_id,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          description,
          reference,
          created_at
        ) VALUES (
          ${accountId},
          ${transactionType},
          ${Math.abs(Number.parseFloat(String(amount || "0")))}::numeric,
          ${Number.parseFloat(String(balanceBefore || "0"))}::numeric,
          ${Number.parseFloat(String(balanceAfter || "0"))}::numeric,
          ${description},
          ${`JUMIA-${Date.now()}`},
          CURRENT_TIMESTAMP
        )
      `;
    } else {
      // Use basic schema without balance columns
      await sql`
        INSERT INTO float_transactions (
          account_id,
          transaction_type,
          amount,
          description,
          reference,
          created_at
        ) VALUES (
          ${accountId},
          ${transactionType},
          ${Math.abs(Number.parseFloat(String(amount || "0")))}::numeric,
          ${description},
          ${`JUMIA-${Date.now()}`},
          CURRENT_TIMESTAMP
        )
      `;
    }

    console.log("Float transaction logged successfully");
  } catch (error) {
    console.error("Error logging float transaction (non-critical):", error);
    // Don't throw error - transaction logging is optional
  }
}

// Create a new Jumia transaction
export async function createJumiaTransaction(
  transaction: Omit<JumiaTransaction, "id" | "created_at" | "updated_at">
): Promise<JumiaTransaction> {
  const useDatabase = await tablesExist();

  if (!useDatabase) {
    console.log("Jumia database tables not found, initializing...");
    await initializeJumiaTables();
  }

  try {
    const result = await sql`
      INSERT INTO jumia_transactions (
        transaction_id, branch_id, user_id, transaction_type,
        tracking_id, customer_name, customer_phone, amount, fee,
        settlement_reference, settlement_from_date, settlement_to_date,
        status, delivery_status, notes, float_account_id, payment_method
      ) VALUES (
        ${transaction.transaction_id}, ${transaction.branch_id}, ${
      transaction.user_id
    }, ${transaction.transaction_type},
        ${transaction.tracking_id || null}, ${
      transaction.customer_name || null
    }, ${transaction.customer_phone || null}, ${transaction.amount}, ${
      transaction.fee || 0
    },
        ${transaction.settlement_reference || null}, ${
      transaction.settlement_from_date || null
    }, ${transaction.settlement_to_date || null},
        ${transaction.status}, ${transaction.delivery_status || null}, ${
      transaction.notes || null
    }, ${transaction.float_account_id || null}, ${
      transaction.payment_method || null
    }
      )
      RETURNING *
    `;

    if (Array.isArray(result) && result.length > 0) {
      const createdTransaction = result[0] as JumiaTransaction;

      // Unified GL Posting for pod_collection and settlement only
      if (
        ["pod_collection", "settlement"].includes(
          createdTransaction.transaction_type
        )
      ) {
        try {
          // Get payment account and Jumia float account IDs for GL posting
          let paymentAccountId = null;
          let paymentAccountType = "cash-in-till";
          let jumiaFloatAccountId = null;

          if (createdTransaction.transaction_type === "pod_collection") {
            // POD collection affects the selected payment account
            const paymentMethod = createdTransaction.payment_method || "cash";

            if (paymentMethod === "cash") {
              // Use Cash-in-Till
              const cashInTillResult = await sql`
                SELECT id FROM float_accounts 
                WHERE branch_id = ${createdTransaction.branch_id}
                AND account_type = 'cash-in-till'
                AND is_active = true
                LIMIT 1
              `;
              if (cashInTillResult.length > 0) {
                paymentAccountId = cashInTillResult[0].id;
                paymentAccountType = "cash-in-till";
              }
            } else if (paymentMethod === "momo") {
              // Use the MoMo float account specified in float_account_id
              const momoFloatResult = await sql`
                SELECT id, account_type FROM float_accounts 
                WHERE id = ${createdTransaction.float_account_id}
                AND account_type = 'momo'
                AND is_active = true
                LIMIT 1
              `;
              if (momoFloatResult.length > 0) {
                paymentAccountId = momoFloatResult[0].id;
                paymentAccountType = "momo";
              }
            }
          }

          // Get Jumia float account
          const jumiaFloatResult = await sql`
            SELECT id FROM float_accounts 
            WHERE branch_id = ${createdTransaction.branch_id}
            AND account_type = 'jumia'
            AND is_active = true
            LIMIT 1
          `;
          if (jumiaFloatResult.length > 0) {
            jumiaFloatAccountId = jumiaFloatResult[0].id;
          }

          const glResult = await UnifiedGLPostingService.createGLEntries({
            transactionId: createdTransaction.transaction_id,
            sourceModule: "jumia",
            transactionType: createdTransaction.transaction_type,
            amount: Number(createdTransaction.amount),
            fee: Number(createdTransaction.fee || 0),
            customerName: createdTransaction.customer_name,
            reference:
              createdTransaction.tracking_id ||
              createdTransaction.settlement_reference ||
              createdTransaction.transaction_id,
            processedBy: createdTransaction.user_id,
            branchId: createdTransaction.branch_id,
            metadata: {
              delivery_status: createdTransaction.delivery_status,
              paymentAccountId: paymentAccountId,
              paymentAccountType: paymentAccountType,
              paymentAffected:
                createdTransaction.transaction_type === "pod_collection"
                  ? createdTransaction.amount
                  : 0,
              cashTillAccountId:
                paymentAccountType === "cash-in-till" ? paymentAccountId : null,
              cashTillAffected:
                createdTransaction.transaction_type === "pod_collection" &&
                paymentAccountType === "cash-in-till"
                  ? createdTransaction.amount
                  : 0,
              floatAccountId: jumiaFloatAccountId,
              floatAffected: createdTransaction.amount,
              // Add payment account info for settlements
              ...(createdTransaction.transaction_type === "settlement" && {
                paymentAccountCode: (transaction as any).paymentAccountCode,
                paymentAccountName: (transaction as any).paymentAccountName,
                paymentAccountId: createdTransaction.float_account_id,
              }),
            },
          });
          if (!glResult.success) {
            throw new Error(glResult.error || "Unified GL posting failed");
          }
        } catch (glError) {
          console.error(
            "[GL] Failed to post Jumia transaction to GL:",
            glError
          );
        }
      }

      // If this is a settlement, mark POD collections as settled
      if (createdTransaction.transaction_type === "settlement") {
        await sql`
          UPDATE jumia_transactions 
          SET status = 'settled', updated_at = CURRENT_TIMESTAMP
          WHERE branch_id = ${createdTransaction.branch_id} 
          AND transaction_type = 'pod_collection' 
          AND status = 'active'
        `;
      }

      // Handle float account updates based on transaction type
      await handleFloatAccountUpdates(createdTransaction, "create");

      // Send notification to CUSTOMER (not user) for POD collection
      if (
        createdTransaction.transaction_type === "pod_collection" &&
        createdTransaction.customer_phone
      ) {
        await CustomerNotificationService.sendCustomerNotification({
          type: "service_alert",
          title: "Package Delivered",
          message: `Your Jumia package (${createdTransaction.tracking_id}) has been delivered. Amount collected: GHS ${createdTransaction.amount}.`,
          customerPhone: createdTransaction.customer_phone,
          customerName: createdTransaction.customer_name,
          metadata: {
            trackingId: createdTransaction.tracking_id,
            amount: createdTransaction.amount,
            deliveryStatus: createdTransaction.delivery_status,
          },
        });
      }

      // Send notification to USER (staff member who processed it)
      if (createdTransaction.user_id) {
        const messageText =
          createdTransaction.transaction_type === "pod_collection"
            ? `Package delivered to ${createdTransaction.customer_name}. Tracking: ${createdTransaction.tracking_id}. Amount: GHS ${createdTransaction.amount}.`
            : `Jumia ${createdTransaction.transaction_type} processed successfully. Amount: GHS ${createdTransaction.amount}.`;

        await NotificationService.sendNotification({
          type: "transaction",
          title: "Jumia Transaction Processed",
          message: messageText,
          userId: createdTransaction.user_id,
          metadata: { ...createdTransaction },
        });
      }

      return createdTransaction;
    }

    throw new Error("Failed to create transaction");
  } catch (error) {
    console.error("Error creating Jumia transaction in database:", error);
    throw error;
  }
}

// Handle float account updates for transactions
async function handleFloatAccountUpdates(
  transaction: JumiaTransaction,
  operation: "create" | "delete" | "reverse"
): Promise<void> {
  try {
    // Always use the Jumia float account for all POD, reversal, and settlement logic
    // Find the Jumia float account for the branch
    const jumiaFloatResult = await sql`
      SELECT id FROM float_accounts 
      WHERE branch_id = ${transaction.branch_id} 
      AND account_type = 'jumia'
      AND is_active = true
      LIMIT 1
    `;
    const jumiaFloatId =
      Array.isArray(jumiaFloatResult) && jumiaFloatResult.length > 0
        ? jumiaFloatResult[0].id
        : null;

    // For POD collections, we need a Jumia float account to record liability
    if (transaction.transaction_type === "pod_collection") {
      // Determine payment account based on payment_method
      const paymentMethod = transaction.payment_method || "cash";
      let paymentAccountId = null;
      let paymentAccountName = "";

      if (paymentMethod === "cash") {
        // Use Cash-in-Till
        paymentAccountId = await findCashInTillAccount(transaction.branch_id);
        paymentAccountName = "Cash-in-Till";
        if (!paymentAccountId) {
          throw new Error(
            `No active cash-in-till account found for branch ${transaction.branch_id}`
          );
        }
      } else if (paymentMethod === "momo") {
        // Use the MoMo float account from float_account_id
        paymentAccountId = transaction.float_account_id;
        paymentAccountName = "MoMo";
        if (!paymentAccountId) {
          throw new Error(
            "MoMo payment method selected but no MoMo account specified"
          );
        }
      } else {
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }

      let paymentAmount = 0;
      let jumiaAmount = 0;
      if (operation === "create") {
        paymentAmount = transaction.amount; // Credit payment account
        jumiaAmount = transaction.amount; // Credit Jumia float (increase liability)
      } else if (operation === "delete" || operation === "reverse") {
        paymentAmount = -transaction.amount; // Debit payment account
        jumiaAmount = -transaction.amount; // Debit Jumia float (decrease liability)
      }

      // Update payment account (Cash-in-Till or MoMo)
      await updateFloatAccountBalance(
        paymentAccountId,
        paymentAmount,
        transaction.transaction_type,
        `Jumia POD collection (${paymentMethod}) - ${transaction.transaction_id}`
      );

      // Update Jumia float account (liability)
      await updateFloatAccountBalance(
        jumiaFloatId,
        jumiaAmount,
        transaction.transaction_type,
        `Jumia POD liability - ${transaction.transaction_id}`
      );
      return; // Exit early for POD collections
    }

    // For other transaction types, we need a Jumia float account
    if (!jumiaFloatId) {
      throw new Error(
        `No active Jumia float account found for branch ${transaction.branch_id}. Please create a Jumia float account to record liability.`
      );
    }

    if (
      transaction.transaction_type === "settlement" &&
      transaction.amount > 0
    ) {
      // Settlement: Debit the Jumia float account AND the chosen payment float account
      let jumiaAmount = 0;
      if (operation === "create") {
        jumiaAmount = -transaction.amount; // Debit Jumia float (reduce liability)
      } else if (operation === "delete" || operation === "reverse") {
        jumiaAmount = transaction.amount; // Credit Jumia float (increase liability)
      }

      // Update Jumia float account
      await updateFloatAccountBalance(
        jumiaFloatId,
        jumiaAmount,
        transaction.transaction_type,
        `Jumia settlement - ${transaction.transaction_id}`
      );

      // Also debit the chosen payment float account if specified
      if (
        transaction.float_account_id &&
        transaction.float_account_id !== jumiaFloatId
      ) {
        let paymentAmount = 0;
        if (operation === "create") {
          paymentAmount = -transaction.amount; // Debit payment float account
        } else if (operation === "delete" || operation === "reverse") {
          paymentAmount = transaction.amount; // Credit payment float account
        }

        await updateFloatAccountBalance(
          transaction.float_account_id,
          paymentAmount,
          transaction.transaction_type,
          `Jumia settlement payment - ${transaction.transaction_id}`
        );
      }
    }
  } catch (error) {
    console.error("Error handling float account updates:", error);
    throw error; // Throw error to prevent transaction completion if float updates fail
  }
}

// Find cash-in-till account for a branch
async function findCashInTillAccount(branchId: string): Promise<string | null> {
  try {
    const tableExists = await floatAccountsTableExists();
    if (!tableExists) {
      console.log("Float accounts table does not exist");
      return null;
    }

    const result = await sql`
      SELECT id FROM float_accounts 
      WHERE branch_id = ${branchId} 
      AND account_type = 'cash-in-till'
      AND is_active = true
      LIMIT 1
    `;

    if (Array.isArray(result) && result.length > 0) {
      return result[0].id;
    }

    console.log(`No active cash-in-till account found for branch ${branchId}`);
    return null;
  } catch (error) {
    console.error("Error finding cash-in-till account:", error);
    return null;
  }
}

// Get Jumia transactions
export async function getJumiaTransactions(
  branchId: string,
  limit = 50
): Promise<JumiaTransaction[]> {
  const useDatabase = await tablesExist();

  if (!useDatabase) {
    console.log("Jumia database tables not found, initializing...");
    await initializeJumiaTables();
  }

  try {
    const result = await sql`
      SELECT * FROM jumia_transactions 
      WHERE branch_id = ${branchId}
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;

    if (Array.isArray(result)) {
      // Ensure proper sorting by created_at in descending order
      const sortedTransactions = result.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      return sortedTransactions as JumiaTransaction[];
    }

    return [];
  } catch (error) {
    console.error("Error getting Jumia transactions from database:", error);
    return [];
  }
}

// Get all Jumia transactions (for admin purposes)
export async function getAllJumiaTransactions(
  limit = 100
): Promise<JumiaTransaction[]> {
  const useDatabase = await tablesExist();

  if (!useDatabase) {
    console.log("Jumia database tables not found, initializing...");
    await initializeJumiaTables();
  }

  try {
    const result = await sql`
      SELECT * FROM jumia_transactions 
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;

    if (Array.isArray(result)) {
      // Ensure proper sorting by created_at in descending order
      const sortedTransactions = result.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      return sortedTransactions as JumiaTransaction[];
    }

    return [];
  } catch (error) {
    console.error("Error getting all Jumia transactions from database:", error);
    return [];
  }
}

// Get single transaction by ID
export async function getJumiaTransactionById(
  transactionId: string
): Promise<JumiaTransaction | null> {
  const useDatabase = await tablesExist();

  if (!useDatabase) {
    console.log("Jumia database tables not found, initializing...");
    await initializeJumiaTables();
  }

  try {
    const result = await sql`
      SELECT * FROM jumia_transactions 
      WHERE transaction_id = ${transactionId}
    `;

    if (Array.isArray(result) && result.length > 0) {
      return result[0] as JumiaTransaction;
    }

    return null;
  } catch (error) {
    console.error("Error getting Jumia transaction by ID:", error);
    return null;
  }
}

// Update transaction
export async function updateJumiaTransaction(
  transactionId: string,
  updateData: Partial<JumiaTransaction>
): Promise<JumiaTransaction> {
  const useDatabase = await tablesExist();

  if (!useDatabase) {
    console.log("Jumia database tables not found, initializing...");
    await initializeJumiaTables();
  }

  try {
    // Get current transaction for comparison
    const currentTransaction = await getJumiaTransactionById(transactionId);
    if (!currentTransaction) {
      throw new Error("Transaction not found");
    }

    console.log(
      "Updating transaction:",
      transactionId,
      "with data:",
      updateData
    );

    // Build update object with current values as defaults
    const updatedTransaction = {
      branch_id: updateData.branch_id ?? currentTransaction.branch_id,
      user_id: updateData.user_id ?? currentTransaction.user_id,
      transaction_type:
        updateData.transaction_type ?? currentTransaction.transaction_type,
      tracking_id: updateData.tracking_id ?? currentTransaction.tracking_id,
      customer_name:
        updateData.customer_name ?? currentTransaction.customer_name,
      customer_phone:
        updateData.customer_phone ?? currentTransaction.customer_phone,
      amount: updateData.amount ?? currentTransaction.amount,
      settlement_reference:
        updateData.settlement_reference ??
        currentTransaction.settlement_reference,
      settlement_from_date:
        updateData.settlement_from_date ??
        currentTransaction.settlement_from_date,
      settlement_to_date:
        updateData.settlement_to_date ?? currentTransaction.settlement_to_date,
      status: updateData.status ?? currentTransaction.status,
      delivery_status:
        updateData.delivery_status ?? currentTransaction.delivery_status,
      notes: updateData.notes ?? currentTransaction.notes,
      float_account_id:
        updateData.float_account_id ?? currentTransaction.float_account_id,
      payment_method:
        updateData.payment_method ?? currentTransaction.payment_method,
    };

    const result = await sql`
      UPDATE jumia_transactions 
      SET 
        branch_id = ${updatedTransaction.branch_id},
        user_id = ${updatedTransaction.user_id},
        transaction_type = ${updatedTransaction.transaction_type},
        tracking_id = ${updatedTransaction.tracking_id},
        customer_name = ${updatedTransaction.customer_name},
        customer_phone = ${updatedTransaction.customer_phone},
        amount = ${updatedTransaction.amount},
        settlement_reference = ${updatedTransaction.settlement_reference},
        settlement_from_date = ${updatedTransaction.settlement_from_date},
        settlement_to_date = ${updatedTransaction.settlement_to_date},
        status = ${updatedTransaction.status},
        delivery_status = ${updatedTransaction.delivery_status},
        notes = ${updatedTransaction.notes},
        float_account_id = ${updatedTransaction.float_account_id},
        payment_method = ${updatedTransaction.payment_method},
        updated_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ${transactionId}
      RETURNING *
    `;

    if (Array.isArray(result) && result.length > 0) {
      console.log("Transaction updated successfully:", result[0]);
      return result[0] as JumiaTransaction;
    }

    throw new Error("Transaction not found or update failed");
  } catch (error) {
    console.error("Error updating Jumia transaction:", error);
    throw error;
  }
}

// Delete transaction
export async function deleteJumiaTransaction(
  transactionId: string
): Promise<JumiaTransaction> {
  const useDatabase = await tablesExist();

  if (!useDatabase) {
    console.log("Jumia database tables not found, initializing...");
    await initializeJumiaTables();
  }

  try {
    // Get current transaction for comparison
    const currentTransaction = await getJumiaTransactionById(transactionId);
    if (!currentTransaction) {
      throw new Error("Transaction not found");
    }

    console.log("Deleting transaction:", transactionId);

    const result = await sql`
      DELETE FROM jumia_transactions 
      WHERE transaction_id = ${transactionId}
      RETURNING *
    `;

    if (Array.isArray(result) && result.length > 0) {
      const deletedTransaction = result[0] as JumiaTransaction;
      console.log("Transaction deleted successfully:", deletedTransaction);

      // Handle float account updates for deleted transaction
      await handleFloatAccountUpdates(deletedTransaction, "delete");

      return deletedTransaction;
    }

    throw new Error("Transaction not found");
  } catch (error) {
    console.error("Error deleting Jumia transaction:", error);
    throw error;
  }
}

// Get Jumia statistics - Fixed to handle proper UUID format
export async function getJumiaStatistics(
  branchId: string
): Promise<JumiaStatistics & { float_balance?: number }> {
  const useDatabase = await tablesExist();

  if (!useDatabase) {
    console.log("Jumia database tables not found, initializing...");
    await initializeJumiaTables();

    // Return default statistics for newly initialized database
    return {
      total_packages: 0,
      packages_collected: 0,
      total_pod_amount: 0,
      unsettled_amount: 0,
      total_settlements: 0,
      total_settlement_amount: 0,
      float_balance: 0,
      liability: 0,
    };
  }

  try {
    // Validate branchId format - if it's not a UUID, try to find the actual branch ID
    let actualBranchId = branchId;

    // If branchId looks like "branch-1", try to find the actual UUID
    if (
      branchId &&
      !branchId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    ) {
      const branchResult = await sql`
        SELECT id FROM branches WHERE name ILIKE ${`%${branchId}%`} OR id = ${branchId} LIMIT 1
      `;
      if (branchResult.length > 0) {
        actualBranchId = branchResult[0].id;
      } else {
        console.warn("Could not find branch, using original branchId");
      }
    }

    const result = await sql`
      SELECT 
        COUNT(CASE WHEN transaction_type = 'package_receipt' THEN 1 END) as total_packages,
        COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as packages_collected,
        COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN amount END), 0) as total_pod_amount,
        COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' AND status = 'active' THEN amount END), 0) as unsettled_amount,
        COUNT(CASE WHEN transaction_type = 'settlement' THEN 1 END) as total_settlements,
        COALESCE(SUM(CASE WHEN transaction_type = 'settlement' THEN amount END), 0) as total_settlement_amount
      FROM jumia_transactions 
      WHERE branch_id = ${actualBranchId}
    `;

    // Fetch Jumia float account balance for this branch
    const floatResult = await sql`
      SELECT current_balance FROM float_accounts WHERE branch_id = ${actualBranchId} AND account_type = 'jumia' AND is_active = true LIMIT 1
    `;
    const float_balance =
      floatResult.length > 0 && floatResult[0].current_balance != null
        ? Number.parseFloat(floatResult[0].current_balance)
        : 0;

    if (Array.isArray(result) && result.length > 0) {
      const stats = result[0] as any;
      const liability =
        (Number.parseFloat(stats.total_pod_amount) || 0) -
        (Number.parseFloat(stats.total_settlement_amount) || 0);
      return {
        total_packages: Number.parseInt(stats.total_packages) || 0,
        packages_collected: Number.parseInt(stats.packages_collected) || 0,
        total_pod_amount: Number.parseFloat(stats.total_pod_amount) || 0,
        unsettled_amount: Number.parseFloat(stats.unsettled_amount) || 0,
        total_settlements: Number.parseInt(stats.total_settlements) || 0,
        total_settlement_amount:
          Number.parseFloat(stats.total_settlement_amount) || 0,
        float_balance,
        liability,
      };
    }

    return {
      total_packages: 0,
      packages_collected: 0,
      total_pod_amount: 0,
      unsettled_amount: 0,
      total_settlements: 0,
      total_settlement_amount: 0,
      float_balance,
      liability: 0,
    };
  } catch (error) {
    console.error("Error getting Jumia statistics from database:", error);
    return {
      total_packages: 0,
      packages_collected: 0,
      total_pod_amount: 0,
      unsettled_amount: 0,
      total_settlements: 0,
      total_settlement_amount: 0,
      float_balance: 0,
      liability: 0,
    };
  }
}
