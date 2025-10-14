import { neon } from "@neondatabase/serverless";
import { UnifiedGLPostingService } from "./unified-gl-posting-service";
import { MissingGLMethods } from "./gl-missing-methods";
import { AuditLoggerService } from "./audit-logger-service";
import { NotificationService } from "@/lib/services/notification-service";
import { CustomerNotificationService } from "./customer-notification-service";
import { FloatAccountGLService } from "./float-account-gl-service";
import { logger, LogCategory } from "@/lib/logger";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to get user's full name
async function getUserFullName(userId: string): Promise<string> {
  try {
    if (!userId) {
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

export interface TransactionData {
  serviceType: "momo" | "agency_banking" | "e_zwich" | "power" | "jumia";
  transactionType: string;
  amount: number;
  fee: number;
  customerName: string;
  phoneNumber?: string;
  accountNumber?: string;
  provider: string;
  floatAccountId?: string; // Add this for specific float account selection
  reference?: string;
  notes?: string;
  branchId: string;
  userId: string;
  processedBy: string;
  metadata?: Record<string, any>;
}

export interface TransactionResult {
  success: boolean;
  transaction?: any;
  error?: string;
  message?: string;
  receipt?: string;
  data?: any;
}

export class UnifiedTransactionService {
  /**
   * Process a transaction following the exact flow specified in helpers
   */
  static async processTransaction(
    data: TransactionData
  ): Promise<TransactionResult> {
    try {
      console.log(
        `Processing ${data.serviceType} ${data.transactionType} transaction...`
      );

      // 1. Validate transaction data
      const validation = this.validateTransactionData(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // 2. Get fee configuration only if fee is not provided (undefined or null)
      // Don't recalculate if user explicitly sets fee to 0
      if (data.fee === undefined || data.fee === null) {
        const feeConfig = await this.getFeeConfiguration(
          data.serviceType,
          data.transactionType
        );
        if (feeConfig) {
          data.fee = this.calculateFee(data.amount, feeConfig);
        } else {
          data.fee = 0; // Default to 0 if no fee config found
        }
      }

      // 3. Process based on service type
      switch (data.serviceType) {
        case "momo":
          return await this.processMoMoTransaction(data);
        case "agency_banking":
          return await this.processAgencyBankingTransaction(data);
        case "e_zwich":
          return await this.processEZwichTransaction(data);
        case "power":
          return await this.processPowerTransaction(data);
        case "jumia":
          return await this.processJumiaTransaction(data);
        default:
          return { success: false, error: "Invalid service type" };
      }
    } catch (error) {
      console.error("Error processing transaction:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * MoMo Transaction Flow:
   * Cash-In: Customer gives cash → Cash in till increases and MoMo float decreases
   * Cash-Out: Customer withdraws cash → Cash in till decreases and MoMo float increases
   */
  private static async processMoMoTransaction(
    data: TransactionData
  ): Promise<TransactionResult> {
    try {
      // Get MoMo float account - use specific floatAccountId if provided, otherwise fallback to provider lookup
      let momoAccount;

      if (data.floatAccountId) {
        // Use the specific float account ID when provided
        momoAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE id = ${data.floatAccountId}
          AND branch_id = ${data.branchId}
          AND account_type = 'momo'
          AND is_active = true
          LIMIT 1
        `;
      } else {
        // Fallback to provider lookup for backward compatibility
        momoAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE branch_id = ${data.branchId}
          AND provider = ${data.provider}
          AND account_type = 'momo'
          AND is_active = true
          LIMIT 1
        `;
      }

      if (momoAccount.length === 0) {
        return {
          success: false,
          error: data.floatAccountId
            ? `No active MoMo float account found with ID: ${data.floatAccountId}`
            : `No active MoMo float account found for provider: ${data.provider}`,
        };
      }

      // Get cash in till account
      const cashTillAccount = await sql`
        SELECT * FROM float_accounts 
        WHERE branch_id = ${data.branchId}
        AND account_type = 'cash-in-till'
        AND is_active = true
        LIMIT 1
      `;

      if (cashTillAccount.length === 0) {
        return {
          success: false,
          error: "No active cash in till account found",
        };
      }

      const momoFloat = momoAccount[0];
      const cashTill = cashTillAccount[0];

      // Debug logging to confirm which account is being used
      console.log(`[MOMO TRANSACTION] Using float account:`, {
        id: momoFloat.id,
        provider: momoFloat.provider,
        accountNumber: momoFloat.account_number,
        currentBalance: momoFloat.current_balance,
        requestedAccountId: data.floatAccountId,
        requestedProvider: data.provider,
      });

      // Calculate transaction effects
      let momoFloatChange = 0;
      let cashTillChange = 0;

      if (
        data.transactionType === "cash-in" ||
        data.transactionType === "deposit"
      ) {
        // Cash-In/Deposit: Customer gives us cash + fee, we lose only the amount from MoMo float
        // We receive: amount + fee (goes to cash till)
        // We lose: amount (from MoMo float)
        momoFloatChange = -data.amount; // Only the amount, not the fee
        cashTillChange = data.amount + data.fee; // Amount + fee goes to cash till

        // Validate MoMo float balance (only need the amount, not the fee)
        if (momoFloat.current_balance < data.amount) {
          return { success: false, error: "Insufficient MoMo float balance" };
        }
      } else if (
        data.transactionType === "cash-out" ||
        data.transactionType === "withdrawal"
      ) {
        // Cash-Out/Withdrawal: Customer withdraws cash, we receive amount to MoMo float
        // Customer gives us: amount from their MoMo account
        // Customer receives: amount only in cash
        // We keep: fee as revenue in cash till
        momoFloatChange = data.amount; // We receive only the amount to our MoMo float
        cashTillChange = -data.amount + data.fee; // We pay the amount in cash but keep the fee in cash till

        // Validate cash in till balance (only need the amount, not the fee)
        if (cashTill.current_balance < data.amount) {
          return { success: false, error: "Insufficient cash in till balance" };
        }
      }

      // Create transaction record
      const transaction = await sql`
        INSERT INTO momo_transactions (
          branch_id, user_id, float_account_id, customer_name, phone_number,
          amount, fee, type, provider, reference, status, cash_till_affected, float_affected
        ) VALUES (
          ${data.branchId}, ${data.userId}, ${momoFloat.id}, ${
        data.customerName
      }, ${data.phoneNumber},
          ${data.amount}, ${data.fee}, ${data.transactionType}, ${
        data.provider
      }, 
          ${
            data.reference || `MOMO-${Date.now()}`
          }, 'completed', ${cashTillChange}, ${momoFloatChange}
        )
        RETURNING *
      `;

      // Update MoMo float balance
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${momoFloatChange}, updated_at = NOW()
        WHERE id = ${momoFloat.id}
      `;

      // Update cash in till balance
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${cashTillChange}, updated_at = NOW()
        WHERE id = ${cashTill.id}
      `;

      // Create GL entries with Cash-in-Till metadata
      await this.createGLEntries(
        {
          ...data,
          processedBy: data.userId,
          metadata: {
            ...data.metadata,
            cashTillAccountId: cashTill.id,
            cashTillAffected: cashTillChange,
            floatAccountId: momoFloat.id,
            floatAffected: momoFloatChange,
          },
        },
        transaction[0]
      );

      // Log audit
      await AuditLoggerService.log({
        userId: data.userId,
        username: await getUserFullName(data.processedBy || data.userId),
        actionType: `momo_${data.transactionType}`,
        entityType: "transaction",
        entityId: transaction[0].id,
        description: `MoMo ${data.transactionType} transaction processed`,
        branchId: data.branchId,
        branchName: "Branch",
        status: "success",
        severity: "low",
        details: {
          amount: data.amount,
          fee: data.fee,
          provider: data.provider,
        },
      });

      // Generate receipt automatically
      const receiptResult = await this.generateReceipt(
        transaction[0].id,
        "momo",
        "Branch"
      );

      // Notify customer (mandatory - not dependent on user preferences)
      if (data.phoneNumber) {
        const customerPhone = data.phoneNumber;
        const customerName = data.customerName || "Customer";

        console.log("[UNIFIED TRANSACTION AUDIT] Customer notification data:", {
          phoneNumber: data.phoneNumber,
          finalCustomerPhone: customerPhone,
          customerName: customerName,
          serviceType: data.serviceType,
          provider: data.provider,
          transactionId: transaction[0].id,
          reference: data.reference || transaction[0].id,
          userId: data.userId,
          processedBy: data.processedBy,
        });

        console.log("[UNIFIED TRANSACTION AUDIT] Transaction data source:", {
          hasPhoneNumber: !!data.phoneNumber,
          phoneNumberLength: data.phoneNumber?.length,
          phoneNumberStartsWith: data.phoneNumber?.substring(0, 4),
        });

        console.log("UNIFIED TRANSACTION AUDIT", customerPhone);

        await CustomerNotificationService.sendTransactionSuccessNotification(
          customerPhone,
          customerName,
          {
            amount: data.amount,
            service: data.serviceType || data.provider || "transaction",
            reference: data.reference || transaction[0].id,
            transactionId: transaction[0].id,
          }
        );
      } else {
        console.log(
          "⚠️ [UNIFIED TRANSACTION AUDIT] NO CUSTOMER PHONE PROVIDED:",
          {
            phoneNumber: data.phoneNumber,
            serviceType: data.serviceType,
            provider: data.provider,
            transactionId: transaction[0].id,
          }
        );
      }

      // Notify user (staff) - optional based on their notification preferences
      if (data.userId) {
        await NotificationService.sendTransactionAlert(data.userId, {
          type: data.transactionType,
          amount: data.amount,
          service: data.serviceType || data.provider || "transaction",
          reference: data.reference || "",
          branchId: data.branchId,
        });
      }

      return {
        success: true,
        transaction: transaction[0],
        message: `MoMo ${data.transactionType} transaction processed successfully`,
        receipt: receiptResult.receipt,
      };
    } catch (error) {
      console.error("Error processing MoMo transaction:", error);
      return { success: false, error: "Failed to process MoMo transaction" };
    }
  }

  /**
   * Agency Banking Transaction Flow:
   * Withdrawal: Customer withdraws from bank account → Agency float increases and cash in till decrease
   * Deposit: Customer deposits to bank account → Agency float decreases and cash in till increases
   * Interbank Transfer: Customer transfers to another bank → Agency float decrease, cash in till increase + additional transfer fee
   */
  private static async processAgencyBankingTransaction(
    data: TransactionData
  ): Promise<TransactionResult> {
    try {
      // Get agency banking float account
      const agencyAccount = await sql`
        SELECT * FROM float_accounts 
        WHERE branch_id = ${data.branchId}
        AND provider = ${data.provider}
        AND account_type = 'agency-banking'
        AND is_active = true
        LIMIT 1
      `;

      if (agencyAccount.length === 0) {
        return {
          success: false,
          error: `No active agency banking float account found for provider: ${data.provider}`,
        };
      }

      // Get cash in till account
      const cashTillAccount = await sql`
        SELECT * FROM float_accounts 
        WHERE branch_id = ${data.branchId}
        AND account_type = 'cash-in-till'
        AND is_active = true
        LIMIT 1
      `;

      if (cashTillAccount.length === 0) {
        return {
          success: false,
          error: "No active cash in till account found",
        };
      }

      const agencyFloat = agencyAccount[0];
      const cashTill = cashTillAccount[0];

      // Calculate transaction effects
      let agencyFloatChange = 0;
      let cashTillChange = 0;

      if (data.transactionType === "deposit") {
        // Deposit: Customer gives us cash + fee, we send amount to customer's bank account
        // Cash in till increases by amount + fee (we receive cash + fee)
        // Bank float decreases by amount only (we send only the amount to customer's account)
        agencyFloatChange = -data.amount; // Only the amount, not the fee
        cashTillChange = data.amount + data.fee; // Amount + fee goes to cash till

        // Validate agency float balance (only need the amount, not the fee)
        if (agencyFloat.current_balance < data.amount) {
          return {
            success: false,
            error: "Insufficient agency banking float balance",
          };
        }
      } else if (data.transactionType === "withdrawal") {
        // Withdrawal: Customer gives us amount from bank account, we give cash to customer
        // Cash in till decreases by amount only (we pay only the amount in cash)
        // Bank float increases by amount only (we receive only the amount from customer's account)
        // Fee is added to cash in till (we keep the fee as revenue)
        agencyFloatChange = data.amount; // Only the amount, not the fee
        cashTillChange = -data.amount + data.fee; // We pay amount in cash but keep fee

        // Validate cash in till balance (only need the amount, not the fee)
        if (cashTill.current_balance < data.amount) {
          return { success: false, error: "Insufficient cash in till balance" };
        }
      } else if (
        data.transactionType === "interbank_transfer" ||
        data.transactionType === "interbank"
      ) {
        // Interbank Transfer: Customer gives us cash + fee, we send amount to customer's other bank
        // Cash in till increases by amount + fee (we receive cash + fee)
        // Bank float decreases by amount only (we send only the amount to customer's other bank)
        agencyFloatChange = -data.amount; // Only the amount, not the fee
        cashTillChange = data.amount + data.fee; // Amount + fee goes to cash till

        // Validate agency float balance (only need the amount, not the fee)
        if (agencyFloat.current_balance < data.amount) {
          return {
            success: false,
            error: "Insufficient agency banking float balance",
          };
        }
      }

      // Create transaction record
      const transaction = await sql`
        INSERT INTO agency_banking_transactions (
          branch_id, user_id, type, amount, fee, customer_name, account_number,
          partner_bank, partner_bank_code, partner_bank_id, reference, status, cash_till_affected, float_affected, is_reversal
        ) VALUES (
          ${data.branchId}, ${data.userId}, ${data.transactionType}, ${
        data.amount
      }, ${data.fee},
          ${data.customerName}, ${data.accountNumber}, ${data.provider}, 
          ${data.provider}, ${data.provider}, 
          ${
            data.reference || `AGENCY-${Date.now()}`
          }, 'completed', ${cashTillChange}, ${agencyFloatChange}, false
        )
        RETURNING *
      `;

      // Update agency float balance
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${agencyFloatChange}, updated_at = NOW()
        WHERE id = ${agencyFloat.id}
      `;

      // Update cash in till balance
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${cashTillChange}, updated_at = NOW()
        WHERE id = ${cashTill.id}
      `;

      // Create GL entries with Cash-in-Till metadata
      await this.createGLEntries(
        {
          ...data,
          processedBy: data.userId,
          metadata: {
            ...data.metadata,
            cashTillAccountId: cashTill.id,
            cashTillAffected: cashTillChange,
            floatAccountId: agencyFloat.id,
            floatAffected: agencyFloatChange,
          },
        },
        transaction[0]
      );

      // Log audit
      const userName = await getUserFullName(data.userId);
      await AuditLoggerService.log({
        userId: data.userId,
        username: userName,
        actionType: `agency_banking_${data.transactionType}`,
        entityType: "transaction",
        entityId: transaction[0].id,
        description: `Agency banking ${data.transactionType} transaction processed`,
        branchId: data.branchId,
        branchName: "Branch",
        status: "success",
        severity: "low",
        details: {
          amount: data.amount,
          fee: data.fee,
          provider: data.provider,
        },
      });

      // Notify customer (mandatory - not dependent on user preferences)
      if (data.phoneNumber) {
        const customerPhone = data.phoneNumber;
        const customerName = data.customerName || "Customer";

        console.log("[UNIFIED TRANSACTION AUDIT] Customer notification data:", {
          phoneNumber: data.phoneNumber,
          finalCustomerPhone: customerPhone,
          customerName: customerName,
          serviceType: data.serviceType,
          provider: data.provider,
          transactionId: transaction[0].id,
          reference: data.reference || transaction[0].id,
          userId: data.userId,
          processedBy: data.processedBy,
        });

        console.log("[UNIFIED TRANSACTION AUDIT] Transaction data source:", {
          hasPhoneNumber: !!data.phoneNumber,
          phoneNumberLength: data.phoneNumber?.length,
          phoneNumberStartsWith: data.phoneNumber?.substring(0, 4),
        });

        await CustomerNotificationService.sendTransactionSuccessNotification(
          customerPhone,
          customerName,
          {
            amount: data.amount,
            service: data.serviceType || data.provider || "transaction",
            reference: data.reference || transaction[0].id,
            transactionId: transaction[0].id,
          }
        );
      } else {
        console.log(
          "⚠️ [UNIFIED TRANSACTION AUDIT] NO CUSTOMER PHONE PROVIDED:",
          {
            phoneNumber: data.phoneNumber,
            serviceType: data.serviceType,
            provider: data.provider,
            transactionId: transaction[0].id,
          }
        );
      }
      // Notify user (staff)
      if (data.userId) {
        await NotificationService.sendTransactionAlert(data.userId, {
          type: data.transactionType,
          amount: data.amount,
          service: data.serviceType || data.provider || "transaction",
          reference: data.reference || "",
          branchId: data.branchId,
        });
      }

      return {
        success: true,
        transaction: transaction[0],
        message: `Agency banking ${data.transactionType} transaction processed successfully`,
      };
    } catch (error) {
      console.error("Error processing agency banking transaction:", error);
      return {
        success: false,
        error: "Failed to process agency banking transaction",
      };
    }
  }

  /**
   * E-Zwich Transaction Flow:
   * Card Issuance: Customer pays for card → Cash increases, card stock decreases
   * Withdrawal: Customer withdraws cash → E-Zwich settlement increases and cash in till decrease
   */
  private static async processEZwichTransaction(
    data: TransactionData
  ): Promise<TransactionResult> {
    try {
      if (data.transactionType === "card_issuance") {
        // Card Issuance: Cash increases, card stock decreases
        const cashTillAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE branch_id = ${data.branchId}
          AND account_type = 'cash-in-till'
          AND is_active = true
          LIMIT 1
        `;

        if (cashTillAccount.length === 0) {
          return {
            success: false,
            error: "No active cash in till account found",
          };
        }

        const cashTill = cashTillAccount[0];

        // Create transaction record
        const transaction = await sql`
          INSERT INTO ezwich_card_issuance (
            id, branch_id, issued_by, customer_name, customer_phone, card_number,
            fee_charged, payment_method, partner_bank, reference, status, created_at
          ) VALUES (
            ${data.id}, ${data.branchId}, ${data.userId}, ${data.customerName},
            ${data.phoneNumber || null}, ${data.accountNumber}, ${data.fee}, ${
          data.provider
        },
            ${data.provider}, ${
          data.reference || `EZWICH-CARD-${Date.now()}`
        }, 'completed', NOW()
          )
          RETURNING *
        `;

        // Update cash in till balance (cash increases)
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance + ${
            data.amount + data.fee
          }, updated_at = NOW()
          WHERE id = ${cashTill.id}
        `;

        // Create GL entries with Cash-in-Till metadata
        const cashTillChange = data.amount + data.fee;
        await this.createGLEntries(
          {
            ...data,
            processedBy: data.userId,
            metadata: {
              ...data.metadata,
              cashTillAccountId: cashTill.id,
              cashTillAffected: cashTillChange,
            },
          },
          transaction[0]
        );

        // Notify customer (mandatory - not dependent on user preferences)
        if (data.phoneNumber) {
          const customerPhone = data.phoneNumber;
          const customerName = data.customerName || "Customer";

          console.log(
            "[UNIFIED TRANSACTION AUDIT] Customer notification data:",
            {
              phoneNumber: data.phoneNumber,
              finalCustomerPhone: customerPhone,
              customerName: customerName,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
              reference: data.reference || transaction[0].id,
              userId: data.userId,
              processedBy: data.processedBy,
            }
          );

          console.log("[UNIFIED TRANSACTION AUDIT] Transaction data source:", {
            hasPhoneNumber: !!data.phoneNumber,
            phoneNumberLength: data.phoneNumber?.length,
            phoneNumberStartsWith: data.phoneNumber?.substring(0, 4),
          });

          await CustomerNotificationService.sendTransactionSuccessNotification(
            customerPhone,
            customerName,
            {
              amount: data.amount,
              service: data.serviceType || data.provider || "transaction",
              reference: data.reference || transaction[0].id,
              transactionId: transaction[0].id,
            }
          );
        } else {
          console.log(
            "⚠️ [UNIFIED TRANSACTION AUDIT] NO CUSTOMER PHONE PROVIDED:",
            {
              phoneNumber: data.phoneNumber,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
            }
          );
        }
        // Notify user (staff)
        if (data.userId) {
          await NotificationService.sendTransactionAlert(data.userId, {
            type: data.transactionType,
            amount: data.amount,
            service: data.serviceType || data.provider || "transaction",
            reference: data.reference || "",
            branchId: data.branchId,
          });
        }

        return {
          success: true,
          transaction: transaction[0],
          message: "E-Zwich card issuance processed successfully",
        };
      } else if (data.transactionType === "withdrawal") {
        // Withdrawal: E-Zwich settlement increases by amount + fee, cash in till decreases by amount only
        const ezwichSettlementAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE branch_id = ${data.branchId}
          AND account_type = 'e-zwich'
          AND is_active = true
          LIMIT 1
        `;

        if (ezwichSettlementAccount.length === 0) {
          return {
            success: false,
            error: "No active E-Zwich settlement account found",
          };
        }

        const cashTillAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE branch_id = ${data.branchId}
          AND account_type = 'cash-in-till'
          AND is_active = true
          LIMIT 1
        `;

        if (cashTillAccount.length === 0) {
          return {
            success: false,
            error: "No active cash in till account found",
          };
        }

        const ezwichSettlement = ezwichSettlementAccount[0];
        const cashTill = cashTillAccount[0];

        // Validate cash in till balance (only for withdrawal amount, not fee)
        if (cashTill.current_balance < data.amount) {
          return { success: false, error: "Insufficient cash in till balance" };
        }

        // Create transaction record
        const transaction = await sql`
          INSERT INTO e_zwich_withdrawals (
            branch_id, user_id, card_number, customer_name, amount, fee,
            partner_bank, reference, status
          ) VALUES (
            ${data.branchId}, ${data.userId}, ${data.phoneNumber}, ${
          data.customerName
        },
            ${data.amount}, ${data.fee}, ${data.provider}, 
            ${data.reference || `EZWICH-WD-${Date.now()}`}, 'pending'
          )
          RETURNING *
        `;

        // Update E-Zwich settlement balance (increases by amount + fee)
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance + ${
            data.amount + data.fee
          }, updated_at = NOW()
          WHERE id = ${ezwichSettlement.id}
        `;

        // Update cash in till balance (decreases by amount only, fee stays as revenue)
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance - ${data.amount}, updated_at = NOW()
          WHERE id = ${cashTill.id}
        `;

        // Create GL entries with Cash-in-Till metadata
        const cashTillChange = -data.amount;
        await this.createGLEntries(
          {
            ...data,
            processedBy: data.userId,
            metadata: {
              ...data.metadata,
              cashTillAccountId: cashTill.id,
              cashTillAffected: cashTillChange,
              floatAccountId: ezwichSettlement.id,
              floatAffected: data.amount + data.fee,
            },
          },
          transaction[0]
        );

        // Notify customer (mandatory - not dependent on user preferences)
        if (data.phoneNumber) {
          const customerPhone = data.phoneNumber;
          const customerName = data.customerName || "Customer";

          console.log(
            "[UNIFIED TRANSACTION AUDIT] Customer notification data:",
            {
              phoneNumber: data.phoneNumber,
              finalCustomerPhone: customerPhone,
              customerName: customerName,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
              reference: data.reference || transaction[0].id,
              userId: data.userId,
              processedBy: data.processedBy,
            }
          );

          console.log("[UNIFIED TRANSACTION AUDIT] Transaction data source:", {
            hasPhoneNumber: !!data.phoneNumber,
            phoneNumberLength: data.phoneNumber?.length,
            phoneNumberStartsWith: data.phoneNumber?.substring(0, 4),
          });

          await CustomerNotificationService.sendTransactionSuccessNotification(
            customerPhone,
            customerName,
            {
              amount: data.amount,
              service: data.serviceType || data.provider || "transaction",
              reference: data.reference || transaction[0].id,
              transactionId: transaction[0].id,
            }
          );
        } else {
          console.log(
            "⚠️ [UNIFIED TRANSACTION AUDIT] NO CUSTOMER PHONE PROVIDED:",
            {
              phoneNumber: data.phoneNumber,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
            }
          );
        }
        // Notify user (staff)
        if (data.userId) {
          await NotificationService.sendTransactionAlert(data.userId, {
            type: data.transactionType,
            amount: data.amount,
            service: data.serviceType || data.provider || "transaction",
            reference: data.reference || "",
            branchId: data.branchId,
          });
        }

        return {
          success: true,
          transaction: transaction[0],
          message: "E-Zwich withdrawal processed successfully",
        };
      }

      return { success: false, error: "Invalid E-Zwich transaction type" };
    } catch (error) {
      console.error("Error processing E-Zwich transaction:", error);
      return { success: false, error: "Failed to process E-Zwich transaction" };
    }
  }

  /**
   * Power Transaction Flow:
   * Customer purchase power, power float decrease and cash in till increase
   */
  private static async processPowerTransaction(
    data: TransactionData
  ): Promise<TransactionResult> {
    try {
      // Get power float account
      const powerAccount = await sql`
        SELECT * FROM float_accounts 
        WHERE branch_id = ${data.branchId}
        AND provider = ${data.provider}
        AND account_type = 'power'
        AND is_active = true
        LIMIT 1
      `;

      if (powerAccount.length === 0) {
        return {
          success: false,
          error: `No active power float account found for provider: ${data.provider}`,
        };
      }

      // Get cash in till account
      const cashTillAccount = await sql`
        SELECT * FROM float_accounts 
        WHERE branch_id = ${data.branchId}
        AND account_type = 'cash-in-till'
        AND is_active = true
        LIMIT 1
      `;

      if (cashTillAccount.length === 0) {
        return {
          success: false,
          error: "No active cash in till account found",
        };
      }

      const powerFloat = powerAccount[0];
      const cashTill = cashTillAccount[0];

      // Validate power float balance
      if (powerFloat.current_balance < data.amount + data.fee) {
        return { success: false, error: "Insufficient power float balance" };
      }

      // Calculate transaction effects
      const powerFloatChange = -(data.amount + data.fee); // Power float decreases
      const cashTillChange = data.amount + data.fee;

      // Extract meter number from metadata
      const meterNumber =
        data.metadata?.meter_number || data.notes?.replace("Meter: ", "") || "";

      // Create transaction record
      const transaction = await sql`
        INSERT INTO power_transactions (
          branch_id, user_id, type, amount, commission, customer_name, customer_phone,
          provider, reference, status, meter_number
        ) VALUES (
          ${data.branchId}, ${data.userId}, 'sale', ${data.amount}, ${data.fee},
          ${data.customerName}, ${data.phoneNumber}, ${data.provider}, 
          ${data.reference || `POWER-${Date.now()}`}, 'pending', ${meterNumber}
        )
        RETURNING *
      `;

      // Update power float balance (decreases)
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${powerFloatChange}, updated_at = NOW()
        WHERE id = ${powerFloat.id}
      `;

      // Update cash in till balance (increases)
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${cashTillChange}, updated_at = NOW()
        WHERE id = ${cashTill.id}
      `;

      // Create GL entries with Cash-in-Till metadata
      await this.createGLEntries(
        {
          ...data,
          processedBy: data.userId,
          metadata: {
            ...data.metadata,
            cashTillAccountId: cashTill.id,
            cashTillAffected: cashTillChange,
            floatAccountId: powerFloat.id,
            floatAffected: powerFloatChange,
          },
        },
        transaction[0]
      );

      // Log audit
      const userName = await getUserFullName(data.userId);
      await AuditLoggerService.log({
        userId: data.userId,
        username: userName,
        actionType: "power_sale",
        entityType: "transaction",
        entityId: transaction[0].id,
        description: "Power sale transaction processed",
        branchId: data.branchId,
        branchName: "Branch",
        status: "success",
        severity: "low",
        details: {
          amount: data.amount,
          fee: data.fee,
          provider: data.provider,
          meterNumber,
        },
      });

      // Notify customer (mandatory - not dependent on user preferences)
      if (data.phoneNumber) {
        const customerPhone = data.phoneNumber;
        const customerName = data.customerName || "Customer";

        console.log("[UNIFIED TRANSACTION AUDIT] Customer notification data:", {
          phoneNumber: data.phoneNumber,
          finalCustomerPhone: customerPhone,
          customerName: customerName,
          serviceType: data.serviceType,
          provider: data.provider,
          transactionId: transaction[0].id,
          reference: data.reference || transaction[0].id,
          userId: data.userId,
          processedBy: data.processedBy,
        });

        console.log("[UNIFIED TRANSACTION AUDIT] Transaction data source:", {
          hasPhoneNumber: !!data.phoneNumber,
          phoneNumberLength: data.phoneNumber?.length,
          phoneNumberStartsWith: data.phoneNumber?.substring(0, 4),
        });

        await CustomerNotificationService.sendTransactionSuccessNotification(
          customerPhone,
          customerName,
          {
            amount: data.amount,
            service: data.serviceType || data.provider || "transaction",
            reference: data.reference || transaction[0].id,
            transactionId: transaction[0].id,
          }
        );
      } else {
        console.log(
          "⚠️ [UNIFIED TRANSACTION AUDIT] NO CUSTOMER PHONE PROVIDED:",
          {
            phoneNumber: data.phoneNumber,
            serviceType: data.serviceType,
            provider: data.provider,
            transactionId: transaction[0].id,
          }
        );
      }
      // Notify user (staff)
      if (data.userId) {
        await NotificationService.sendTransactionAlert(data.userId, {
          type: data.transactionType,
          amount: data.amount,
          service: data.serviceType || data.provider || "transaction",
          reference: data.reference || "",
          branchId: data.branchId,
        });
      }

      return {
        success: true,
        transaction: transaction[0],
        message: "Power sale transaction processed successfully",
      };
    } catch (error) {
      console.error("Error processing power transaction:", error);
      return { success: false, error: "Failed to process power transaction" };
    }
  }

  /**
   * Jumia Transaction Flow:
   * Package receival just records the data no effect on transactions or gl.
   * Jumia POD receive payment on behalf of Jumia before delivering packages and should be able to settle jumia using the settlement form.
   */
  private static async processJumiaTransaction(
    data: TransactionData
  ): Promise<TransactionResult> {
    try {
      if (data.transactionType === "package_receival") {
        // Package receival: Just record data, no float effects
        const transaction = await sql`
          INSERT INTO jumia_transactions (
            branch_id, user_id, transaction_type, customer_name, customer_phone,
            amount, tracking_id, status
          ) VALUES (
            ${data.branchId}, ${data.userId}, ${data.transactionType}, ${
          data.customerName
        },
            ${data.phoneNumber}, ${data.amount}, ${
          data.reference || `JUMIA-${Date.now()}`
        }, 'active'
          )
          RETURNING *
        `;

        // Notify customer (mandatory - not dependent on user preferences)
        if (data.phoneNumber) {
          const customerPhone = data.phoneNumber;
          const customerName = data.customerName || "Customer";

          console.log(
            "[UNIFIED TRANSACTION AUDIT] Customer notification data:",
            {
              phoneNumber: data.phoneNumber,
              finalCustomerPhone: customerPhone,
              customerName: customerName,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
              reference: data.reference || transaction[0].id,
              userId: data.userId,
              processedBy: data.processedBy,
            }
          );

          console.log("[UNIFIED TRANSACTION AUDIT] Transaction data source:", {
            hasPhoneNumber: !!data.phoneNumber,
            phoneNumberLength: data.phoneNumber?.length,
            phoneNumberStartsWith: data.phoneNumber?.substring(0, 4),
          });

          await CustomerNotificationService.sendTransactionSuccessNotification(
            customerPhone,
            customerName,
            {
              amount: data.amount,
              service: data.serviceType || data.provider || "transaction",
              reference: data.reference || transaction[0].id,
              transactionId: transaction[0].id,
            }
          );
        } else {
          console.log(
            "⚠️ [UNIFIED TRANSACTION AUDIT] NO CUSTOMER PHONE PROVIDED:",
            {
              phoneNumber: data.phoneNumber,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
            }
          );
        }
        // Notify user (staff)
        if (data.userId) {
          await NotificationService.sendTransactionAlert(data.userId, {
            type: data.transactionType,
            amount: data.amount,
            service: data.serviceType || data.provider || "transaction",
            reference: data.reference || "",
            branchId: data.branchId,
          });
        }

        return {
          success: true,
          transaction: transaction[0],
          message: "Jumia package receival recorded successfully",
        };
      } else if (data.transactionType === "pod_payment") {
        // POD payment: Jumia float increases, cash in till decreases
        const jumiaAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE branch_id = ${data.branchId}
          AND account_type = 'jumia'
          AND is_active = true
          LIMIT 1
        `;

        if (jumiaAccount.length === 0) {
          return {
            success: false,
            error: "No active Jumia float account found",
          };
        }

        const cashTillAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE branch_id = ${data.branchId}
          AND account_type = 'cash-in-till'
          AND is_active = true
          LIMIT 1
        `;

        if (cashTillAccount.length === 0) {
          return {
            success: false,
            error: "No active cash in till account found",
          };
        }

        const jumiaFloat = jumiaAccount[0];
        const cashTill = cashTillAccount[0];

        // Validate cash in till balance
        if (cashTill.current_balance < data.amount + data.fee) {
          return { success: false, error: "Insufficient cash in till balance" };
        }

        // Calculate transaction effects
        const jumiaFloatChange = data.amount + data.fee; // Jumia float increases
        const cashTillChange = -(data.amount + data.fee); // Cash in till decreases

        // Create transaction record
        const transaction = await sql`
          INSERT INTO jumia_transactions (
            branch_id, user_id, transaction_type, customer_name, customer_phone,
            amount, fee, settlement_reference, status
          ) VALUES (
            ${data.branchId}, ${data.userId}, ${data.transactionType}, ${
          data.customerName
        },
            ${data.phoneNumber}, ${data.amount}, ${data.fee}, 
            ${data.reference || `JUMIA-POD-${Date.now()}`}, 'completed'
          )
          RETURNING *
        `;

        // Update Jumia float balance (increases)
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance + ${jumiaFloatChange}, updated_at = NOW()
          WHERE id = ${jumiaFloat.id}
        `;

        // Update cash in till balance (decreases)
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance + ${cashTillChange}, updated_at = NOW()
          WHERE id = ${cashTill.id}
        `;

        // Create GL entries with Cash-in-Till metadata
        await this.createGLEntries(
          {
            ...data,
            processedBy: data.userId,
            metadata: {
              ...data.metadata,
              cashTillAccountId: cashTill.id,
              cashTillAffected: cashTillChange,
              floatAccountId: jumiaFloat.id,
              floatAffected: jumiaFloatChange,
            },
          },
          transaction[0]
        );

        // Notify customer (mandatory - not dependent on user preferences)
        if (data.phoneNumber) {
          const customerPhone = data.phoneNumber;
          const customerName = data.customerName || "Customer";

          console.log(
            "[UNIFIED TRANSACTION AUDIT] Customer notification data:",
            {
              phoneNumber: data.phoneNumber,
              finalCustomerPhone: customerPhone,
              customerName: customerName,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
              reference: data.reference || transaction[0].id,
              userId: data.userId,
              processedBy: data.processedBy,
            }
          );

          console.log("[UNIFIED TRANSACTION AUDIT] Transaction data source:", {
            hasPhoneNumber: !!data.phoneNumber,
            phoneNumberLength: data.phoneNumber?.length,
            phoneNumberStartsWith: data.phoneNumber?.substring(0, 4),
          });

          await CustomerNotificationService.sendTransactionSuccessNotification(
            customerPhone,
            customerName,
            {
              amount: data.amount,
              service: data.serviceType || data.provider || "transaction",
              reference: data.reference || transaction[0].id,
              transactionId: transaction[0].id,
            }
          );
        } else {
          console.log(
            "⚠️ [UNIFIED TRANSACTION AUDIT] NO CUSTOMER PHONE PROVIDED:",
            {
              phoneNumber: data.phoneNumber,
              serviceType: data.serviceType,
              provider: data.provider,
              transactionId: transaction[0].id,
            }
          );
        }
        // Notify user (staff)
        if (data.userId) {
          await NotificationService.sendTransactionAlert(data.userId, {
            type: data.transactionType,
            amount: data.amount,
            service: data.serviceType || data.provider || "transaction",
            reference: data.reference || "",
            branchId: data.branchId,
          });
        }

        return {
          success: true,
          transaction: transaction[0],
          message: "Jumia POD payment processed successfully",
        };
      }

      return { success: false, error: "Invalid Jumia transaction type" };
    } catch (error) {
      console.error("Error processing Jumia transaction:", error);
      return { success: false, error: "Failed to process Jumia transaction" };
    }
  }

  /**
   * Get fee configuration from fee_config table
   */
  private static async getFeeConfiguration(
    serviceType: string,
    transactionType: string
  ) {
    try {
      const feeConfig = await sql`
        SELECT * FROM fee_config 
        WHERE service_type = ${serviceType}
        AND transaction_type = ${transactionType}
        AND is_active = true
        LIMIT 1
      `;

      return feeConfig[0] || null;
    } catch (error) {
      console.error("Error fetching fee configuration:", error);
      return null;
    }
  }

  /**
   * Calculate fee based on fee configuration
   */
  private static calculateFee(amount: number, feeConfig: any): number {
    if (!feeConfig) return 0;

    let fee = 0;

    if (feeConfig.fee_type === "percentage") {
      fee = (amount * feeConfig.fee_value) / 100;
    } else {
      fee = feeConfig.fee_value;
    }

    // Apply minimum and maximum limits
    if (feeConfig.minimum_fee > 0 && fee < feeConfig.minimum_fee) {
      fee = feeConfig.minimum_fee;
    }
    if (feeConfig.maximum_fee > 0 && fee > feeConfig.maximum_fee) {
      fee = feeConfig.maximum_fee;
    }

    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Validate transaction data
   */
  private static validateTransactionData(data: TransactionData): {
    valid: boolean;
    error?: string;
  } {
    if (!data.amount || data.amount <= 0) {
      return { valid: false, error: "Amount must be greater than 0" };
    }

    if (!data.customerName) {
      return { valid: false, error: "Customer name is required" };
    }

    // Validate phone number for MoMo transactions
    if (data.serviceType === "momo" && data.phoneNumber) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(data.phoneNumber)) {
        return {
          valid: false,
          error: "Phone number must be exactly 10 digits (e.g., 0241234567)",
        };
      }
    }

    if (!data.branchId) {
      return { valid: false, error: "Branch ID is required" };
    }

    if (!data.userId) {
      return { valid: false, error: "User ID is required" };
    }

    return { valid: true };
  }

  /**
   * Create GL entries for transaction
   */
  private static async createGLEntries(
    data: TransactionData,
    transaction: any
  ) {
    try {
      await UnifiedGLPostingService.createGLEntries({
        transactionId: transaction.id,
        sourceModule: data.serviceType,
        transactionType: data.transactionType,
        amount: data.amount,
        fee: data.fee,
        provider: data.provider,
        customerName: data.customerName,
        reference: transaction.reference || data.reference,
        processedBy: data.processedBy,
        branchId: data.branchId,
        branchName: "Branch",
        metadata: {
          ...data.metadata,
          provider: data.provider, // Pass provider in metadata for GL account naming
          actualProvider: data.provider, // Also pass as actualProvider for consistency
        },
      });
    } catch (error) {
      console.error("Error creating GL entries:", error);
      // Don't fail the transaction if GL posting fails
    }
  }

  /**
   * Reverse a transaction - creates reversal GL entries and updates float balances
   */
  static async reverseTransaction(
    transactionId: string,
    sourceModule: string,
    reason: string,
    userId: string,
    branchId: string,
    processedBy: string
  ): Promise<TransactionResult> {
    try {
      console.log(`Reversing ${sourceModule} transaction: ${transactionId}`);

      // Get the original transaction
      const transaction = await this.getTransactionById(
        transactionId,
        sourceModule
      );
      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Check if transaction is already reversed
      if (
        transaction.status === "reversed" ||
        transaction.is_reversal === true
      ) {
        return {
          success: false,
          error: "Transaction has already been reversed",
        };
      }

      // Create reversal transaction record
      const reversalTransaction = await this.createReversalTransaction(
        transaction,
        reason,
        userId,
        branchId,
        sourceModule
      );

      // Update float balances (reverse the original transaction)
      await this.reverseFloatBalances(transaction, sourceModule, transactionId);

      // Create reversal GL entries
      let reversalType = transaction.transactionType || transaction.type;
      if (!reversalType && sourceModule === "e_zwich") {
        reversalType = "withdrawal";
      }
      await UnifiedGLPostingService.createReversalGLEntries({
        transactionId: reversalTransaction.id,
        sourceModule: sourceModule,
        transactionType: `reversal_${reversalType}`,
        amount: transaction.amount,
        fee: transaction.fee || 0,
        customerName: transaction.customer_name,
        reference: `REV-${transaction.reference || transactionId}`,
        processedBy: userId,
        branchId: branchId,
        branchName: "Branch",
        metadata: {
          originalTransactionId: transactionId,
          reason: reason,
          originalAmount: transaction.amount,
          originalFee: transaction.fee || 0,
          provider: transaction.provider, // Pass provider for correct GL account naming
          actualProvider: transaction.provider, // Also pass as actualProvider for consistency
        },
      });

      // Update original transaction status
      await this.updateTransactionStatus(
        transactionId,
        sourceModule,
        "reversed"
      );

      // Log audit
      await AuditLoggerService.log({
        userId: userId,
        username: await getUserFullName(processedBy),
        actionType: "transaction_reversal",
        entityType: sourceModule,
        entityId: transactionId,
        description: `${sourceModule} transaction reversed: ${reason}`,
        branchId: branchId,
        branchName: "Branch",
        status: "success",
        severity: "medium",
        details: {
          originalTransactionId: transactionId,
          reversalTransactionId: reversalTransaction.id,
          reason: reason,
          amount: transaction.amount,
          fee: transaction.fee || 0,
        },
      });

      return {
        success: true,
        transaction: reversalTransaction,
        message: `${sourceModule} transaction reversed successfully`,
      };
    } catch (error) {
      console.error("Error reversing transaction:", error);

      // Log audit failure
      await AuditLoggerService.log({
        userId: userId,
        username: await getUserFullName(processedBy),
        actionType: "transaction_reversal",
        entityType: sourceModule,
        entityId: transactionId,
        description: `Failed to reverse ${sourceModule} transaction`,
        branchId: branchId,
        branchName: "Branch",
        status: "failure",
        severity: "high",
        details: {
          originalTransactionId: transactionId,
          reason: reason,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reverse transaction",
      };
    }
  }

  /**
   * Edit a transaction - creates new GL entries and adjusts float balances
   */
  static async editTransaction(
    transactionId: string,
    sourceModule: string,
    updatedData: Partial<TransactionData>,
    userId: string,
    branchId: string,
    processedBy: string
  ): Promise<TransactionResult> {
    try {
      console.log(`✏️ Editing ${sourceModule} transaction: ${transactionId}`);

      // Get the original transaction
      const originalTransaction = await this.getTransactionById(
        transactionId,
        sourceModule
      );
      if (!originalTransaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Calculate the difference in amounts
      const amountDifference =
        (updatedData.amount || originalTransaction.amount) -
        originalTransaction.amount;
      const feeDifference =
        (updatedData.fee || originalTransaction.fee || 0) -
        (originalTransaction.fee || 0);
      const totalDifference = amountDifference + feeDifference;

      // Update the transaction record
      const updatedTransaction = await this.updateTransactionRecord(
        transactionId,
        sourceModule,
        updatedData
      );

      // Adjust float balances based on the difference
      await this.adjustFloatBalances(
        originalTransaction,
        totalDifference,
        sourceModule,
        updatedData.transactionType ||
          originalTransaction.transactionType ||
          originalTransaction.type
      );

      // Create adjustment GL entries
      await MissingGLMethods.createAdjustmentGLEntries({
        transactionId: transactionId,
        sourceModule: sourceModule,
        transactionType: `adjustment_${
          updatedData.transactionType ||
          originalTransaction.transactionType ||
          originalTransaction.type
        }`,
        amount: Math.abs(amountDifference),
        fee: Math.abs(feeDifference),
        customerName:
          updatedData.customerName || originalTransaction.customer_name,
        reference: `ADJ-${originalTransaction.reference || transactionId}`,
        processedBy: userId,
        branchId: branchId,
        branchName: "Branch",
        metadata: {
          originalAmount: originalTransaction.amount,
          originalFee: originalTransaction.fee || 0,
          newAmount: updatedData.amount || originalTransaction.amount,
          newFee: updatedData.fee || originalTransaction.fee || 0,
          amountDifference: amountDifference,
          feeDifference: feeDifference,
        },
      });

      // Log audit
      await AuditLoggerService.log({
        userId: userId,
        username: await getUserFullName(processedBy),
        actionType: "transaction_edit",
        entityType: sourceModule,
        entityId: transactionId,
        description: `${sourceModule} transaction edited`,
        branchId: branchId,
        branchName: "Branch",
        status: "success",
        severity: "medium",
        details: {
          originalAmount: originalTransaction.amount,
          originalFee: originalTransaction.fee || 0,
          newAmount: updatedData.amount || originalTransaction.amount,
          newFee: updatedData.fee || originalTransaction.fee || 0,
          amountDifference: amountDifference,
          feeDifference: feeDifference,
        },
      });

      return {
        success: true,
        transaction: updatedTransaction,
        message: `${sourceModule} transaction updated successfully`,
      };
    } catch (error) {
      console.error("Error editing transaction:", error);

      // Log audit failure
      await AuditLoggerService.log({
        userId: userId,
        username: await getUserFullName(processedBy),
        actionType: "transaction_edit",
        entityType: sourceModule,
        entityId: transactionId,
        description: `Failed to edit ${sourceModule} transaction`,
        branchId: branchId,
        branchName: "Branch",
        status: "failure",
        severity: "high",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to edit transaction",
      };
    }
  }

  /**
   * Delete a transaction - creates reversal GL entries and updates float balances
   */
  static async deleteTransaction(
    transactionId: string,
    sourceModule: string,
    reason: string,
    userId: string,
    branchId: string,
    processedBy: string
  ): Promise<TransactionResult> {
    try {
      console.log(`🗑️ Deleting ${sourceModule} transaction: ${transactionId}`);

      // Get the original transaction
      const transaction = await this.getTransactionById(
        transactionId,
        sourceModule
      );
      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Determine transaction type for E-Zwich (since it's not stored in the record)
      let transactionType = transaction.transactionType || transaction.type;
      if (sourceModule === "e_zwich") {
        // Check which table the transaction came from to determine type
        const withdrawalCheck = await sql`
          SELECT id FROM e_zwich_withdrawals WHERE id = ${transactionId}
        `;
        if (withdrawalCheck.length > 0) {
          transactionType = "withdrawal";
        } else {
          transactionType = "card_issuance";
        }
      }

      // Create deletion GL entries (same as reversal)
      await UnifiedGLPostingService.createReversalGLEntries({
        transactionId: transactionId,
        sourceModule: sourceModule,
        transactionType: transactionType,
        amount: transaction.amount,
        fee: transaction.fee || 0,
        customerName: transaction.customer_name,
        reference: `DEL-${transaction.reference || transactionId}`,
        processedBy: userId,
        branchId: branchId,
        branchName: "Branch",
        reason: reason,
        metadata: {
          originalTransactionId: transactionId,
          reason: reason,
          originalAmount: transaction.amount,
          originalFee: transaction.fee || 0,
        },
      });

      // Update float balances (reverse the original transaction)
      await this.reverseFloatBalances(transaction, sourceModule, transactionId);

      // Soft delete the transaction (mark as deleted)
      await this.updateTransactionStatus(
        transactionId,
        sourceModule,
        "deleted"
      );

      // Log audit
      await AuditLoggerService.log({
        userId: userId,
        username: await getUserFullName(processedBy),
        actionType: "transaction_deletion",
        entityType: sourceModule,
        entityId: transactionId,
        description: `${sourceModule} transaction deleted: ${reason}`,
        branchId: branchId,
        branchName: "Branch",
        status: "success",
        severity: "high",
        details: {
          originalTransactionId: transactionId,
          reason: reason,
          amount: transaction.amount,
          fee: transaction.fee || 0,
        },
      });

      return {
        success: true,
        message: `${sourceModule} transaction deleted successfully`,
      };
    } catch (error) {
      console.error("Error deleting transaction:", error);

      // Log audit failure
      await AuditLoggerService.log({
        userId: userId,
        username: await getUserFullName(processedBy),
        actionType: "transaction_deletion",
        entityType: sourceModule,
        entityId: transactionId,
        description: `Failed to delete ${sourceModule} transaction`,
        branchId: branchId,
        branchName: "Branch",
        status: "failure",
        severity: "high",
        details: {
          originalTransactionId: transactionId,
          reason: reason,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete transaction",
      };
    }
  }

  /**
   * Generate receipt for a transaction
   */
  static async generateReceipt(
    transactionId: string,
    sourceModule: string,
    branchName: string = "Branch"
  ): Promise<{ success: boolean; receipt?: string; error?: string }> {
    try {
      const transaction = await this.getTransactionById(
        transactionId,
        sourceModule
      );
      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      const receiptData = {
        transactionId: transaction.id,
        sourceModule: sourceModule,
        transactionType:
          transaction.transactionType || transaction.type || "Transaction",
        amount: Number(transaction.amount) || 0,
        fee: Number(transaction.fee) || 0,
        customerName: transaction.customer_name,
        reference: transaction.reference || transaction.id,
        branchName: branchName,
        date: transaction.created_at,
        additionalData: {
          provider: transaction.provider,
          phoneNumber: transaction.phone_number,
          accountNumber: transaction.account_number,
        },
      };

      const receipt = UnifiedGLPostingService.generateReceipt(receiptData);
      return { success: true, receipt };
    } catch (error) {
      console.error("Error generating receipt:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate receipt",
      };
    }
  }

  // Helper methods
  private static async getTransactionById(
    transactionId: string,
    sourceModule: string
  ) {
    // Use proper template literal for dynamic table names
    const tableName = `${sourceModule}_transactions`;
    let result;

    switch (sourceModule) {
      case "momo":
        result =
          await sql`SELECT * FROM momo_transactions WHERE id = ${transactionId}`;
        break;
      case "agency_banking":
        result =
          await sql`SELECT * FROM agency_banking_transactions WHERE id = ${transactionId}`;
        break;
      case "e_zwich":
        // Check both withdrawal and card issuance tables
        result =
          await sql`SELECT * FROM e_zwich_withdrawals WHERE id = ${transactionId}`;
        if (result.length === 0) {
          result = await sql`SELECT 
              *,
              'card_issuance' as type,
              fee_charged as amount,
              fee_charged as fee,
              issued_by as user_id,
              payment_method as provider
            FROM ezwich_card_issuance WHERE id = ${transactionId}`;
        }
        break;
      case "power":
        result =
          await sql`SELECT * FROM power_transactions WHERE id = ${transactionId}`;
        break;
      case "jumia":
        result =
          await sql`SELECT * FROM jumia_transactions WHERE id = ${transactionId}`;
        break;
      default:
        throw new Error(`Unsupported source module: ${sourceModule}`);
    }

    return result[0] || null;
  }

  private static async createReversalTransaction(
    originalTransaction: any,
    reason: string,
    userId: string,
    branchId: string,
    sourceModule: string
  ) {
    let result;

    switch (sourceModule) {
      case "momo":
        result = await sql`
          INSERT INTO momo_transactions (
            branch_id, user_id, customer_name, phone_number, amount, fee, 
            type, provider, reference, status, notes, is_reversal, original_transaction_id
          ) VALUES (
            ${branchId}, ${userId}, ${originalTransaction.customer_name}, 
            ${originalTransaction.phone_number}, ${originalTransaction.amount}, 
            ${originalTransaction.fee || 0}, ${
          originalTransaction.transactionType || originalTransaction.type
        }, 
            ${originalTransaction.provider}, ${`REV-${
          originalTransaction.reference || originalTransaction.id
        }`}, 
            'completed', ${reason}, true, ${originalTransaction.id}
          )
          RETURNING *
        `;
        break;
      case "agency_banking":
        result = await sql`
          INSERT INTO agency_banking_transactions (
            branch_id, user_id, customer_name, account_number, amount, fee, 
            type, partner_bank, partner_bank_code, partner_bank_id, reference, status, notes, is_reversal, original_transaction_id
          ) VALUES (
            ${branchId}, ${userId}, ${originalTransaction.customer_name}, 
            ${originalTransaction.account_number}, ${
          originalTransaction.amount
        }, 
            ${originalTransaction.fee || 0}, ${
          originalTransaction.transactionType || originalTransaction.type
        }, 
            ${
              originalTransaction.partner_bank ||
              originalTransaction.provider ||
              "unknown"
            }, 
            ${
              originalTransaction.partner_bank_code ||
              originalTransaction.partner_bank ||
              originalTransaction.provider ||
              "unknown"
            }, 
            ${
              originalTransaction.partner_bank_id ||
              originalTransaction.partner_bank ||
              originalTransaction.provider ||
              "unknown"
            }, 
            ${`REV-${
              originalTransaction.reference || originalTransaction.id
            }`}, 'completed', ${reason}, true, ${originalTransaction.id}
          )
          RETURNING *
        `;
        break;
      case "e_zwich":
        // Check if it's a withdrawal or card issuance
        const withdrawal = await sql`
          SELECT id FROM e_zwich_withdrawals WHERE id = ${originalTransaction.id}
        `;

        if (withdrawal.length > 0) {
          // Create withdrawal reversal record
          result = await sql`
            INSERT INTO e_zwich_withdrawals (
              branch_id, user_id, card_number, customer_name, amount, fee,
              partner_bank, reference, status, is_reversal, original_transaction_id
            ) VALUES (
              ${branchId}, ${userId}, ${originalTransaction.card_number}, 
              ${originalTransaction.customer_name}, ${
            originalTransaction.amount
          }, 
              ${originalTransaction.fee || 0}, ${
            originalTransaction.partner_bank
          }, 
              ${`REV-${
                originalTransaction.reference || originalTransaction.id
              }`}, 
              'completed', true, ${originalTransaction.id}
            )
            RETURNING *
          `;
        } else {
          // Create card issuance reversal record
          result = await sql`
            INSERT INTO ezwich_card_issuance (
              branch_id, issued_by, customer_name, customer_phone, fee_charged,
              payment_method, reference, status, is_reversal, original_transaction_id
            ) VALUES (
              ${branchId}, ${userId}, ${originalTransaction.customer_name}, 
              ${originalTransaction.customer_phone}, ${
            originalTransaction.fee || 0
          }, 
              'cash', ${`REV-${
                originalTransaction.reference || originalTransaction.id
              }`}, 
              'completed', true, ${originalTransaction.id}
            )
            RETURNING *
          `;
        }
        break;

      case "power":
        result = await sql`
          INSERT INTO power_transactions (
            branch_id, user_id, meter_number, provider, amount, customer_name, 
            customer_phone, reference, status, notes, is_reversal, original_transaction_id
          ) VALUES (
            ${branchId}, ${userId}, ${originalTransaction.meter_number}, 
            ${originalTransaction.provider}, ${originalTransaction.amount}, 
            ${originalTransaction.customer_name}, ${
          originalTransaction.customer_phone || originalTransaction.phone_number
        }, 
            ${`REV-${
              originalTransaction.reference || originalTransaction.id
            }`}, 'completed', ${reason}, true, ${originalTransaction.id}
          )
          RETURNING *
        `;
        break;

      case "jumia":
        result = await sql`
          INSERT INTO jumia_transactions (
            branch_id, user_id, transaction_type, tracking_id, customer_name, 
            customer_phone, amount, status, delivery_status, 
            reference, notes, is_reversal, original_transaction_id
          ) VALUES (
            ${branchId}, ${userId}, ${
          originalTransaction.transactionType || originalTransaction.type
        }, 
            ${originalTransaction.tracking_id}, ${
          originalTransaction.customer_name
        }, 
            ${
              originalTransaction.customer_phone ||
              originalTransaction.phone_number
            }, 
            ${originalTransaction.amount}, 'completed', 'delivered', 
            ${`REV-${
              originalTransaction.reference || originalTransaction.id
            }`}, ${reason}, true, ${originalTransaction.id}
          )
          RETURNING *
        `;
        break;

      default:
        throw new Error(
          `Unsupported source module for reversal: ${sourceModule}`
        );
    }

    return result[0];
  }

  private static async reverseFloatBalances(
    transaction: any,
    sourceModule: string,
    transactionId: string
  ) {
    // Parse and fix the amount to handle malformed values
    const parseAmount = (amount: any): number => {
      if (typeof amount === "string") {
        // Remove any commas
        let cleanAmount = amount.replace(/,/g, "");

        // Handle multiple decimal points (e.g., "100.000.00" -> "100000.00")
        if (cleanAmount.includes(".")) {
          const parts = cleanAmount.split(".");
          if (parts.length > 2) {
            // If we have multiple decimal points, treat all but the last as thousands separators
            const lastPart = parts.pop(); // Remove the last part (decimal places)
            const wholePart = parts.join(""); // Join all other parts
            cleanAmount = `${wholePart}.${lastPart}`;
          }
        }

        return Number(cleanAmount);
      }
      return Number(amount) || 0;
    };

    // Parse amounts safely
    const amount = parseAmount(transaction.amount);
    const fee = parseAmount(transaction.fee || 0);
    const commission = parseAmount(transaction.commission || 0);
    const totalAmount = amount + fee;

    console.log(
      `[${sourceModule.toUpperCase()}] Parsed amounts - Amount: ${amount}, Fee: ${fee}, Commission: ${commission}, Total: ${totalAmount}`
    );

    // Handle cash in till reversal for all service types
    if (transaction.cash_till_affected) {
      const cashTillAmount = parseAmount(transaction.cash_till_affected);
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance - ${cashTillAmount}, 
            updated_at = NOW()
        WHERE branch_id = ${transaction.branch_id}
        AND account_type = 'cash-in-till'
        AND is_active = true
      `;
      console.log(
        `[${sourceModule.toUpperCase()}] Reversed cash till balance by ${cashTillAmount}`
      );
    }

    // Handle float account reversal based on service type
    switch (sourceModule) {
      case "momo":
        // Handle MoMo float account reversal
        if (transaction.float_affected) {
          const floatAmount = parseAmount(transaction.float_affected);
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${floatAmount}, 
                updated_at = NOW()
            WHERE id = ${transaction.float_account_id}
          `;
          console.log(
            `[${sourceModule.toUpperCase()}] Reversed MoMo float balance by ${floatAmount}`
          );
        }
        break;

      case "agency_banking":
        // Handle agency banking float account reversal
        if (transaction.float_affected) {
          const floatAmount = parseAmount(transaction.float_affected);
          // Find the agency banking float account for this provider
          const agencyAccount = await sql`
            SELECT * FROM float_accounts 
            WHERE branch_id = ${transaction.branch_id}
            AND provider = ${transaction.partner_bank || transaction.provider}
            AND account_type = 'agency-banking'
            AND is_active = true
            LIMIT 1
          `;

          if (agencyAccount.length > 0) {
            await sql`
              UPDATE float_accounts 
              SET current_balance = current_balance - ${floatAmount}, 
                  updated_at = NOW()
              WHERE id = ${agencyAccount[0].id}
            `;
            console.log(
              `[${sourceModule.toUpperCase()}] Reversed agency banking float balance by ${floatAmount} for provider: ${
                transaction.partner_bank || transaction.provider
              }`
            );
          } else {
            console.error(
              `[${sourceModule.toUpperCase()}] Agency banking float account not found for provider: ${
                transaction.partner_bank || transaction.provider
              }`
            );
          }
        }
        break;

      case "e_zwich":
        // Handle E-Zwich float account reversal based on transaction type
        // Check if it's a withdrawal or card issuance
        const withdrawal = await sql`
          SELECT id FROM e_zwich_withdrawals WHERE id = ${transaction.id}
        `;

        if (withdrawal.length > 0) {
          // Withdrawal reversal: E-Zwich settlement decreases, cash in till increases

          // Get E-Zwich settlement account
          const ezwichSettlementAccount = await sql`
            SELECT * FROM float_accounts 
            WHERE branch_id = ${transaction.branch_id}
            AND account_type = 'e-zwich'
            AND is_active = true
            LIMIT 1
          `;

          if (
            !ezwichSettlementAccount ||
            ezwichSettlementAccount.length === 0
          ) {
            throw new Error("No E-Zwich settlement account found for reversal");
          }

          // Reverse E-Zwich settlement balance (decrease)
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${totalAmount}, 
                updated_at = NOW()
            WHERE id = ${ezwichSettlementAccount[0].id}
          `;
          console.log(
            `[${sourceModule.toUpperCase()}] Reversed E-Zwich settlement balance by ${totalAmount}`
          );

          // Get cash in till account
          const cashTillAccount = await sql`
            SELECT * FROM float_accounts 
            WHERE branch_id = ${transaction.branch_id}
            AND account_type = 'cash-in-till'
            AND is_active = true
            LIMIT 1
          `;

          if (!cashTillAccount || cashTillAccount.length === 0) {
            throw new Error("No cash in till account found for reversal");
          }

          // Reverse cash in till balance (increase)
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${totalAmount}, 
                updated_at = NOW()
            WHERE id = ${cashTillAccount[0].id}
          `;
          console.log(
            `[${sourceModule.toUpperCase()}] Reversed cash in till balance by ${totalAmount}`
          );
        } else {
          // Card issuance reversal: Cash in till decreases

          // Get cash in till account
          const cashTillAccount = await sql`
            SELECT * FROM float_accounts 
            WHERE branch_id = ${transaction.branch_id}
            AND account_type = 'cash-in-till'
            AND is_active = true
            LIMIT 1
          `;

          if (cashTillAccount.length > 0) {
            // Reverse cash in till balance (decrease)
            await sql`
              UPDATE float_accounts 
              SET current_balance = current_balance - ${totalAmount}, 
                  updated_at = NOW()
              WHERE id = ${cashTillAccount[0].id}
            `;
            console.log(
              `[${sourceModule.toUpperCase()}] Reversed cash in till balance by ${totalAmount}`
            );
          }
        }
        break;

      case "power":
        // Handle Power float account reversal
        if (transaction.float_account_id) {
          const powerAmount = amount + commission;
          // Reverse power float balance (increase - since original transaction decreased it)
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${powerAmount}, 
                updated_at = NOW()
            WHERE id = ${transaction.float_account_id}
          `;
          console.log(
            `[${sourceModule.toUpperCase()}] Reversed Power float balance by ${powerAmount}`
          );
        }

        // Reverse cash in till balance (decrease - since original transaction increased it)
        const cashTillAccount = await sql`
          SELECT * FROM float_accounts 
          WHERE branch_id = ${transaction.branch_id}
          AND account_type = 'cash-in-till'
          AND is_active = true
          LIMIT 1
        `;

        if (cashTillAccount.length > 0) {
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${totalAmount}, 
                updated_at = NOW()
            WHERE id = ${cashTillAccount[0].id}
          `;
          console.log(
            `[${sourceModule.toUpperCase()}] Reversed cash in till balance by ${totalAmount}`
          );
        }
        break;

      case "jumia":
        // Handle Jumia float account reversal
        if (transaction.float_affected) {
          const floatAmount = parseAmount(transaction.float_affected);
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${floatAmount}, 
                updated_at = NOW()
            WHERE id = ${transaction.float_account_id}
          `;
          console.log(
            `[${sourceModule.toUpperCase()}] Reversed Jumia float balance by ${floatAmount}`
          );
        }
        break;

      default:
        console.warn(
          `[${sourceModule.toUpperCase()}] No float reversal logic for source module: ${sourceModule}`
        );
    }
  }

  /**
   * Update transaction status in the appropriate table
   */
  private static async updateTransactionStatus(
    transactionId: string,
    sourceModule: string,
    status: string
  ) {
    try {
      switch (sourceModule) {
        case "momo":
          await sql`
            UPDATE momo_transactions 
            SET status = ${status}, updated_at = NOW()
            WHERE id = ${transactionId}
          `;
          break;
        case "agency_banking":
          await sql`
            UPDATE agency_banking_transactions 
            SET status = ${status}, updated_at = NOW()
            WHERE id = ${transactionId}
          `;
          break;
        case "e_zwich":
          // Check if it's a withdrawal or card issuance
          const withdrawal = await sql`
            SELECT id FROM e_zwich_withdrawals WHERE id = ${transactionId}
          `;
          if (withdrawal.length > 0) {
            await sql`
              UPDATE e_zwich_withdrawals 
              SET status = ${status}, updated_at = NOW()
              WHERE id = ${transactionId}
            `;
          } else {
            await sql`
              UPDATE ezwich_card_issuance 
              SET status = ${status}, updated_at = NOW()
              WHERE id = ${transactionId}
            `;
          }
          break;
        case "power":
          await sql`
            UPDATE power_transactions 
            SET status = ${status}, updated_at = NOW()
            WHERE id = ${transactionId}
          `;
          break;
        case "jumia":
          await sql`
            UPDATE jumia_transactions 
            SET status = ${status}, updated_at = NOW()
            WHERE id = ${transactionId}
          `;
          break;
        default:
          console.log(`Unknown source module: ${sourceModule}`);
      }
    } catch (error) {
      console.error(`Error updating transaction status:`, error);
    }
  }

  /**
   * Complete a Power or Jumia transaction (pending -> completed)
   */
  static async completeTransaction(
    transactionId: string,
    sourceModule: string,
    userId: string,
    branchId: string,
    processedBy: string
  ): Promise<TransactionResult> {
    try {
      console.log(`Completing ${sourceModule} transaction:`, transactionId);

      // Get the transaction details
      const transaction = await this.getTransactionById(
        transactionId,
        sourceModule
      );
      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Validate transaction can be completed
      if (sourceModule === "power" && transaction.status !== "pending") {
        return {
          success: false,
          error: "Power transaction is not in pending status",
        };
      }

      if (sourceModule === "jumia" && transaction.status !== "completed") {
        return {
          success: false,
          error: "Jumia transaction is not in completed status",
        };
      }

      // For Power and Jumia: Update transaction status to completed
      const newStatus = "completed";
      await this.updateTransactionStatus(
        transactionId,
        sourceModule,
        newStatus
      );

      // Log audit
      const userName = await getUserFullName(userId);
      await AuditLoggerService.log({
        userId: userId,
        username: userName,
        actionType: "transaction_completed",
        entityType: "transaction",
        entityId: transactionId,
        description: `${sourceModule} transaction completed`,
        branchId: branchId,
        branchName: "Branch",
        status: "success",
        severity: "low",
        details: {
          sourceModule: sourceModule,
          transactionId: transactionId,
          processedBy: processedBy,
        },
      });

      return {
        success: true,
        message: `${sourceModule} transaction completed successfully`,
        data: { transactionId, newStatus },
      };
    } catch (error) {
      console.error(`Error completing ${sourceModule} transaction:`, error);
      return {
        success: false,
        error: `Failed to complete ${sourceModule} transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Deliver a Jumia transaction (completed -> delivered)
   */
  static async deliverTransaction(
    transactionId: string,
    sourceModule: string,
    userId: string,
    branchId: string,
    processedBy: string
  ): Promise<TransactionResult> {
    try {
      console.log(`Delivering ${sourceModule} transaction:`, transactionId);

      // Get the transaction details
      const transaction = await this.getTransactionById(
        transactionId,
        sourceModule
      );
      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Validate transaction can be delivered
      if (sourceModule !== "jumia") {
        return {
          success: false,
          error: "Deliver action only available for Jumia transactions",
        };
      }

      if (transaction.status !== "completed") {
        return {
          success: false,
          error: "Jumia transaction is not in completed status",
        };
      }

      // Update transaction status to delivered
      await this.updateTransactionStatus(
        transactionId,
        sourceModule,
        "delivered"
      );

      // Log audit
      const userName = await getUserFullName(userId);
      await AuditLoggerService.log({
        userId: userId,
        username: userName,
        actionType: "transaction_delivered",
        entityType: "transaction",
        entityId: transactionId,
        description: `${sourceModule} transaction delivered`,
        branchId: branchId,
        branchName: "Branch",
        status: "success",
        severity: "low",
        details: {
          sourceModule: sourceModule,
          transactionId: transactionId,
          processedBy: processedBy,
        },
      });

      return {
        success: true,
        message: `${sourceModule} transaction delivered successfully`,
        data: { transactionId, newStatus: "delivered" },
      };
    } catch (error) {
      console.error(`Error delivering ${sourceModule} transaction:`, error);
      return {
        success: false,
        error: `Failed to deliver ${sourceModule} transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Update transaction record in the appropriate table
   */
  private static async updateTransactionRecord(
    transactionId: string,
    sourceModule: string,
    updatedData: any
  ) {
    try {
      switch (sourceModule) {
        case "momo":
          const momoResult = await sql`
            UPDATE momo_transactions 
            SET 
              customer_name = ${updatedData.customerName},
              phone_number = ${updatedData.phoneNumber || null},
              amount = ${updatedData.amount},
              fee = ${updatedData.fee || 0},
              provider = ${updatedData.provider},
              reference = ${updatedData.reference || null},
              notes = ${updatedData.notes || null},
              updated_at = NOW()
            WHERE id = ${transactionId}
            RETURNING *
          `;
          return momoResult[0];
        case "agency_banking":
          const agencyResult = await sql`
            UPDATE agency_banking_transactions 
            SET 
              customer_name = ${updatedData.customerName},
              account_number = ${updatedData.accountNumber || null},
              amount = ${updatedData.amount},
              fee = ${updatedData.fee || 0},
              provider = ${updatedData.provider},
              reference = ${updatedData.reference || null},
              notes = ${updatedData.notes || null},
              updated_at = NOW()
            WHERE id = ${transactionId}
            RETURNING *
          `;
          return agencyResult[0];
        case "e_zwich":
          // Check if it's a withdrawal or card issuance
          const withdrawal = await sql`
            SELECT id FROM e_zwich_withdrawals WHERE id = ${transactionId}
          `;
          if (withdrawal.length > 0) {
            // Update withdrawal record
            const withdrawalUpdates = [];
            const withdrawalValues = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updatedData)) {
              if (value !== undefined) {
                withdrawalUpdates.push(`${key} = $${paramIndex}`);
                withdrawalValues.push(value);
                paramIndex++;
              }
            }

            if (withdrawalUpdates.length > 0) {
              withdrawalValues.push(transactionId);
              await sql.unsafe(
                `UPDATE e_zwich_withdrawals SET ${withdrawalUpdates.join(
                  ", "
                )}, updated_at = NOW() WHERE id = $${paramIndex}`,
                ...withdrawalValues
              );
            }
          } else {
            // Update card issuance record
            const issuanceUpdates = [];
            const issuanceValues = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updatedData)) {
              if (value !== undefined) {
                issuanceUpdates.push(`${key} = $${paramIndex}`);
                issuanceValues.push(value);
                paramIndex++;
              }
            }

            if (issuanceUpdates.length > 0) {
              issuanceValues.push(transactionId);
              await sql.unsafe(
                `UPDATE ezwich_card_issuance SET ${issuanceUpdates.join(
                  ", "
                )}, updated_at = NOW() WHERE id = $${paramIndex}`,
                ...issuanceValues
              );
            }
          }
          break;
        case "power":
          const powerResult = await sql`
            UPDATE power_transactions 
            SET 
              customer_name = ${updatedData.customerName},
              phone_number = ${updatedData.phoneNumber || null},
              amount = ${updatedData.amount},
              fee = ${updatedData.fee || 0},
              provider = ${updatedData.provider},
              reference = ${updatedData.reference || null},
              notes = ${updatedData.notes || null},
              updated_at = NOW()
            WHERE id = ${transactionId}
            RETURNING *
          `;
          return powerResult[0];
        case "jumia":
          const jumiaResult = await sql`
            UPDATE jumia_transactions 
            SET 
              customer_name = ${updatedData.customerName},
              phone_number = ${updatedData.phoneNumber || null},
              amount = ${updatedData.amount},
              fee = ${updatedData.fee || 0},
              provider = ${updatedData.provider},
              reference = ${updatedData.reference || null},
              notes = ${updatedData.notes || null},
              updated_at = NOW()
            WHERE id = ${transactionId}
            RETURNING *
          `;
          return jumiaResult[0];
        default:
          console.log(`Unknown source module: ${sourceModule}`);
          return null;
      }
    } catch (error) {
      console.error(`Error updating transaction record:`, error);
      return null;
    }
  }

  private static async adjustFloatBalances(
    originalTransaction: any,
    totalDifference: number,
    sourceModule: string,
    transactionType: string
  ) {
    // Adjust float balances based on the difference for all service types
    switch (sourceModule) {
      case "momo":
        if (transactionType === "cash-in" || transactionType === "deposit") {
          // For cash-in, adjust cash till and MoMo float
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${totalDifference}, 
                updated_at = NOW()
            WHERE branch_id = ${originalTransaction.branch_id}
            AND account_type = 'cash-in-till'
            AND is_active = true
          `;

          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${totalDifference}, 
                updated_at = NOW()
            WHERE id = ${originalTransaction.float_account_id}
          `;
        } else if (
          transactionType === "cash-out" ||
          transactionType === "withdrawal"
        ) {
          // For cash-out, adjust cash till and MoMo float
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${totalDifference}, 
                updated_at = NOW()
            WHERE branch_id = ${originalTransaction.branch_id}
            AND account_type = 'cash-in-till'
            AND is_active = true
          `;

          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${totalDifference}, 
                updated_at = NOW()
            WHERE id = ${originalTransaction.float_account_id}
          `;
        }
        break;

      case "agency_banking":
        if (transactionType === "deposit") {
          // For deposit, adjust cash till and agency banking float
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${totalDifference}, 
                updated_at = NOW()
            WHERE branch_id = ${originalTransaction.branch_id}
            AND account_type = 'cash-in-till'
            AND is_active = true
          `;

          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${totalDifference}, 
                updated_at = NOW()
            WHERE id = ${originalTransaction.float_account_id}
          `;
        } else if (transactionType === "withdrawal") {
          // For withdrawal, adjust cash till and agency banking float
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${totalDifference}, 
                updated_at = NOW()
            WHERE branch_id = ${originalTransaction.branch_id}
            AND account_type = 'cash-in-till'
            AND is_active = true
          `;

          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${totalDifference}, 
                updated_at = NOW()
            WHERE id = ${originalTransaction.float_account_id}
          `;
        }
        break;

      case "e_zwich":
        if (transactionType === "withdrawal") {
          // For withdrawal, adjust E-Zwich settlement account
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${totalDifference}, 
                updated_at = NOW()
            WHERE id = ${originalTransaction.ezwich_settlement_account_id}
          `;
        } else if (transactionType === "card_issuance") {
          // For card issuance, adjust cash till
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${totalDifference}, 
                updated_at = NOW()
            WHERE branch_id = ${originalTransaction.branch_id}
            AND account_type = 'cash-in-till'
            AND is_active = true
          `;
        }
        break;

      case "power":
        // For power transactions, adjust the specific power float account
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance - ${totalDifference}, 
              updated_at = NOW()
          WHERE id = ${originalTransaction.float_account_id}
        `;
        break;

      case "jumia":
        // For Jumia transactions, adjust the specific Jumia float account
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance - ${totalDifference}, 
              updated_at = NOW()
          WHERE id = ${originalTransaction.float_account_id}
        `;
        break;

      default:
        console.log(
          `[${sourceModule.toUpperCase()}] No specific float adjustment for service type: ${sourceModule}`
        );
        break;
    }
  }

  /**
   * Get transactions with filtering and pagination
   */
  static async getTransactions({
    branchId,
    serviceType,
    provider,
    limit = 50,
    offset = 0,
  }: {
    branchId: string;
    serviceType?: string;
    provider?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    transactions?: any[];
    pagination?: any;
    error?: string;
  }> {
    try {
      console.log(`Fetching transactions for branch: ${branchId}`);

      let transactions: any[] = [];
      let totalCount = 0;

      // Build the query based on serviceType
      if (serviceType === "momo") {
        // Fetch MoMo transactions
        const momoTransactions = await sql`
          SELECT 
            mt.id,
            mt.customer_name,
            mt.phone_number,
            mt.amount,
            mt.fee,
            mt.type as transaction_type,
            mt.provider,
            mt.reference,
            mt.status,
            mt.created_at,
            mt.branch_id,
            mt.user_id,
            mt.float_account_id,
            b.name as branch_name
          FROM momo_transactions mt
          LEFT JOIN branches b ON mt.branch_id = b.id
          WHERE mt.branch_id = ${branchId}
          ${provider ? sql`AND mt.provider = ${provider}` : sql``}
          ORDER BY mt.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        const countResult = await sql`
          SELECT COUNT(*)::int as count 
          FROM momo_transactions 
          WHERE branch_id = ${branchId}
          ${provider ? sql`AND provider = ${provider}` : sql``}
        `;

        transactions = momoTransactions.map((t) => ({
          id: t.id,
          customerName: t.customer_name,
          phoneNumber: t.phone_number,
          amount: t.amount,
          fee: t.fee,
          type: t.transaction_type,
          provider: t.provider,
          reference: t.reference,
          status: t.status,
          date: t.created_at,
          branchId: t.branch_id,
          branchName: t.branch_name,
          userId: t.user_id,
          floatAccountId: t.float_account_id,
          serviceType: "momo",
        }));

        totalCount = countResult[0]?.count || 0;
      } else if (serviceType === "agency_banking") {
        // Fetch Agency Banking transactions
        const agencyTransactions = await sql`
          SELECT 
            abt.id,
            abt.customer_name,
            abt.phone_number,
            abt.amount,
            abt.fee,
            abt.transaction_type,
            abt.provider,
            abt.reference,
            abt.status,
            abt.created_at,
            abt.branch_id,
            abt.user_id,
            abt.float_account_id,
            b.name as branch_name
          FROM agency_banking_transactions abt
          LEFT JOIN branches b ON abt.branch_id = b.id
          WHERE abt.branch_id = ${branchId}
          ${provider ? sql`AND abt.provider = ${provider}` : sql``}
          ORDER BY abt.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        const countResult = await sql`
          SELECT COUNT(*)::int as count 
          FROM agency_banking_transactions 
          WHERE branch_id = ${branchId}
          ${provider ? sql`AND provider = ${provider}` : sql``}
        `;

        transactions = agencyTransactions.map((t) => ({
          id: t.id,
          customerName: t.customer_name,
          phoneNumber: t.phone_number,
          amount: t.amount,
          fee: t.fee,
          type: t.transaction_type,
          provider: t.provider,
          reference: t.reference,
          status: t.status,
          date: t.created_at,
          branchId: t.branch_id,
          branchName: t.branch_name,
          userId: t.user_id,
          floatAccountId: t.float_account_id,
          serviceType: "agency_banking",
        }));

        totalCount = countResult[0]?.count || 0;
      } else if (serviceType === "e_zwich") {
        // Fetch E-Zwich transactions (combine card issuances and withdrawals)
        const cardIssuances = await sql`
          SELECT 
            eci.id,
            eci.customer_name,
            eci.phone_number,
            eci.amount,
            eci.fee,
            'card_issuance' as transaction_type,
            eci.provider,
            eci.reference,
            eci.status,
            eci.created_at,
            eci.branch_id,
            eci.user_id,
            eci.float_account_id,
            b.name as branch_name
          FROM e_zwich_card_issuances eci
          LEFT JOIN branches b ON eci.branch_id = b.id
          WHERE eci.branch_id = ${branchId}
          ${provider ? sql`AND eci.provider = ${provider}` : sql``}
        `;

        const withdrawals = await sql`
          SELECT 
            ew.id,
            ew.customer_name,
            ew.phone_number,
            ew.amount,
            ew.fee,
            'withdrawal' as transaction_type,
            ew.provider,
            ew.reference,
            ew.status,
            ew.created_at,
            ew.branch_id,
            ew.user_id,
            ew.float_account_id,
            b.name as branch_name
          FROM e_zwich_withdrawals ew
          LEFT JOIN branches b ON ew.branch_id = b.id
          WHERE ew.branch_id = ${branchId}
          ${provider ? sql`AND ew.provider = ${provider}` : sql``}
        `;

        const allTransactions = [...cardIssuances, ...withdrawals]
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(offset, offset + limit);

        const countResult = await sql`
          SELECT 
            (SELECT COUNT(*) FROM e_zwich_card_issuances WHERE branch_id = ${branchId} ${
          provider ? sql`AND provider = ${provider}` : sql``
        }) +
            (SELECT COUNT(*) FROM e_zwich_withdrawals WHERE branch_id = ${branchId} ${
          provider ? sql`AND provider = ${provider}` : sql``
        }) as count
        `;

        transactions = allTransactions.map((t) => ({
          id: t.id,
          customerName: t.customer_name,
          phoneNumber: t.phone_number,
          amount: t.amount,
          fee: t.fee,
          type: t.transaction_type,
          provider: t.provider,
          reference: t.reference,
          status: t.status,
          date: t.created_at,
          branchId: t.branch_id,
          branchName: t.branch_name,
          userId: t.user_id,
          floatAccountId: t.float_account_id,
          serviceType: "e_zwich",
        }));

        totalCount = countResult[0]?.count || 0;
      } else if (serviceType === "power") {
        // Fetch Power transactions
        const powerTransactions = await sql`
          SELECT 
            pt.id,
            pt.customer_name,
            pt.customer_phone as phone_number,
            pt.amount,
            pt.commission as fee,
            pt.type as transaction_type,
            pt.provider,
            pt.reference,
            pt.status,
            pt.created_at,
            pt.branch_id,
            pt.user_id,
            pt.meter_number,
            'power' as service_type,
            b.name as branch_name
          FROM power_transactions pt
          LEFT JOIN branches b ON pt.branch_id = b.id
          WHERE pt.branch_id = ${branchId}
        `;

        const countResult = await sql`
          SELECT COUNT(*)::int as count 
          FROM power_transactions 
          WHERE branch_id = ${branchId}
        `;

        transactions = powerTransactions.map((t) => ({
          id: t.id,
          customerName: t.customer_name,
          phoneNumber: t.phone_number,
          amount: t.amount,
          fee: t.fee,
          type: t.transaction_type,
          provider: t.provider,
          reference: t.reference,
          status: t.status,
          date: t.created_at,
          branchId: t.branch_id,
          branchName: t.branch_name,
          userId: t.user_id,
          meterNumber: t.meter_number,
          serviceType: "power",
        }));

        totalCount = countResult[0]?.count || 0;
      } else if (serviceType === "jumia") {
        // Fetch Jumia transactions
        const jumiaTransactions = await sql`
          SELECT 
            jt.id,
            jt.customer_name,
            jt.phone_number,
            jt.amount,
            jt.fee,
            jt.transaction_type,
            jt.provider,
            jt.reference,
            jt.status,
            jt.created_at,
            jt.branch_id,
            jt.user_id,
            jt.float_account_id,
            b.name as branch_name
          FROM jumia_transactions jt
          LEFT JOIN branches b ON jt.branch_id = b.id
          WHERE jt.branch_id = ${branchId}
          ${provider ? sql`AND jt.provider = ${provider}` : sql``}
          ORDER BY jt.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        const countResult = await sql`
          SELECT COUNT(*)::int as count 
          FROM jumia_transactions 
          WHERE branch_id = ${branchId}
          ${provider ? sql`AND provider = ${provider}` : sql``}
        `;

        transactions = jumiaTransactions.map((t) => ({
          id: t.id,
          customerName: t.customer_name,
          phoneNumber: t.phone_number,
          amount: t.amount,
          fee: t.fee,
          type: t.transaction_type,
          provider: t.provider,
          reference: t.reference,
          status: t.status,
          date: t.created_at,
          branchId: t.branch_id,
          branchName: t.branch_name,
          userId: t.user_id,
          floatAccountId: t.float_account_id,
          serviceType: "jumia",
        }));

        totalCount = countResult[0]?.count || 0;
      } else {
        // Fetch all transactions (combine all service types)
        const allTransactions = [];

        // MoMo transactions
        const momoTransactions = await sql`
          SELECT 
            mt.id,
            mt.customer_name,
            mt.phone_number,
            mt.amount,
            mt.fee,
            mt.type as transaction_type,
            mt.provider,
            mt.reference,
            mt.status,
            mt.created_at,
            mt.branch_id,
            mt.user_id,
            mt.float_account_id,
            'momo' as service_type,
            b.name as branch_name
          FROM momo_transactions mt
          LEFT JOIN branches b ON mt.branch_id = b.id
          WHERE mt.branch_id = ${branchId}
        `;

        // Agency Banking transactions
        const agencyTransactions = await sql`
          SELECT 
            abt.id,
            abt.customer_name,
            abt.phone_number,
            abt.amount,
            abt.fee,
            abt.transaction_type,
            abt.provider,
            abt.reference,
            abt.status,
            abt.created_at,
            abt.branch_id,
            abt.user_id,
            abt.float_account_id,
            'agency_banking' as service_type,
            b.name as branch_name
          FROM agency_banking_transactions abt
          LEFT JOIN branches b ON abt.branch_id = b.id
          WHERE abt.branch_id = ${branchId}
        `;

        // E-Zwich transactions
        const ezwichCardIssuances = await sql`
          SELECT 
            eci.id,
            eci.customer_name,
            eci.phone_number,
            eci.amount,
            eci.fee,
            'card_issuance' as transaction_type,
            eci.provider,
            eci.reference,
            eci.status,
            eci.created_at,
            eci.branch_id,
            eci.user_id,
            eci.float_account_id,
            'e_zwich' as service_type,
            b.name as branch_name
          FROM e_zwich_card_issuances eci
          LEFT JOIN branches b ON eci.branch_id = b.id
          WHERE eci.branch_id = ${branchId}
        `;

        const ezwichWithdrawals = await sql`
          SELECT 
            ew.id,
            ew.customer_name,
            ew.phone_number,
            ew.amount,
            ew.fee,
            'withdrawal' as transaction_type,
            ew.provider,
            ew.reference,
            ew.status,
            ew.created_at,
            ew.branch_id,
            ew.user_id,
            ew.float_account_id,
            'e_zwich' as service_type,
            b.name as branch_name
          FROM e_zwich_withdrawals ew
          LEFT JOIN branches b ON ew.branch_id = b.id
          WHERE ew.branch_id = ${branchId}
        `;

        // Power transactions
        const powerTransactions = await sql`
          SELECT 
            pt.id,
            pt.customer_name,
            pt.customer_phone as phone_number,
            pt.amount,
            pt.commission as fee,
            pt.type as transaction_type,
            pt.provider,
            pt.reference,
            pt.status,
            pt.created_at,
            pt.branch_id,
            pt.user_id,
            pt.float_account_id,
            'power' as service_type,
            b.name as branch_name
          FROM power_transactions pt
          LEFT JOIN branches b ON pt.branch_id = b.id
          WHERE pt.branch_id = ${branchId}
        `;

        // Jumia transactions
        const jumiaTransactions = await sql`
          SELECT 
            jt.id,
            jt.customer_name,
            jt.phone_number,
            jt.amount,
            jt.fee,
            jt.transaction_type,
            jt.provider,
            jt.reference,
            jt.status,
            jt.created_at,
            jt.branch_id,
            jt.user_id,
            jt.float_account_id,
            'jumia' as service_type,
            b.name as branch_name
          FROM jumia_transactions jt
          LEFT JOIN branches b ON jt.branch_id = b.id
          WHERE jt.branch_id = ${branchId}
        `;

        // Combine all transactions and sort by date
        const combinedTransactions = [
          ...momoTransactions,
          ...agencyTransactions,
          ...ezwichCardIssuances,
          ...ezwichWithdrawals,
          ...powerTransactions,
          ...jumiaTransactions,
        ].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Apply pagination
        transactions = combinedTransactions
          .slice(offset, offset + limit)
          .map((t) => ({
            id: t.id,
            customerName: t.customer_name,
            phoneNumber: t.phone_number,
            amount: t.amount,
            fee: t.fee,
            type: t.transaction_type,
            provider: t.provider,
            reference: t.reference,
            status: t.status,
            date: t.created_at,
            branchId: t.branch_id,
            branchName: t.branch_name,
            userId: t.user_id,
            floatAccountId: t.float_account_id,
            serviceType: t.service_type,
          }));

        totalCount = combinedTransactions.length;
      }

      return {
        success: true,
        transactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      };
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch transactions",
      };
    }
  }

  /**
   * Get statistics for transactions
   */
  static async getStatistics({
    branchId,
    serviceType,
  }: {
    branchId: string;
    serviceType?: string;
  }): Promise<{
    success: boolean;
    statistics?: any;
    error?: string;
  }> {
    try {
      console.log(
        `Fetching statistics for branch: ${branchId}, service: ${serviceType}`
      );

      // Get transactions using the unified getTransactions method
      const transactionsResult = await this.getTransactions({
        branchId,
        serviceType,
        limit: 1000, // Get more transactions for statistics
        offset: 0,
      });

      if (!transactionsResult.success || !transactionsResult.transactions) {
        return {
          success: false,
          error:
            transactionsResult.error ||
            "Failed to fetch transactions for statistics",
        };
      }

      const transactions = transactionsResult.transactions;

      // Calculate statistics
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const statistics = {
        summary: {
          totalCount: transactions.length,
          totalAmount: transactions.reduce(
            (sum, t) => sum + Number(t.amount || 0),
            0
          ),
          totalCommission: transactions.reduce(
            (sum, t) => sum + Number(t.fee || 0),
            0
          ),
          completedCount: transactions.filter((t) => t.status === "completed")
            .length,
          completedAmount: transactions
            .filter((t) => t.status === "completed")
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          pendingCount: transactions.filter((t) => t.status === "pending")
            .length,
          pendingAmount: transactions
            .filter((t) => t.status === "pending")
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          failedCount: transactions.filter((t) => t.status === "failed").length,
          failedAmount: transactions
            .filter((t) => t.status === "failed")
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          reversedCount: transactions.filter((t) => t.status === "reversed")
            .length,
          reversedAmount: transactions
            .filter((t) => t.status === "reversed")
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          deletedCount: transactions.filter((t) => t.status === "deleted")
            .length,
          deletedAmount: transactions
            .filter((t) => t.status === "deleted")
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          todayCount: transactions.filter((t) => {
            if (!t.date) return false;
            const txDate = new Date(t.date);
            const todayDate = new Date(today);
            return txDate.toDateString() === todayDate.toDateString();
          }).length,
          todayAmount: transactions
            .filter((t) => {
              if (!t.date) return false;
              const txDate = new Date(t.date);
              const todayDate = new Date(today);
              return txDate.toDateString() === todayDate.toDateString();
            })
            .reduce((sum, t) => sum + Number(t.amount || 0), 0),
          todayCommission: transactions
            .filter((t) => {
              if (!t.date) return false;
              const txDate = new Date(t.date);
              const todayDate = new Date(today);
              return txDate.toDateString() === todayDate.toDateString();
            })
            .reduce((sum, t) => sum + Number(t.fee || 0), 0),
        },
        byProvider: this.groupByProvider(transactions),
        byType: this.groupByType(transactions),
        daily: this.groupByDate(transactions),
      };

      return {
        success: true,
        statistics,
      };
    } catch (error) {
      console.error("Error fetching statistics:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch statistics",
      };
    }
  }

  /**
   * Group transactions by provider
   */
  private static groupByProvider(transactions: any[]): any[] {
    const grouped = transactions.reduce((acc, t) => {
      const provider = t.provider || "Unknown";
      if (!acc[provider]) {
        acc[provider] = { provider, count: 0, amount: 0, commission: 0 };
      }
      acc[provider].count++;
      acc[provider].amount += Number(t.amount || 0);
      acc[provider].commission += Number(t.fee || 0);
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => b.amount - a.amount);
  }

  /**
   * Group transactions by type
   */
  private static groupByType(transactions: any[]): any[] {
    const grouped = transactions.reduce((acc, t) => {
      const type = t.type || t.transaction_type || "Unknown";
      if (!acc[type]) {
        acc[type] = { type, count: 0, amount: 0, commission: 0 };
      }
      acc[type].count++;
      acc[type].amount += Number(t.amount || 0);
      acc[type].commission += Number(t.fee || 0);
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => b.amount - a.amount);
  }

  /**
   * Group transactions by date (last 30 days)
   */
  private static groupByDate(transactions: any[]): any[] {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = transactions.filter((t) => {
      const txDate = new Date(t.date || t.created_at);
      return txDate >= thirtyDaysAgo;
    });

    const grouped = recentTransactions.reduce((acc, t) => {
      const date = new Date(t.date || t.created_at).toISOString().slice(0, 10);
      if (!acc[date]) {
        acc[date] = { date, count: 0, amount: 0, commission: 0 };
      }
      acc[date].count++;
      acc[date].amount += Number(t.amount || 0);
      acc[date].commission += Number(t.fee || 0);
      return acc;
    }, {});

    return Object.values(grouped).sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  static async disburseTransaction(
    transactionId: string,
    sourceModule: string,
    userId: string,
    branchId: string,
    processedBy: string
  ): Promise<TransactionResult> {
    try {
      console.log(`Disbursing ${sourceModule} transaction:`, transactionId);

      // Get the transaction details
      const transaction = await this.getTransactionById(
        transactionId,
        sourceModule
      );
      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      // Validate transaction can be disbursed
      if (!["completed", "pending"].includes(transaction.status)) {
        return {
          success: false,
          error: "Transaction is not in a disbursable status",
        };
      }

      // Update transaction status to disbursed
      await this.updateTransactionStatus(
        transactionId,
        sourceModule,
        "disbursed"
      );

      // Log audit
      const userName = await getUserFullName(userId);
      await AuditLoggerService.log({
        userId: userId,
        username: userName,
        actionType: "transaction_disbursed",
        entityType: "transaction",
        entityId: transactionId,
        description: `${sourceModule} transaction disbursed`,
        branchId: branchId,
        branchName: "Branch",
        status: "success",
        severity: "low",
        details: {
          sourceModule: sourceModule,
          transactionId: transactionId,
          processedBy: processedBy,
        },
      });

      return {
        success: true,
        message: `${sourceModule} transaction disbursed successfully`,
      };
    } catch (error) {
      console.error(`Error disbursing ${sourceModule} transaction:`, error);
      return {
        success: false,
        error: `Failed to disburse transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }
}
