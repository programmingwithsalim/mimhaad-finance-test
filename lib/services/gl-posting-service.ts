import { sql } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export interface GLEntry {
  accountId: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
  metadata?: Record<string, any>;
}

export interface GLTransactionData {
  date: string;
  sourceModule: string;
  sourceTransactionId: string;
  sourceTransactionType: string;
  description: string;
  entries: GLEntry[];
  createdBy: string;
  branchId?: string;
  branchName?: string;
  metadata?: Record<string, any>;
}

export class GLPostingService {
  static async createAndPostTransaction(
    transactionData: GLTransactionData,
    autoPost = true
  ): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      const totalDebits = transactionData.entries.reduce(
        (sum, entry) => sum + entry.debit,
        0
      );
      const totalCredits = transactionData.entries.reduce(
        (sum, entry) => sum + entry.credit,
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          `GL entries don't balance: Debits ${totalDebits}, Credits ${totalCredits}`
        );
      }

      const existingTransaction = await sql`
        SELECT id FROM gl_transactions 
        WHERE source_transaction_id = ${transactionData.sourceTransactionId}
        AND source_module = ${transactionData.sourceModule}
      `;

      if (existingTransaction.length > 0) {
        console.log(
          `GL transaction already exists for ${transactionData.sourceModule} transaction ${transactionData.sourceTransactionId}`
        );
        return { success: true, glTransactionId: existingTransaction[0].id };
      }

      const glTransactionId = uuidv4();

      await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_id,
          source_transaction_type, description, status, created_by, metadata
        ) VALUES (
          ${glTransactionId}, ${transactionData.date}, ${
        transactionData.sourceModule
      },
          ${transactionData.sourceTransactionId}, ${
        transactionData.sourceTransactionType
      },
          ${transactionData.description}, ${autoPost ? "posted" : "pending"}, 
          ${transactionData.createdBy}, ${
        transactionData.metadata
          ? JSON.stringify(transactionData.metadata)
          : null
      }
        )
      `;

      for (const entry of transactionData.entries) {
        const entryId = uuidv4();
        await sql`
          INSERT INTO gl_journal_entries (
            id, transaction_id, account_id, account_code, debit,
            credit, description, metadata
          ) VALUES (
            ${entryId}, ${glTransactionId}, ${entry.accountId}, ${
          entry.accountCode
        },
            ${entry.debit}, ${entry.credit}, ${entry.description},
            ${entry.metadata ? JSON.stringify(entry.metadata) : null}
          )
        `;
      }

      if (autoPost) {
        await this.updateAccountBalances(
          transactionData.entries,
          transactionData.date
        );
      }

      return { success: true, glTransactionId };
    } catch (error) {
      console.error("Error creating GL transaction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async createCommissionGLEntries(params: {
    commissionId: string;
    source: string;
    reference: string;
    amount: number;
    month: string;
    createdBy: string;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      const receivableAccount = await this.getOrCreateGLAccount(
        "1200",
        "Commission Receivable",
        "Asset"
      );
      const revenueAccount = await this.getOrCreateGLAccount(
        "4100",
        "Commission Revenue",
        "Revenue"
      );

      if (!receivableAccount || !revenueAccount) {
        throw new Error("Failed to get or create required GL accounts");
      }

      const entries: GLEntry[] = [
        {
          accountId: receivableAccount.id,
          accountCode: receivableAccount.code,
          debit: params.amount,
          credit: 0,
          description: `Commission receivable - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            month: params.month,
          },
        },
        {
          accountId: revenueAccount.id,
          accountCode: revenueAccount.code,
          debit: 0,
          credit: params.amount,
          description: `Commission revenue - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            month: params.month,
          },
        },
      ];

      const glTransactionData: GLTransactionData = {
        date: new Date().toISOString().split("T")[0],
        sourceModule: "commissions",
        sourceTransactionId: params.commissionId,
        sourceTransactionType: "commission_revenue",
        description: `Commission revenue earned - ${params.source} - ${params.reference}`,
        entries,
        createdBy: params.createdBy,
        metadata: {
          commissionId: params.commissionId,
          source: params.source,
          reference: params.reference,
          month: params.month,
        },
      };

      return await this.createAndPostTransaction(glTransactionData, true);
    } catch (error) {
      console.error("Error creating commission GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async createCommissionPaymentGLEntries(params: {
    commissionId: string;
    source: string;
    reference: string;
    amount: number;
    paymentMethod: string;
    createdBy: string;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      const cashAccount = await this.getOrCreateGLAccount(
        "1001",
        "Cash",
        "Asset"
      );
      const receivableAccount = await this.getOrCreateGLAccount(
        "1200",
        "Commission Receivable",
        "Asset"
      );

      if (!cashAccount || !receivableAccount) {
        throw new Error("Failed to get or create required GL accounts");
      }

      const entries: GLEntry[] = [
        {
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          debit: params.amount,
          credit: 0,
          description: `Commission payment received - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            paymentMethod: params.paymentMethod,
          },
        },
        {
          accountId: receivableAccount.id,
          accountCode: receivableAccount.code,
          debit: 0,
          credit: params.amount,
          description: `Commission receivable settled - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            paymentMethod: params.paymentMethod,
          },
        },
      ];

      const glTransactionData: GLTransactionData = {
        date: new Date().toISOString().split("T")[0],
        sourceModule: "commissions",
        sourceTransactionId: `${params.commissionId}-payment`,
        sourceTransactionType: "commission_payment",
        description: `Commission payment received - ${params.source} - ${params.reference}`,
        entries,
        createdBy: params.createdBy,
        metadata: {
          commissionId: params.commissionId,
          source: params.source,
          reference: params.reference,
          paymentMethod: params.paymentMethod,
        },
      };

      return await this.createAndPostTransaction(glTransactionData, true);
    } catch (error) {
      console.error("Error creating commission payment GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async createExpenseGLEntries(params: {
    expenseId: string;
    expenseHeadId: string;
    amount: number;
    description: string;
    paymentSource: string;
    createdBy: string;
    branchId?: string;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      const expenseAccount = await this.getOrCreateGLAccount(
        "6000",
        "General Expenses",
        "Expense"
      );
      const payableAccount = await this.getOrCreateGLAccount(
        "2200",
        "Accounts Payable",
        "Liability"
      );

      if (!expenseAccount || !payableAccount) {
        throw new Error("Failed to get or create required GL accounts");
      }

      const entries: GLEntry[] = [
        {
          accountId: expenseAccount.id,
          accountCode: expenseAccount.code,
          debit: params.amount,
          credit: 0,
          description: `Expense - ${params.description}`,
          metadata: {
            expenseId: params.expenseId,
            expenseHeadId: params.expenseHeadId,
            paymentSource: params.paymentSource,
          },
        },
        {
          accountId: payableAccount.id,
          accountCode: payableAccount.code,
          debit: 0,
          credit: params.amount,
          description: `Expense payable - ${params.description}`,
          metadata: {
            expenseId: params.expenseId,
            expenseHeadId: params.expenseHeadId,
            paymentSource: params.paymentSource,
          },
        },
      ];

      const glTransactionData: GLTransactionData = {
        date: new Date().toISOString().split("T")[0],
        sourceModule: "expenses",
        sourceTransactionId: params.expenseId,
        sourceTransactionType: "expense_accrual",
        description: `Expense accrual - ${params.description}`,
        entries,
        createdBy: params.createdBy,
        branchId: params.branchId,
        metadata: {
          expenseId: params.expenseId,
          expenseHeadId: params.expenseHeadId,
          paymentSource: params.paymentSource,
        },
      };

      return await this.createAndPostTransaction(glTransactionData, true);
    } catch (error) {
      console.error("Error creating expense GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async createMoMoGLEntries(params: {
    transactionId: string;
    type: "cash-in" | "cash-out";
    amount: number;
    fee: number;
    provider: string;
    phoneNumber: string;
    customerName: string;
    reference: string;
    processedBy: string;
    branchId?: string;
    branchName?: string;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      // Get or create required GL accounts
      const cashAccount = await this.getOrCreateGLAccount(
        "1001",
        "Cash",
        "Asset"
      );
      const customerLiabilityAccount = await this.getOrCreateGLAccount(
        "2001",
        "Customer Liability",
        "Liability"
      );
      const feeRevenueAccount = await this.getOrCreateGLAccount(
        "4003",
        "Transaction Fee Income",
        "Revenue"
      );

      if (!cashAccount || !customerLiabilityAccount || !feeRevenueAccount) {
        throw new Error("Failed to get or create required GL accounts");
      }

      const entries: GLEntry[] = [];

      // Main transaction entries
      if (params.type === "cash-in") {
        entries.push({
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          debit: params.amount,
          credit: 0,
          description: `MoMo Cash In - ${params.provider} - ${params.phoneNumber}`,
          metadata: {
            transactionId: params.transactionId,
            provider: params.provider,
          },
        });

        entries.push({
          accountId: customerLiabilityAccount.id,
          accountCode: customerLiabilityAccount.code,
          debit: 0,
          credit: params.amount,
          description: `MoMo Cash In - ${params.provider} - ${params.phoneNumber}`,
          metadata: {
            transactionId: params.transactionId,
            provider: params.provider,
          },
        });
      } else {
        entries.push({
          accountId: customerLiabilityAccount.id,
          accountCode: customerLiabilityAccount.code,
          debit: params.amount,
          credit: 0,
          description: `MoMo Cash Out - ${params.provider} - ${params.phoneNumber}`,
          metadata: {
            transactionId: params.transactionId,
            provider: params.provider,
          },
        });

        entries.push({
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          debit: 0,
          credit: params.amount,
          description: `MoMo Cash Out - ${params.provider} - ${params.phoneNumber}`,
          metadata: {
            transactionId: params.transactionId,
            provider: params.provider,
          },
        });
      }

      // Fee entries
      if (params.fee > 0) {
        entries.push({
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          debit: params.fee,
          credit: 0,
          description: `MoMo Transaction Fee - ${params.provider}`,
          metadata: {
            transactionId: params.transactionId,
            feeAmount: params.fee,
          },
        });

        entries.push({
          accountId: feeRevenueAccount.id,
          accountCode: feeRevenueAccount.code,
          debit: 0,
          credit: params.fee,
          description: `MoMo Transaction Fee Revenue - ${params.provider}`,
          metadata: {
            transactionId: params.transactionId,
            feeAmount: params.fee,
          },
        });
      }

      const glTransactionData: GLTransactionData = {
        date: new Date().toISOString().split("T")[0],
        sourceModule: "momo",
        sourceTransactionId: params.transactionId,
        sourceTransactionType: params.type,
        description: `MoMo ${params.type} - ${params.provider} - ${params.phoneNumber}`,
        entries,
        createdBy: params.processedBy,
        branchId: params.branchId,
        branchName: params.branchName,
        metadata: {
          provider: params.provider,
          phoneNumber: params.phoneNumber,
          customerName: params.customerName,
          reference: params.reference,
          amount: params.amount,
          fee: params.fee,
        },
      };

      return await this.createAndPostTransaction(glTransactionData, true);
    } catch (error) {
      console.error("❌ Error creating MoMo GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Creates GL reversal entries when a commission is deleted
   *
   * This method creates balanced GL entries that reverse the original commission posting:
   * - Debits Commission Revenue (reducing revenue)
   * - Credits Commission Receivable (reducing receivable)
   *
   * This ensures the books remain balanced when a commission is deleted.
   *
   * @param params - Parameters for creating the reversal entries
   * @returns Promise with success status and GL transaction ID
   */
  static async createCommissionReversalGLEntries(params: {
    commissionId: string;
    source: string;
    reference: string;
    amount: number;
    month: string;
    createdBy: string;
    reason: string;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      const receivableAccount = await this.getOrCreateGLAccount(
        "1200",
        "Commission Receivable",
        "Asset"
      );
      const revenueAccount = await this.getOrCreateGLAccount(
        "4100",
        "Commission Revenue",
        "Revenue"
      );
      const reversalAccount = await this.getOrCreateGLAccount(
        "4999",
        "Commission Reversals",
        "Revenue"
      );

      if (!receivableAccount || !revenueAccount || !reversalAccount) {
        throw new Error("Failed to get or create required GL accounts");
      }

      const entries: GLEntry[] = [
        {
          accountId: receivableAccount.id,
          accountCode: receivableAccount.code,
          debit: 0,
          credit: params.amount,
          description: `Commission receivable reversal - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            month: params.month,
            reversalReason: params.reason,
          },
        },
        {
          accountId: revenueAccount.id,
          accountCode: revenueAccount.code,
          debit: params.amount,
          credit: 0,
          description: `Commission revenue reversal - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            month: params.month,
            reversalReason: params.reason,
          },
        },
      ];

      const glTransactionData: GLTransactionData = {
        date: new Date().toISOString().split("T")[0],
        sourceModule: "commissions",
        sourceTransactionId: params.commissionId,
        sourceTransactionType: "commission_reversal",
        description: `Commission reversal - ${params.source} - ${params.reference} - ${params.reason}`,
        entries,
        createdBy: params.createdBy,
        metadata: {
          commissionId: params.commissionId,
          source: params.source,
          reference: params.reference,
          month: params.month,
          reversalReason: params.reason,
          originalTransactionType: "commission_revenue",
        },
      };

      return await this.createAndPostTransaction(glTransactionData, true);
    } catch (error) {
      console.error("Error creating commission reversal GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Creates GL reversal entries for a paid commission that is being deleted
   *
   * For paid commissions, we need to handle both the original revenue posting
   * and the payment posting. This method creates the appropriate reversal entries.
   *
   * @param params - Parameters for creating the reversal entries
   * @returns Promise with success status and GL transaction ID
   */
  static async createPaidCommissionReversalGLEntries(params: {
    commissionId: string;
    source: string;
    reference: string;
    amount: number;
    month: string;
    createdBy: string;
    reason: string;
    paymentMethod?: string;
  }): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      const cashAccount = await this.getOrCreateGLAccount(
        "1001",
        "Cash",
        "Asset"
      );
      const receivableAccount = await this.getOrCreateGLAccount(
        "1200",
        "Commission Receivable",
        "Asset"
      );
      const revenueAccount = await this.getOrCreateGLAccount(
        "4100",
        "Commission Revenue",
        "Revenue"
      );

      if (!cashAccount || !receivableAccount || !revenueAccount) {
        throw new Error("Failed to get or create required GL accounts");
      }

      // For paid commissions, we need to reverse both the original revenue posting
      // and the payment posting. Since the payment was already received, we don't
      // affect the cash account, but we do need to reverse the revenue recognition.
      const entries: GLEntry[] = [
        {
          accountId: revenueAccount.id,
          accountCode: revenueAccount.code,
          debit: params.amount,
          credit: 0,
          description: `Commission revenue reversal (paid) - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            month: params.month,
            reversalReason: params.reason,
            wasPaid: true,
            paymentMethod: params.paymentMethod,
          },
        },
        {
          accountId: receivableAccount.id,
          accountCode: receivableAccount.code,
          debit: 0,
          credit: params.amount,
          description: `Commission receivable reversal (paid) - ${params.source} - ${params.reference}`,
          metadata: {
            commissionId: params.commissionId,
            source: params.source,
            month: params.month,
            reversalReason: params.reason,
            wasPaid: true,
            paymentMethod: params.paymentMethod,
          },
        },
      ];

      const glTransactionData: GLTransactionData = {
        date: new Date().toISOString().split("T")[0],
        sourceModule: "commissions",
        sourceTransactionId: params.commissionId,
        sourceTransactionType: "commission_reversal_paid",
        description: `Paid commission reversal - ${params.source} - ${params.reference} - ${params.reason}`,
        entries,
        createdBy: params.createdBy,
        metadata: {
          commissionId: params.commissionId,
          source: params.source,
          reference: params.reference,
          month: params.month,
          reversalReason: params.reason,
          wasPaid: true,
          paymentMethod: params.paymentMethod,
          originalTransactionType: "commission_payment",
        },
      };

      return await this.createAndPostTransaction(glTransactionData, true);
    } catch (error) {
      console.error(
        "Error creating paid commission reversal GL entries:",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get or create GL account by code
   */
  private static async getOrCreateGLAccount(
    code: string,
    name: string,
    type: string
  ): Promise<any> {
    try {
      const existing = await sql`
        SELECT id, code, name, type
        FROM gl_accounts
        WHERE code = ${code} AND is_active = true
      `;

      if (existing.length > 0) {
        return existing[0];
      }

      const accountId = uuidv4();
      const newAccount = await sql`
        INSERT INTO gl_accounts (id, code, name, type, balance, is_active)
        VALUES (${accountId}, ${code}, ${name}, ${type}, 0, true)
        RETURNING id, code, name, type
      `;

      return newAccount[0];
    } catch (error) {
      console.error(`Failed to get or create GL account ${code}:`, error);
      return null;
    }
  }

  /**
   * Update account balances
   */
  private static async updateAccountBalances(
    entries: GLEntry[],
    date: string
  ): Promise<void> {
    for (const entry of entries) {
      const netAmount = entry.debit - entry.credit;
      await sql`
        UPDATE gl_accounts 
        SET balance = COALESCE(balance, 0) + ${netAmount},
            updated_at = NOW()
        WHERE id = ${entry.accountId}
      `;
    }
  }
}
