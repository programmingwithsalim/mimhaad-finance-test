import { neon } from "@neondatabase/serverless";
import { UnifiedGLPostingService } from "./unified-gl-posting-service";
import { AuditLoggerService } from "./audit-logger-service";

const sql = neon(process.env.DATABASE_URL!);

export interface TransactionEditData {
  id: string;
  sourceModule: "momo" | "agency_banking" | "e_zwich" | "power" | "jumia";
  amount: number;
  fee: number;
  customerName?: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface TransactionDeleteData {
  id: string;
  sourceModule: "momo" | "agency_banking" | "e_zwich" | "power" | "jumia";
  processedBy: string;
  branchId: string;
  reason?: string;
}

export class TransactionManagementService {
  /**
   * Edit a transaction and adjust float balances and GL entries accordingly
   */
  static async editTransaction(data: TransactionEditData) {
    const { id, sourceModule, amount, fee, customerName, reference, metadata } =
      data;

    try {
      // Get the original transaction
      const originalTransaction = await this.getOriginalTransaction(
        id,
        sourceModule
      );
      if (!originalTransaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Calculate differences
      const amountDifference = amount - originalTransaction.amount;
      const feeDifference =
        fee - (originalTransaction.fee || originalTransaction.commission || 0);

      // Update the transaction
      const updateResult = await this.updateTransaction(id, sourceModule, {
        amount,
        fee,
        customerName,
        reference,
        metadata,
      });

      if (!updateResult.success) {
        return updateResult;
      }

      // Adjust float balances
      const floatAdjustmentResult = await this.adjustFloatBalances(
        sourceModule,
        originalTransaction,
        amountDifference,
        feeDifference
      );

      if (!floatAdjustmentResult.success) {
        return floatAdjustmentResult;
      }

      // Update GL entries
      const glUpdateResult = await this.updateGLEntries(
        sourceModule,
        originalTransaction,
        amountDifference,
        feeDifference
      );

      if (!glUpdateResult.success) {
        return glUpdateResult;
      }

      // Log the edit
      await this.logTransactionEdit(data, originalTransaction);

      return {
        success: true,
        updatedTransaction: updateResult.transaction,
        message: "Transaction updated successfully",
      };
    } catch (error) {
      console.error("Error editing transaction:", error);
      return { success: false, error: "Failed to edit transaction" };
    }
  }

  /**
   * Delete a transaction and reverse all float balances and GL entries
   */
  static async deleteTransaction(data: TransactionDeleteData) {
    const { id, sourceModule, processedBy, branchId, reason } = data;

    try {
      // Get the original transaction
      const originalTransaction = await this.getOriginalTransaction(
        id,
        sourceModule
      );
      if (!originalTransaction) {
        return { success: false, error: "Transaction not found" };
      }
      // Prevent multiple deletions
      if (
        originalTransaction.deleted === true ||
        originalTransaction.deleted === 1
      ) {
        return { success: false, error: "Transaction already deleted" };
      }

      // Reverse float balances
      const floatReversalResult = await this.reverseFloatBalances(
        sourceModule,
        originalTransaction
      );

      if (!floatReversalResult.success) {
        return floatReversalResult;
      }

      // Reverse cash till balances
      const cashTillReversalResult = await this.reverseCashTillBalances(
        sourceModule,
        originalTransaction
      );

      if (!cashTillReversalResult.success) {
        return cashTillReversalResult;
      }

      // Reverse GL entries
      const glReversalResult = await this.reverseGLEntries(
        sourceModule,
        originalTransaction
      );

      if (!glReversalResult.success) {
        return glReversalResult;
      }

      // Mark transaction as deleted (soft delete)
      const deleteResult = await this.markTransactionDeleted(id, sourceModule, {
        processedBy,
        branchId,
        reason,
      });

      if (!deleteResult.success) {
        return deleteResult;
      }

      // Log the deletion
      await this.logTransactionDeletion(data, originalTransaction);

      return {
        success: true,
        message: "Transaction deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting transaction:", error);
      return { success: false, error: "Failed to delete transaction" };
    }
  }

  private static async getOriginalTransaction(
    id: string,
    sourceModule: string
  ) {
    try {
      let result;

      switch (sourceModule) {
        case "momo":
          result = await sql`
            SELECT * FROM momo_transactions 
            WHERE id = ${id}
          `;
          break;
        case "agency_banking":
          result = await sql`
            SELECT * FROM agency_banking_transactions 
            WHERE id = ${id}
          `;
          break;
        case "e_zwich":
          // Check both withdrawal and card issuance tables
          result =
            await sql`SELECT * FROM e_zwich_withdrawals WHERE id = ${id}`;
          if (result.length === 0) {
            result =
              await sql`SELECT * FROM ezwich_card_issuance WHERE id = ${id}`;
          }
          break;
        case "power":
          result = await sql`
            SELECT * FROM power_transactions 
            WHERE id = ${id}
          `;
          break;
        case "jumia":
          result = await sql`
            SELECT * FROM jumia_transactions 
            WHERE id = ${id}
          `;
          break;
        default:
          throw new Error(`Invalid source module: ${sourceModule}`);
      }

      return result[0] || null;
    } catch (error) {
      console.error("Error getting original transaction:", error);
      return null;
    }
  }

  private static async updateTransaction(
    id: string,
    sourceModule: string,
    data: any
  ) {
    try {
      let result;

      switch (sourceModule) {
        case "momo":
          result = await sql`
            UPDATE momo_transactions
            SET 
              amount = ${data.amount},
              fee = ${data.fee},
              customer_name = ${
                data.customerName || data.customer_name || null
              },
              reference = ${data.reference || null},
              updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `;
          break;
        case "agency_banking":
          result = await sql`
            UPDATE agency_banking_transactions
            SET 
              amount = ${data.amount},
              fee = ${data.fee},
              customer_name = ${
                data.customer_name || data.customerName || null
              },
              account_number = ${data.account_number || null},
              reference = ${data.reference || null},
              updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `;
          break;
        case "e_zwich":
          result = await sql`
            UPDATE e_zwich_transactions
            SET 
              amount = ${data.amount},
              fee = ${data.fee},
              customer_name = ${data.customerName || null},
              reference = ${data.reference || null},
              metadata = ${
                data.metadata ? JSON.stringify(data.metadata) : null
              },
              updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `;
          break;
        case "power":
          result = await sql`
            UPDATE power_transactions
            SET 
              amount = ${data.amount},
              commission = ${data.fee},
              customer_name = ${data.customerName || null},
              reference = ${data.reference || null},
              metadata = ${
                data.metadata ? JSON.stringify(data.metadata) : null
              },
              updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `;
          break;
        case "jumia":
          result = await sql`
            UPDATE jumia_transactions
            SET 
              amount = ${data.amount},
              customer_name = ${data.customerName || null},
              reference = ${data.reference || null},
              metadata = ${
                data.metadata ? JSON.stringify(data.metadata) : null
              },
              updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `;
          break;
        default:
          return {
            success: false,
            error: `Invalid source module: ${sourceModule}`,
          };
      }

      return {
        success: true,
        transaction: result[0],
      };
    } catch (error) {
      console.error("Error updating transaction:", error);
      return { success: false, error: "Failed to update transaction" };
    }
  }

  // Helper to determine if a transaction is inflow (returns true) or outflow (returns false)
  private static isFloatInflow(
    sourceModule: string,
    transactionType: string
  ): boolean {
    switch (sourceModule) {
      case "momo":
        return transactionType === "cash-out"; // Cash-out is inflow (we receive MoMo credit back)
      case "agency_banking":
        return transactionType === "withdrawal"; // Withdrawal is inflow (we receive agency credit back)
      case "e_zwich":
        return transactionType === "withdrawal"; // Withdrawal is inflow (we receive e-zwich credit back)
      case "power":
        return false; // Power sales are always outflow (we give away power credit)
      case "jumia":
        return false; // Jumia sales are always outflow (we give away jumia credit)
      default:
        return false;
    }
  }

  /**
   * Reverse the effect of a transaction on the float account (for deletion/reversal)
   * This restores the float balance as if the transaction never happened.
   */
  private static async reverseFloatBalances(
    sourceModule: string,
    originalTransaction: any
  ) {
    try {
      const floatAccount = await this.getFloatAccountForTransaction(
        sourceModule,
        originalTransaction
      );
      if (!floatAccount) {
        return { success: false, error: "Float account not found" };
      }
      const amount = Number(originalTransaction.amount);
      const fee = Number(
        originalTransaction.fee || originalTransaction.commission || 0
      );
      if (isNaN(amount) || isNaN(fee)) {
        return {
          success: false,
          error: "Invalid amount or fee for float reversal",
        };
      }
      // Determine the effect direction based on module and transaction type
      const effect = this.getFloatEffect(sourceModule, originalTransaction);
      // To reverse, subtract the effect
      const adjustment = -effect;
      const currentBalance = Number(floatAccount.current_balance);
      const newBalance = currentBalance + adjustment;
      await sql`
        UPDATE float_accounts
        SET current_balance = ${newBalance}, updated_at = NOW()
        WHERE id = ${floatAccount.id}
      `;
      await sql`
        INSERT INTO float_transactions (
          account_id, transaction_type, amount, balance_before, balance_after, reference, description, created_at
        ) VALUES (
          ${floatAccount.id},
          'reversal',
          ${adjustment},
          ${currentBalance},
          ${newBalance},
          ${`DELETE-${originalTransaction.id}`},
          ${`Transaction deletion reversal for ${sourceModule} transaction ${originalTransaction.id}`},
          NOW()
        )
      `;
      return { success: true };
    } catch (error) {
      console.error("Error reversing float balances:", error);
      return { success: false, error: "Failed to reverse float balances" };
    }
  }

  /**
   * Adjust the float balance for a transaction edit (undo old, apply new)
   */
  private static async adjustFloatBalances(
    sourceModule: string,
    originalTransaction: any,
    amountDifference: number,
    feeDifference: number,
    newAmount?: number,
    newFee?: number,
    newType?: string
  ) {
    try {
      const floatAccount = await this.getFloatAccountForTransaction(
        sourceModule,
        originalTransaction
      );
      if (!floatAccount) {
        return { success: false, error: "Float account not found" };
      }
      // Calculate the effect of the original and new transaction
      const oldEffect = this.getFloatEffect(sourceModule, originalTransaction);
      const newEffect = this.getFloatEffect(sourceModule, {
        ...originalTransaction,
        amount:
          typeof newAmount === "number"
            ? newAmount
            : originalTransaction.amount,
        fee:
          typeof newFee === "number"
            ? newFee
            : originalTransaction.fee || originalTransaction.commission || 0,
        type:
          newType ||
          originalTransaction.type ||
          originalTransaction.transaction_type,
      });
      const adjustment = newEffect - oldEffect;
      const currentBalance = Number(floatAccount.current_balance);
      const newBalance = currentBalance + adjustment;
      await sql`
        UPDATE float_accounts
        SET current_balance = ${newBalance}, updated_at = NOW()
        WHERE id = ${floatAccount.id}
      `;
      await sql`
        INSERT INTO float_transactions (
          account_id, transaction_type, amount, balance_before, balance_after, reference, description, created_at
        ) VALUES (
          ${floatAccount.id},
          'adjustment',
          ${adjustment},
          ${currentBalance},
          ${newBalance},
          ${`EDIT-${originalTransaction.id}`},
          ${`Transaction edit adjustment for ${sourceModule} transaction ${originalTransaction.id}`},
          NOW()
        )
      `;
      return { success: true };
    } catch (error) {
      console.error("Error adjusting float balances:", error);
      return { success: false, error: "Failed to adjust float balances" };
    }
  }

  /**
   * Get the effect of a transaction on the float account (positive=increase, negative=decrease)
   */
  private static getFloatEffect(
    sourceModule: string,
    transaction: any
  ): number {
    const amount = Number(transaction.amount);
    const fee = Number(transaction.fee || transaction.commission || 0);
    const type = (
      transaction.type ||
      transaction.transaction_type ||
      ""
    ).toLowerCase();
    switch (sourceModule) {
      case "momo":
        if (type === "cash-in") return -(amount + fee); // float decreases
        if (type === "cash-out") return amount; // float increases by amount only
        break;
      case "agency_banking":
        if (type === "deposit") return -amount; // float decreases by amount only
        if (type === "withdrawal") return amount; // float increases by amount only
        if (type === "interbank transfer" || type === "interbank")
          return -amount; // float decreases by amount only
        break;
      case "e_zwich":
        if (type === "withdrawal") return amount + fee; // float increases
        if (type === "card issuance") return 0; // no float effect
        break;
      case "power":
        return -(amount + fee); // float decreases on sale
      case "jumia":
        return -(amount + fee); // float decreases on sale
      default:
        return 0;
    }
    return 0;
  }

  private static async updateGLEntries(
    sourceModule: string,
    originalTransaction: any,
    amountDifference: number,
    feeDifference: number
  ) {
    try {
      // Create reversal entries for the original amounts
      const reversalEntries = await this.createGLReversalEntries(
        sourceModule,
        originalTransaction
      );
      if (!reversalEntries.success) {
        return reversalEntries;
      }

      // Create new entries for the updated amounts using the correct method
      const newEntries = await UnifiedGLPostingService.createGLEntries({
        transactionId: `EDIT-${originalTransaction.id}`,
        sourceModule: sourceModule as
          | "momo"
          | "agency_banking"
          | "e_zwich"
          | "power"
          | "jumia",
        transactionType:
          originalTransaction.type || originalTransaction.transaction_type,
        amount: originalTransaction.amount + amountDifference,
        fee:
          (originalTransaction.fee || originalTransaction.commission || 0) +
          feeDifference,
        customerName: originalTransaction.customer_name,
        reference: `EDIT-${originalTransaction.id}`,
        processedBy: originalTransaction.user_id,
        branchId: originalTransaction.branch_id,
        metadata: {
          originalTransactionId: originalTransaction.id,
          editReason: "Transaction amount/fee adjustment",
        },
      });

      if (!newEntries.success) {
        return newEntries;
      }

      return { success: true };
    } catch (error) {
      console.error("Error updating GL entries:", error);
      return { success: false, error: "Failed to update GL entries" };
    }
  }

  private static async reverseGLEntries(
    sourceModule: string,
    originalTransaction: any
  ) {
    try {
      // Get the original GL entries for this transaction
      const transactionId =
        originalTransaction.gl_transaction_id || originalTransaction.id;
      const originalGLEntries = await sql`
        SELECT * FROM gl_journal_entries
        WHERE transaction_id = ${transactionId}
      `;

      if (originalGLEntries.length === 0) {
        return { success: true }; // No GL entries to reverse
      }

      // Create reversal entries
      for (const entry of originalGLEntries) {
        await sql`
          INSERT INTO gl_journal_entries (
            account_id,
            account_code,
            debit,
            credit,
            description,
            transaction_id,
            created_at
          ) VALUES (
            ${entry.account_id},
            ${entry.account_code},
            ${entry.credit}, // Reverse debit/credit
            ${entry.debit},
            ${`Reversal: ${entry.description}`},
            ${entry.transaction_id},
            NOW()
          )
        `;
      }

      return { success: true };
    } catch (error) {
      console.error("Error reversing GL entries:", error);
      return { success: false, error: "Failed to reverse GL entries" };
    }
  }

  private static async createGLReversalEntries(
    sourceModule: string,
    originalTransaction: any
  ) {
    try {
      // Get the original GL entries for this transaction
      const transactionId =
        originalTransaction.gl_transaction_id || originalTransaction.id;
      const originalGLEntries = await sql`
        SELECT * FROM gl_journal_entries
        WHERE transaction_id = ${transactionId}
      `;

      if (originalGLEntries.length === 0) {
        return { success: true }; // No GL entries to reverse
      }

      // Create reversal entries
      for (const entry of originalGLEntries) {
        await sql`
          INSERT INTO gl_journal_entries (
            account_id,
            account_code,
            debit,
            credit,
            description,
            transaction_id,
            created_at
          ) VALUES (
            ${entry.account_id},
            ${entry.account_code},
            ${entry.credit}, // Reverse debit/credit
            ${entry.debit},
            ${`Reversal: ${entry.description}`},
            ${entry.transaction_id},
            NOW()
          )
        `;
      }

      return { success: true };
    } catch (error) {
      console.error("Error creating GL reversal entries:", error);
      return { success: false, error: "Failed to create GL reversal entries" };
    }
  }

  private static async getFloatAccountForTransaction(
    sourceModule: string,
    transaction: any
  ) {
    try {
      console.log(
        `[FLOAT] Looking for float account for ${sourceModule} transaction:`,
        {
          id: transaction.id,
          float_account_id: transaction.float_account_id,
          branch_id: transaction.branch_id,
        }
      );

      // Check if transaction has float_account_id (only momo_transactions and jumia_transactions have this)
      let floatAccountId = transaction.float_account_id;

      if (!floatAccountId) {
        console.log(
          `⚠️ [FLOAT] No float_account_id found for ${sourceModule} transaction:`,
          transaction.id
        );

        // For transactions without float_account_id, find a default float account for this service and branch
        const defaultAccount = await this.findDefaultFloatAccount(
          sourceModule,
          transaction.branch_id
        );
        if (defaultAccount) {
          console.log(
            `[FLOAT] Using default float account:`,
            defaultAccount.id
          );
          return defaultAccount;
        }

        return null;
      }

      const result = await sql`
        SELECT * FROM float_accounts WHERE id = ${floatAccountId} AND is_active = true
      `;

      if (result.length === 0) {
        console.log(
          `[FLOAT] Float account not found for ID: ${floatAccountId}`
        );
        return null;
      }

      console.log(`[FLOAT] Found float account:`, result[0].id);
      return result[0];
    } catch (error) {
      console.error("[FLOAT] Error getting float account:", error);
      return null;
    }
  }

  static async findDefaultFloatAccount(sourceModule: string, branchId: string) {
    try {
      const result = await sql`
        SELECT * FROM float_accounts
        WHERE account_type = ${sourceModule}
          AND branch_id = ${branchId}
          AND is_active = true
        LIMIT 1
      `;
      return result[0] || null;
    } catch (error) {
      console.error("Error finding default float account:", error);
      return null;
    }
  }

  static async markTransactionDeleted(
    id: string,
    sourceModule: string,
    data: any
  ) {
    try {
      switch (sourceModule) {
        case "momo":
          await sql`UPDATE momo_transactions SET deleted = true, updated_at = NOW() WHERE id = ${id}`;
          break;
        case "agency_banking":
          await sql`UPDATE agency_banking_transactions SET deleted = true, updated_at = NOW() WHERE id = ${id}`;
          break;
        case "e_zwich":
          // Check both withdrawal and card issuance tables
          const withdrawal =
            await sql`SELECT id FROM e_zwich_withdrawals WHERE id = ${id}`;
          if (withdrawal.length > 0) {
            await sql`UPDATE e_zwich_withdrawals SET deleted = true, updated_at = NOW() WHERE id = ${id}`;
          } else {
            await sql`UPDATE ezwich_card_issuance SET deleted = true, updated_at = NOW() WHERE id = ${id}`;
          }
          break;
        case "power":
          await sql`UPDATE power_transactions SET deleted = true, updated_at = NOW() WHERE id = ${id}`;
          break;
        case "jumia":
          await sql`UPDATE jumia_transactions SET deleted = true, updated_at = NOW() WHERE id = ${id}`;
          break;
        default:
          return {
            success: false,
            error: `Invalid source module: ${sourceModule}`,
          };
      }
      return { success: true };
    } catch (error) {
      console.error("Error marking transaction deleted:", error);
      return { success: false, error: "Failed to mark transaction deleted" };
    }
  }

  /**
   * Log a transaction deletion event for auditing
   */
  static async logTransactionDeletion(
    deleteData: TransactionDeleteData,
    originalTransaction: any
  ) {
    try {
      // If you have an AuditLoggerService, use it here. Otherwise, log directly.
      if (typeof AuditLoggerService?.log === "function") {
        await AuditLoggerService.log({
          action: "delete",
          entity: "transaction",
          entityId: deleteData.id,
          userId: deleteData.processedBy,
          branchId: deleteData.branchId,
          details: {
            sourceModule: deleteData.sourceModule,
            reason: deleteData.reason,
            originalTransaction,
          },
        });
      } else {
        // Fallback: insert into audit_logs table if exists
        await sql`
          INSERT INTO audit_logs (action, entity, entity_id, user_id, branch_id, details, created_at)
          VALUES (
            'delete',
            'transaction',
            ${deleteData.id},
            ${deleteData.processedBy},
            ${deleteData.branchId},
            ${JSON.stringify({
              sourceModule: deleteData.sourceModule,
              reason: deleteData.reason,
              originalTransaction,
            })},
            NOW()
          )
        `;
      }
    } catch (error) {
      console.error("Error logging transaction deletion:", error);
    }
  }

  /**
   * Log a transaction edit event for auditing
   */
  static async logTransactionEdit(
    editData: TransactionEditData,
    originalTransaction: any
  ) {
    try {
      if (typeof AuditLoggerService?.log === "function") {
        await AuditLoggerService.log({
          action: "edit",
          entity: "transaction",
          entityId: editData.id,
          userId: originalTransaction.user_id,
          branchId: originalTransaction.branch_id,
          details: {
            sourceModule: editData.sourceModule,
            editData,
            originalTransaction,
          },
        });
      } else {
        await sql`
          INSERT INTO audit_logs (action, entity, entity_id, user_id, branch_id, details, created_at)
          VALUES (
            'edit',
            'transaction',
            ${editData.id},
            ${originalTransaction.user_id},
            ${originalTransaction.branch_id},
            ${JSON.stringify({
              sourceModule: editData.sourceModule,
              editData,
              originalTransaction,
            })},
            NOW()
          )
        `;
      }
    } catch (error) {
      console.error("Error logging transaction edit:", error);
    }
  }

  /**
   * Reverse the effect of a transaction on the cash till (for deletion/reversal)
   * This restores the cash till balance as if the transaction never happened.
   */
  private static async reverseCashTillBalances(
    sourceModule: string,
    originalTransaction: any
  ) {
    try {
      // Only proceed if cash_till_id is present
      const cashTillId = originalTransaction.cash_till_id;
      if (!cashTillId) return { success: true };
      // Get the cash till account
      const cashTillResult =
        await sql`SELECT * FROM cash_tills WHERE id = ${cashTillId}`;
      if (!cashTillResult || cashTillResult.length === 0) {
        return { success: false, error: "Cash till not found" };
      }
      const cashTill = cashTillResult[0];
      // Determine the effect direction based on module and transaction type
      const effect = this.getCashTillEffect(sourceModule, originalTransaction);
      // To reverse, subtract the effect
      const adjustment = -effect;
      const currentBalance = Number(cashTill.current_balance);
      const newBalance = currentBalance + adjustment;
      await sql`
        UPDATE cash_tills
        SET current_balance = ${newBalance}, updated_at = NOW()
        WHERE id = ${cashTill.id}
      `;
      await sql`
        INSERT INTO cash_till_transactions (
          cash_till_id, transaction_type, amount, balance_before, balance_after, reference, description, created_at
        ) VALUES (
          ${cashTill.id},
          'reversal',
          ${adjustment},
          ${currentBalance},
          ${newBalance},
          ${`DELETE-${originalTransaction.id}`},
          ${`Transaction deletion reversal for ${sourceModule} transaction ${originalTransaction.id}`},
          NOW()
        )
      `;
      return { success: true };
    } catch (error) {
      console.error("Error reversing cash till balances:", error);
      return { success: false, error: "Failed to reverse cash till balances" };
    }
  }

  /**
   * Get the effect of a transaction on the cash till (positive=increase, negative=decrease)
   */
  private static getCashTillEffect(
    sourceModule: string,
    transaction: any
  ): number {
    const amount = Number(transaction.amount);
    const fee = Number(transaction.fee || transaction.commission || 0);
    const type = (
      transaction.type ||
      transaction.transaction_type ||
      ""
    ).toLowerCase();
    switch (sourceModule) {
      case "momo":
        if (type === "cash-in") return amount + fee; // cash till increases
        if (type === "cash-out") return -amount + fee; // cash till decreases by amount, but keeps fee
        break;
      case "agency_banking":
        if (type === "deposit") return amount + fee; // cash till increases by amount + fee
        if (type === "withdrawal") return -amount + fee; // cash till decreases by amount, but keeps fee
        if (type === "interbank transfer" || type === "interbank")
          return amount + fee; // cash till increases by amount + fee
        break;
      case "e_zwich":
        if (type === "withdrawal") return -(amount + fee); // cash till decreases
        if (type === "card issuance") return amount + fee; // cash till increases
        break;
      case "power":
        return amount + fee; // cash till increases on sale
      case "jumia":
        return amount + fee; // cash till increases on sale
      default:
        return 0;
    }
    return 0;
  }
}
