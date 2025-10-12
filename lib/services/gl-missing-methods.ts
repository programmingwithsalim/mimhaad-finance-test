import { neon } from "@neondatabase/serverless";
import { v4 as uuidv4 } from "uuid";
import { AuditLoggerService } from "./audit-logger-service";

const sql = neon(process.env.DATABASE_URL!);

export class MissingGLMethods {
  /**
   * Create GL entries for transaction reversals
   */
  static async createReversalGLEntries({
    transactionId,
    sourceModule,
    transactionType,
    amount,
    fee,
    customerName,
    reference,
    reason,
    processedBy,
    branchId,
    branchName,
    metadata,
  }: {
    transactionId: string;
    sourceModule: string;
    transactionType: string;
    amount: number;
    fee: number;
    customerName?: string;
    reference: string;
    reason: string;
    processedBy: string;
    branchId: string;
    branchName?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      console.log(
        "🔷 [GL] Creating reversal GL entries for " +
          sourceModule +
          " transaction:",
        transactionId
      );

      const glTransactionIdResult = await sql`SELECT gen_random_uuid() as id`;
      const glTransactionId = glTransactionIdResult[0].id;

      // Get GL account mappings for reversal
      const mappings = await sql`
        SELECT 
          gm.mapping_type,
          gm.gl_account_id,
          COALESCE(ga.code, '') as gl_account_code,
          COALESCE(ga.name, '') as gl_account_name
        FROM gl_mappings gm
        LEFT JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        WHERE gm.transaction_type = ${transactionType}
        AND gm.branch_id = ${branchId}
        AND gm.is_active = true
        ORDER BY gm.mapping_type
      `;

      if (mappings.length === 0) {
        console.warn("⚠️ [GL] No GL mappings found for reversal transaction:", {
          sourceModule,
          transactionType,
          branchId,
        });
        return { success: true }; // Don't fail if no mappings
      }

      const accounts = this.formatGLAccounts(mappings);
      const entries = this.createReversalGLEntriesForTransaction(
        {
          transactionId,
          sourceModule,
          transactionType,
          amount,
          fee,
          customerName,
          reference: `${reference}-REVERSAL`,
          processedBy,
          branchId,
          branchName,
          metadata: { ...metadata, reason, reversalOf: transactionId },
        },
        accounts
      );

      const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredits = entries.reduce(
        (sum, entry) => sum + entry.credit,
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          "Reversal GL entries do not balance: Debits " +
            totalDebits +
            ", Credits " +
            totalCredits
        );
      }

      // Create GL transaction record
      await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_id, 
          source_transaction_type, description, status, created_by, metadata
        )
        VALUES (
          ${glTransactionId}, 
          CURRENT_DATE, 
          ${sourceModule}, 
          ${transactionId}, 
          ${transactionType}, 
          ${`Reversal: ${reference} - ${reason}`}, 
          'posted', 
          ${processedBy}, 
          ${JSON.stringify({ ...metadata, reason, reversalOf: transactionId })}
        )
      `;

      // Create GL journal entries
      for (const entry of entries) {
        // Ensure values are properly converted to numbers
        const debit = Number(entry.debit) || 0;
        const credit = Number(entry.credit) || 0;

        // Skip zero-value entries
        if (debit === 0 && credit === 0) continue;

        console.log(`🔷 [GL] Creating journal entry:`, {
          accountId: entry.accountId,
          accountCode: entry.accountCode,
          debit: debit,
          credit: credit,
          debitType: typeof debit,
          creditType: typeof credit,
        });

        await sql`
          INSERT INTO gl_journal_entries (
            id, transaction_id, account_id, account_code, 
            debit, credit, description, metadata
          )
          VALUES (
            gen_random_uuid(), 
            ${glTransactionId}, 
            ${entry.accountId}, 
            ${entry.accountCode}, 
            ${debit}, 
            ${credit}, 
            ${entry.description}, 
            ${JSON.stringify(entry.metadata || {})}
          )
        `;
      }

      // Update account balances
      await this.updateAccountBalances(entries);

      // Log audit entry
      const userName = await this.getUserFullName(processedBy);
      await AuditLoggerService.log({
        userId: processedBy,
        username: userName,
        actionType: "gl_transaction_reversal",
        entityType: "gl_transaction",
        entityId: glTransactionId,
        description: `GL reversal entries created for ${sourceModule} transaction ${transactionId} - ${reason}`,
        metadata: {
          originalTransactionId: transactionId,
          reason,
          amount,
          fee,
        },
      });

      console.log(
        "🔷 [GL] Reversal GL entries created successfully for " +
          sourceModule +
          " transaction: " +
          transactionId
      );

      return { success: true, glTransactionId };
    } catch (error) {
      console.error("Error creating reversal GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create GL entries for transaction adjustments
   */
  static async createAdjustmentGLEntries({
    transactionId,
    sourceModule,
    transactionType,
    originalAmount,
    originalFee,
    newAmount,
    newFee,
    customerName,
    reference,
    reason,
    processedBy,
    branchId,
    branchName,
    metadata,
  }: {
    transactionId: string;
    sourceModule: string;
    transactionType: string;
    originalAmount: number;
    originalFee: number;
    newAmount: number;
    newFee: number;
    customerName?: string;
    reference: string;
    reason: string;
    processedBy: string;
    branchId: string;
    branchName?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      console.log(
        "🔷 [GL] Creating adjustment GL entries for " +
          sourceModule +
          " transaction:",
        transactionId
      );

      const amountDifference = newAmount - originalAmount;
      const feeDifference = newFee - originalFee;

      if (amountDifference === 0 && feeDifference === 0) {
        console.log("No adjustment needed - amounts are the same");
        return { success: true };
      }

      const glTransactionIdResult = await sql`SELECT gen_random_uuid() as id`;
      const glTransactionId = glTransactionIdResult[0].id;

      // Get GL account mappings for adjustment
      const mappings = await sql`
        SELECT 
          gm.mapping_type,
          gm.gl_account_id,
          COALESCE(ga.code, '') as gl_account_code,
          COALESCE(ga.name, '') as gl_account_name
        FROM gl_mappings gm
        LEFT JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        WHERE gm.transaction_type = ${transactionType}
        AND gm.branch_id = ${branchId}
        AND gm.is_active = true
        ORDER BY gm.mapping_type
      `;

      if (mappings.length === 0) {
        console.warn(
          "⚠️ [GL] No GL mappings found for adjustment transaction:",
          { sourceModule, transactionType, branchId }
        );
        return { success: true }; // Don't fail if no mappings
      }

      const accounts = this.formatGLAccounts(mappings);
      const entries = this.createAdjustmentGLEntriesForTransaction(
        {
          transactionId,
          sourceModule,
          transactionType,
          amountDifference,
          feeDifference,
          customerName,
          reference: `${reference}-ADJUSTMENT`,
          processedBy,
          branchId,
          branchName,
          metadata: {
            ...metadata,
            reason,
            originalAmount,
            originalFee,
            newAmount,
            newFee,
            adjustmentOf: transactionId,
          },
        },
        accounts
      );

      const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredits = entries.reduce(
        (sum, entry) => sum + entry.credit,
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          "Adjustment GL entries do not balance: Debits " +
            totalDebits +
            ", Credits " +
            totalCredits
        );
      }

      // Create GL transaction record
      await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_id, 
          source_transaction_type, description, status, created_by, metadata
        )
        VALUES (
          ${glTransactionId}, 
          CURRENT_DATE, 
          ${sourceModule}, 
          ${transactionId}, 
          ${transactionType}, 
          ${`Adjustment: ${reference} - ${reason}`}, 
          'posted', 
          ${processedBy}, 
          ${JSON.stringify({
            ...metadata,
            reason,
            originalAmount,
            originalFee,
            newAmount,
            newFee,
            adjustmentOf: transactionId,
          })}
        )
      `;

      // Create GL journal entries
      for (const entry of entries) {
        await sql`
          INSERT INTO gl_journal_entries (
            id, transaction_id, account_id, account_code, 
            debit, credit, description, metadata
          )
          VALUES (
            gen_random_uuid(), 
            ${glTransactionId}, 
            ${entry.accountId}, 
            ${entry.accountCode}, 
            ${entry.debit}, 
            ${entry.credit}, 
            ${entry.description}, 
            ${JSON.stringify(entry.metadata || {})}
          )
        `;
      }

      // Update account balances
      await this.updateAccountBalances(entries);

      // Log audit entry
      const userName = await this.getUserFullName(processedBy);
      await AuditLoggerService.log({
        userId: processedBy,
        username: userName,
        actionType: "gl_transaction_adjustment",
        entityType: "gl_transaction",
        entityId: glTransactionId,
        description: `GL adjustment entries created for ${sourceModule} transaction ${transactionId} - ${reason}`,
        metadata: {
          originalTransactionId: transactionId,
          reason,
          originalAmount,
          originalFee,
          newAmount,
          newFee,
          amountDifference,
          feeDifference,
        },
      });

      console.log(
        "🔷 [GL] Adjustment GL entries created successfully for " +
          sourceModule +
          " transaction: " +
          transactionId
      );

      return { success: true, glTransactionId };
    } catch (error) {
      console.error("Error creating adjustment GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Format GL accounts from database mappings
   */
  private static formatGLAccounts(
    mappings: Array<{
      mapping_type: string;
      gl_account_id: string;
      gl_account_code: string;
      gl_account_name: string;
    }>
  ): Record<string, any> {
    const accounts: Record<string, any> = {};

    for (const mapping of mappings) {
      accounts[mapping.mapping_type] = {
        id: mapping.gl_account_id,
        code: mapping.gl_account_code,
        name: mapping.gl_account_name,
      };
    }

    return accounts;
  }

  /**
   * Create reversal GL entries for a transaction
   */
  private static createReversalGLEntriesForTransaction(
    data: {
      transactionId: string;
      sourceModule: string;
      transactionType: string;
      amount: number;
      fee: number;
      customerName?: string;
      reference: string;
      processedBy: string;
      branchId: string;
      branchName?: string;
      metadata?: Record<string, any>;
    },
    accounts: Record<string, any>
  ): Array<{
    accountId: string;
    accountCode: string;
    debit: number;
    credit: number;
    description: string;
    metadata?: Record<string, any>;
  }> {
    const entries: Array<{
      accountId: string;
      accountCode: string;
      debit: number;
      credit: number;
      description: string;
      metadata?: Record<string, any>;
    }> = [];

    // Create reversal entries based on transaction type
    switch (data.transactionType) {
      case "withdrawal":
        // Original: Revenue debit, Main credit, Fee credit, Main debit
        // Reversal: Revenue credit, Main debit, Fee debit, Main credit
        if (accounts.revenue && accounts.main) {
          // Reverse revenue entry
          entries.push({
            accountId: accounts.revenue.id,
            accountCode: accounts.revenue.code,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Revenue for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse main account entry
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee.id,
              accountCode: accounts.fee.code,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main.id,
              accountCode: accounts.main.code,
              debit: 0,
              credit: data.fee,
              description: `Reversal: Fee debit for ${data.reference}`,
              metadata: data.metadata,
            });
          }
        }
        break;

      case "deposit":
        // Original: Main debit, Revenue credit, Fee credit, Main debit
        // Reversal: Main credit, Revenue debit, Fee debit, Main credit
        if (accounts.main && accounts.revenue) {
          // Reverse main account entry
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse revenue entry
          entries.push({
            accountId: accounts.revenue.id,
            accountCode: accounts.revenue.code,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Revenue for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee.id,
              accountCode: accounts.fee.code,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main.id,
              accountCode: accounts.main.code,
              debit: 0,
              credit: data.fee,
              description: `Reversal: Fee debit for ${data.reference}`,
              metadata: data.metadata,
            });
          }
        }
        break;

      case "cash-in":
        // Original: Main debit, Liability credit, Fee credit, Main debit
        // Reversal: Main credit, Liability debit, Fee debit, Main credit
        if (accounts.main && accounts.liability) {
          // Reverse main account entry
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse liability entry
          entries.push({
            accountId: accounts.liability.id,
            accountCode: accounts.liability.code,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Liability for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee.id,
              accountCode: accounts.fee.code,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main.id,
              accountCode: accounts.main.code,
              debit: 0,
              credit: data.fee,
              description: `Reversal: Fee debit for ${data.reference}`,
              metadata: data.metadata,
            });
          }
        }
        break;

      case "cash-out":
        // Original: Main debit, Asset credit, Fee credit, Main debit
        // Reversal: Main credit, Asset debit, Fee debit, Main credit
        if (accounts.main && accounts.asset) {
          // Reverse main account entry
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse asset entry
          entries.push({
            accountId: accounts.asset.id,
            accountCode: accounts.asset.code,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Asset for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee.id,
              accountCode: accounts.fee.code,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main.id,
              accountCode: accounts.main.code,
              debit: 0,
              credit: data.fee,
              description: `Reversal: Fee debit for ${data.reference}`,
              metadata: data.metadata,
            });
          }
        }
        break;

      default:
        // Generic reversal for unknown transaction types
        if (accounts.main) {
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: 0,
            credit: data.amount + data.fee,
            description: `Reversal: ${data.reference}`,
            metadata: data.metadata,
          });
        }
        break;
    }

    return entries;
  }

  /**
   * Create adjustment GL entries for a transaction
   */
  private static createAdjustmentGLEntriesForTransaction(
    data: {
      transactionId: string;
      sourceModule: string;
      transactionType: string;
      amountDifference: number;
      feeDifference: number;
      customerName?: string;
      reference: string;
      processedBy: string;
      branchId: string;
      branchName?: string;
      metadata?: Record<string, any>;
    },
    accounts: Record<string, any>
  ): Array<{
    accountId: string;
    accountCode: string;
    debit: number;
    credit: number;
    description: string;
    metadata?: Record<string, any>;
  }> {
    const entries: Array<{
      accountId: string;
      accountCode: string;
      debit: number;
      credit: number;
      description: string;
      metadata?: Record<string, any>;
    }> = [];

    // Adjust main account if amount changed
    if (accounts.main && data.amountDifference !== 0) {
      const isMainDebit = this.isMainAccountDebit(
        data.sourceModule,
        data.transactionType
      );
      if (isMainDebit) {
        if (data.amountDifference > 0) {
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: data.amountDifference,
            credit: 0,
            description: `Adjustment: ${data.reference} - ${
              data.customerName || "Customer"
            }`,
            metadata: data.metadata,
          });
        } else {
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: 0,
            credit: Math.abs(data.amountDifference),
            description: `Adjustment: ${data.reference} - ${
              data.customerName || "Customer"
            }`,
            metadata: data.metadata,
          });
        }
      } else {
        if (data.amountDifference > 0) {
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: 0,
            credit: data.amountDifference,
            description: `Adjustment: ${data.reference} - ${
              data.customerName || "Customer"
            }`,
            metadata: data.metadata,
          });
        } else {
          entries.push({
            accountId: accounts.main.id,
            accountCode: accounts.main.code,
            debit: Math.abs(data.amountDifference),
            credit: 0,
            description: `Adjustment: ${data.reference} - ${
              data.customerName || "Customer"
            }`,
            metadata: data.metadata,
          });
        }
      }
    }

    // Adjust fee account if fee changed
    if (accounts.fee && data.feeDifference !== 0) {
      const isFeeDebit = this.isFeeAccountDebit(
        data.sourceModule,
        data.transactionType
      );
      if (isFeeDebit) {
        if (data.feeDifference > 0) {
          entries.push({
            accountId: accounts.fee.id,
            accountCode: accounts.fee.code,
            debit: data.feeDifference,
            credit: 0,
            description: `Adjustment: Fee for ${data.reference}`,
            metadata: data.metadata,
          });
        } else {
          entries.push({
            accountId: accounts.fee.id,
            accountCode: accounts.fee.code,
            debit: 0,
            credit: Math.abs(data.feeDifference),
            description: `Adjustment: Fee for ${data.reference}`,
            metadata: data.metadata,
          });
        }
      } else {
        if (data.feeDifference > 0) {
          entries.push({
            accountId: accounts.fee.id,
            accountCode: accounts.fee.code,
            debit: 0,
            credit: data.feeDifference,
            description: `Adjustment: Fee for ${data.reference}`,
            metadata: data.metadata,
          });
        } else {
          entries.push({
            accountId: accounts.fee.id,
            accountCode: accounts.fee.code,
            debit: Math.abs(data.feeDifference),
            credit: 0,
            description: `Adjustment: Fee for ${data.reference}`,
            metadata: data.metadata,
          });
        }
      }
    }

    // Add corresponding entries to balance
    if (accounts.asset) {
      const totalAdjustment = data.amountDifference + data.feeDifference;
      if (totalAdjustment !== 0) {
        entries.push({
          accountId: accounts.asset.id,
          accountCode: accounts.asset.code,
          debit: totalAdjustment > 0 ? totalAdjustment : 0,
          credit: totalAdjustment < 0 ? Math.abs(totalAdjustment) : 0,
          description: `Adjustment: Asset adjustment for ${data.reference}`,
          metadata: data.metadata,
        });
      }
    }

    return entries;
  }

  /**
   * Update account balances based on GL entries
   */
  private static async updateAccountBalances(
    entries: Array<{ accountId: string; debit: number; credit: number }>
  ): Promise<void> {
    for (const entry of entries) {
      // Ensure values are properly converted to numbers
      const debit = Number(entry.debit) || 0;
      const credit = Number(entry.credit) || 0;
      const balanceChange = credit - debit;

      console.log(`🔷 [GL] Updating account balance:`, {
        accountId: entry.accountId,
        debit: debit,
        credit: credit,
        balanceChange: balanceChange,
        debitType: typeof debit,
        creditType: typeof credit,
      });

      await sql`
        UPDATE gl_accounts 
        SET 
          balance = COALESCE(balance, 0) + ${balanceChange},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${entry.accountId}
      `;
    }
  }

  /**
   * Helper function to get user's full name
   */
  private static async getUserFullName(userId: string): Promise<string> {
    try {
      if (!userId || userId === "unknown" || userId === "System") {
        return "System User";
      }

      // Check if userId is an email address (contains @)
      if (userId.includes("@")) {
        // Try to find user by email
        const users = await sql`
          SELECT first_name, last_name, email FROM users WHERE email = ${userId}
        `;

        if (users && users.length > 0) {
          const { first_name, last_name, email } = users[0];
          if (first_name && last_name) {
            return `${first_name} ${last_name}`;
          } else if (first_name) {
            return first_name;
          } else if (last_name) {
            return last_name;
          } else if (email) {
            return email;
          }
        }

        // If email not found, return the email as fallback
        return userId;
      }

      // Try to find user by UUID
      const users = await sql`
        SELECT first_name, last_name, email FROM users WHERE id = ${userId}
      `;

      if (users && users.length > 0) {
        const { first_name, last_name, email } = users[0];
        if (first_name && last_name) {
          return `${first_name} ${last_name}`;
        } else if (first_name) {
          return first_name;
        } else if (last_name) {
          return last_name;
        } else if (email) {
          return email;
        }
      }

      return "Unknown User";
    } catch (error) {
      console.error(`Failed to get user name for ID ${userId}:`, error);
      return "Unknown User";
    }
  }

  /**
   * Determine if main account should be debited for a transaction
   */
  private static isMainAccountDebit(
    sourceModule: string,
    transactionType: string
  ): boolean {
    // This logic should match the original transaction posting logic
    // For now, we'll use a simple heuristic based on transaction type
    const debitTypes = ["cash-in", "deposit", "payment"];
    const creditTypes = ["cash-out", "withdrawal", "transfer"];

    if (debitTypes.includes(transactionType.toLowerCase())) {
      return true;
    } else if (creditTypes.includes(transactionType.toLowerCase())) {
      return false;
    }

    // Default to debit for most transactions
    return true;
  }

  /**
   * Determine if fee account should be debited for a transaction
   */
  private static isFeeAccountDebit(
    sourceModule: string,
    transactionType: string
  ): boolean {
    // Fees are typically credited (income) for most transactions
    // This should match the original fee posting logic
    return false; // Default to credit (income)
  }
}
