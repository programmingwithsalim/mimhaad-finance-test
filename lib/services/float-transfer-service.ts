import { sql } from "@vercel/postgres";
import { AutoGLMappingService } from "./auto-gl-mapping-service";
import { UnifiedGLPostingService } from "./unified-gl-posting-service";
import { AuditLoggerService } from "./audit-logger-service";

export interface FloatTransfer {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  fee?: number;
  reference: string;
  description?: string;
  status: "pending" | "completed" | "failed" | "reversed";
  created_by: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
  gl_transaction_id?: string;
}

export interface FloatTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  fee?: number;
  description?: string;
  userId: string;
  branchId: string;
  branchName?: string;
}

export class FloatTransferService {
  /**
   * Create a float transfer between accounts
   */
  static async createFloatTransfer(
    data: FloatTransferRequest
  ): Promise<FloatTransfer> {
    console.log(
      `🔄 [FLOAT-TRANSFER] Creating transfer: ${data.amount} from ${data.sourceAccountId} to ${data.destinationAccountId}`
    );

    // Validate accounts exist and are active
    const [sourceAccount, destinationAccount] = await Promise.all([
      this.getFloatAccount(data.sourceAccountId),
      this.getFloatAccount(data.destinationAccountId),
    ]);

    if (!sourceAccount || !destinationAccount) {
      throw new Error("Source or destination account not found");
    }

    if (!sourceAccount.is_active || !destinationAccount.is_active) {
      throw new Error("One or both accounts are inactive");
    }

    // Validate sufficient balance
    if (sourceAccount.current_balance < data.amount) {
      throw new Error("Insufficient balance in source account");
    }

    // Validate accounts are in the same branch
    if (sourceAccount.branch_id !== destinationAccount.branch_id) {
      throw new Error("Cannot transfer between different branches");
    }

    // Generate reference
    const reference = `FT-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create transfer record
    const transferId = await sql`SELECT gen_random_uuid() as id`;
    const id = transferId[0].id;

    const transfer = await sql`
      INSERT INTO float_transfers (
        id, source_account_id, destination_account_id, amount, fee, 
        reference, description, status, created_by, branch_id, created_at, updated_at
      ) VALUES (
        ${id}, ${data.sourceAccountId}, ${data.destinationAccountId}, 
        ${data.amount}, ${data.fee || 0}, ${reference}, ${
      data.description || ""
    }, 
        'pending', ${data.userId}, ${data.branchId}, NOW(), NOW()
      ) RETURNING *
    `;

    try {
      // Ensure GL mappings exist for float transfers
      await this.ensureFloatTransferGLMappings(data.branchId);

      // Execute the transfer
      await this.executeTransfer(transfer[0], data);

      // Create GL entries
      await this.createGLEntries(transfer[0], data);

      console.log(`✅ [FLOAT-TRANSFER] Transfer completed: ${reference}`);
      return transfer[0];
    } catch (error) {
      // Mark transfer as failed
      await sql`
        UPDATE float_transfers 
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${id}
      `;

      console.error(`❌ [FLOAT-TRANSFER] Transfer failed: ${reference}`, error);
      throw error;
    }
  }

  /**
   * Execute the actual float transfer
   */
  private static async executeTransfer(
    transfer: FloatTransfer,
    data: FloatTransferRequest
  ): Promise<void> {
    // Update source account balance (decrease)
    await sql`
      UPDATE float_accounts 
      SET current_balance = current_balance - ${data.amount}, updated_at = NOW()
      WHERE id = ${data.sourceAccountId}
    `;

    // Update destination account balance (increase)
    await sql`
      UPDATE float_accounts 
      SET current_balance = current_balance + ${data.amount}, updated_at = NOW()
      WHERE id = ${data.destinationAccountId}
    `;

    // Mark transfer as completed
    await sql`
      UPDATE float_transfers 
      SET status = 'completed', updated_at = NOW()
      WHERE id = ${transfer.id}
    `;

    console.log(
      `🔄 [FLOAT-TRANSFER] Balances updated for transfer: ${transfer.reference}`
    );
  }

  /**
   * Ensure GL mappings exist for float transfers
   */
  private static async ensureFloatTransferGLMappings(
    branchId: string
  ): Promise<void> {
    try {
      const mappings = await AutoGLMappingService.ensureGLMappings(
        "float_transfers",
        "float_transfer",
        branchId,
        ["source", "destination", "fee", "revenue"]
      );

      console.log(`✅ [FLOAT-TRANSFER] GL mappings ensured:`, mappings);

      // Create reversal mappings
      await AutoGLMappingService.ensureReversalMappings(
        "float_transfers",
        "float_transfer",
        branchId,
        mappings
      );
    } catch (error) {
      console.warn(`⚠️ [FLOAT-TRANSFER] Failed to ensure GL mappings:`, error);
    }
  }

  /**
   * Create GL entries for float transfer
   */
  private static async createGLEntries(
    transfer: FloatTransfer,
    data: FloatTransferRequest
  ): Promise<void> {
    try {
      const glResult = await UnifiedGLPostingService.createGLEntries({
        transactionId: transfer.id,
        sourceModule: "float_transfers",
        transactionType: "float_transfer",
        amount: data.amount,
        fee: data.fee || 0,
        customerName: "Float Transfer",
        reference: transfer.reference,
        processedBy: data.userId,
        branchId: data.branchId,
        branchName: data.branchName || "Branch",
        metadata: {
          sourceAccountId: data.sourceAccountId,
          destinationAccountId: data.destinationAccountId,
          transferType: "float_transfer",
        },
      });

      if (glResult.success && glResult.glTransactionId) {
        // Update transfer with GL transaction ID
        await sql`
          UPDATE float_transfers 
          SET gl_transaction_id = ${glResult.glTransactionId}, updated_at = NOW()
          WHERE id = ${transfer.id}
        `;

        console.log(
          `✅ [FLOAT-TRANSFER] GL entries created: ${glResult.glTransactionId}`
        );
      } else {
        console.warn(
          `⚠️ [FLOAT-TRANSFER] GL posting failed: ${glResult.error}`
        );
      }
    } catch (error) {
      console.warn(`⚠️ [FLOAT-TRANSFER] GL posting error:`, error);
    }
  }

  /**
   * Reverse a float transfer
   */
  static async reverseFloatTransfer(
    transferId: string,
    reason: string,
    userId: string,
    branchId: string
  ): Promise<boolean> {
    console.log(`🔄 [FLOAT-TRANSFER] Reversing transfer: ${transferId}`);

    const transfer = await this.getFloatTransfer(transferId);
    if (!transfer) {
      throw new Error("Transfer not found");
    }

    if (transfer.status === "reversed") {
      throw new Error("Transfer has already been reversed");
    }

    if (transfer.status !== "completed") {
      throw new Error("Only completed transfers can be reversed");
    }

    try {
      // Reverse the balances
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${transfer.amount}, updated_at = NOW()
        WHERE id = ${transfer.source_account_id}
      `;

      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance - ${transfer.amount}, updated_at = NOW()
        WHERE id = ${transfer.destination_account_id}
      `;

      // Mark transfer as reversed
      await sql`
        UPDATE float_transfers 
        SET status = 'reversed', updated_at = NOW()
        WHERE id = ${transferId}
      `;

      // Create reversal GL entries
      await this.createReversalGLEntries(transfer, reason, userId, branchId);

      console.log(
        `✅ [FLOAT-TRANSFER] Transfer reversed: ${transfer.reference}`
      );
      return true;
    } catch (error) {
      console.error(
        `❌ [FLOAT-TRANSFER] Reversal failed: ${transferId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create reversal GL entries
   */
  private static async createReversalGLEntries(
    transfer: FloatTransfer,
    reason: string,
    userId: string,
    branchId: string
  ): Promise<void> {
    try {
      const glResult = await UnifiedGLPostingService.createGLEntries({
        transactionId: transfer.id,
        sourceModule: "float_transfers",
        transactionType: "reversal_float_transfer",
        amount: transfer.amount,
        fee: transfer.fee || 0,
        customerName: "Float Transfer Reversal",
        reference: `${transfer.reference}-REV`,
        processedBy: userId,
        branchId: branchId,
        branchName: "Branch",
        metadata: {
          originalTransferId: transfer.id,
          reversalReason: reason,
          sourceAccountId: transfer.source_account_id,
          destinationAccountId: transfer.destination_account_id,
        },
      });

      if (glResult.success) {
        console.log(
          `✅ [FLOAT-TRANSFER] Reversal GL entries created: ${glResult.glTransactionId}`
        );
      }
    } catch (error) {
      console.warn(`⚠️ [FLOAT-TRANSFER] Reversal GL posting failed:`, error);
    }
  }

  /**
   * Get float account by ID
   */
  private static async getFloatAccount(accountId: string): Promise<any> {
    const account = await sql`
      SELECT * FROM float_accounts WHERE id = ${accountId}
    `;
    return account.length > 0 ? account[0] : null;
  }

  /**
   * Get float transfer by ID
   */
  private static async getFloatTransfer(
    transferId: string
  ): Promise<FloatTransfer | null> {
    const transfer = await sql`
      SELECT * FROM float_transfers WHERE id = ${transferId}
    `;
    return transfer.length > 0 ? transfer[0] : null;
  }

  /**
   * Get float transfers for a branch
   */
  static async getFloatTransfers(
    branchId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FloatTransfer[]> {
    const transfers = await sql`
      SELECT * FROM float_transfers 
      WHERE branch_id = ${branchId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return transfers;
  }
}
