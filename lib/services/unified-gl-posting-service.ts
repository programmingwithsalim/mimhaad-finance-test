import { neon } from "@neondatabase/serverless";
import { v4 as uuidv4 } from "uuid";
import { AuditLoggerService } from "./audit-logger-service";
import { AutoGLMappingService } from "./auto-gl-mapping-service";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL!);

export interface UnifiedGLTransactionData {
  transactionId: string;
  sourceModule:
    | "momo"
    | "agency_banking"
    | "e_zwich"
    | "power"
    | "jumia"
    | "expenses"
    | "commissions"
    | "float_transfers"
    | "float_operations";
  transactionType: string;
  amount: number;
  fee: number;
  customerName?: string;
  reference: string;
  processedBy: string;
  branchId: string;
  branchName?: string;
  metadata?: Record<string, any>;
}

export interface ReceiptData {
  transactionId: string;
  sourceModule: string;
  transactionType: string;
  amount: number;
  fee: number;
  customerName?: string;
  reference: string;
  branchName: string;
  date: string;
  additionalData?: Record<string, any>;
}

export class UnifiedGLPostingService {
  static async createGLEntries(
    data: UnifiedGLTransactionData
  ): Promise<{ success: boolean; glTransactionId?: string; error?: string }> {
    try {
      console.log(
        "[GL] Creating GL entries for " + data.sourceModule + " transaction:",
        data.transactionId
      );

      // Validate transactionId format - if it's not a UUID, generate one
      let validTransactionId = data.transactionId;
      if (
        !data.transactionId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        validTransactionId = crypto.randomUUID();
        console.log(
          "[GL] Generated new UUID for transaction:",
          validTransactionId
        );
      }

      // Check if GL entries already exist for this transaction
      const existingTransaction = await sql`
        SELECT id FROM gl_transactions 
        WHERE source_transaction_id = ${validTransactionId} 
        AND source_module = ${data.sourceModule}
        AND source_transaction_type = ${data.transactionType}
      `;

      if (existingTransaction.length > 0) {
        console.log(
          "[GL] GL entries already exist for " +
            data.sourceModule +
            " transaction " +
            data.transactionId
        );
        return { success: true, glTransactionId: existingTransaction[0].id };
      }

      const glTransactionIdResult = await sql`SELECT gen_random_uuid() as id`;
      const glTransactionId = glTransactionIdResult[0].id;

      const accounts = await this.getGLAccountsForTransaction(
        data.sourceModule,
        data.transactionType,
        data.branchId,
        data
      );

      console.log("[DEBUG] Retrieved GL accounts for transaction:", {
        sourceModule: data.sourceModule,
        transactionType: data.transactionType,
        accounts,
        requiredMappings: ["main", "fee", "revenue", "expense", "asset"],
      });

      const entries = await this.createGLEntriesForTransaction(data, accounts);

      console.log("[DEBUG] Created GL entries:", {
        sourceModule: data.sourceModule,
        transactionType: data.transactionType,
        amount: data.amount,
        fee: data.fee,
        entriesCount: entries.length,
        entries: entries.map((entry) => ({
          accountId: entry.accountId,
          accountCode: entry.accountCode,
          debit: entry.debit,
          credit: entry.credit,
          description: entry.description,
        })),
      });

      const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredits = entries.reduce(
        (sum, entry) => sum + entry.credit,
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          "GL entries do not balance: Debits " +
            totalDebits +
            ", Credits " +
            totalCredits
        );
      }

      await sql`
        INSERT INTO gl_transactions (id, date, source_module, source_transaction_id, source_transaction_type, description, status, created_by, metadata)
        VALUES (${glTransactionId}, CURRENT_DATE, ${
        data.sourceModule
      }, ${validTransactionId}, ${data.transactionType}, ${
        data.reference
      }, 'posted', ${data.processedBy}, ${JSON.stringify(data.metadata || {})})
      `;

      for (const entry of entries) {
        console.log("[DEBUG] Saving GL entry:", {
          accountId: entry.accountId,
          accountCode: entry.accountCode,
          debit: entry.debit,
          credit: entry.credit,
          description: entry.description,
        });
        await sql`
          INSERT INTO gl_journal_entries (id, transaction_id, account_id, account_code, debit, credit, description, metadata)
          VALUES (gen_random_uuid(), ${glTransactionId}, ${entry.accountId}, ${
          entry.accountCode
        }, ${entry.debit}, ${entry.credit}, ${
          entry.description
        }, ${JSON.stringify(entry.metadata || {})})
        `;
        console.log("[DEBUG] GL entry saved successfully");
      }

      await this.updateAccountBalances(entries);

      // CRITICAL FIX: Add Payment Account GL entries if transaction affects it
      // This handles Cash-in-Till, MoMo, or any other payment account
      const paymentAccountId =
        data.metadata?.paymentAccountId || data.metadata?.cashTillAccountId;
      const paymentAccountType =
        data.metadata?.paymentAccountType || "cash-in-till";
      const paymentAffected =
        data.metadata?.paymentAffected || data.metadata?.cashTillAffected || 0;

      if (paymentAccountId && paymentAffected !== 0) {
        console.log(
          `[GL] Adding ${paymentAccountType} GL entries (${
            paymentAffected > 0 ? "Debit" : "Credit"
          }: ${Math.abs(paymentAffected)})`
        );

        // Get payment account GL mapping
        const paymentMapping = await sql`
          SELECT 
            ga.id as gl_account_id,
            ga.code as gl_account_code
          FROM gl_mappings gm
          JOIN gl_accounts ga ON gm.gl_account_id = ga.id
          WHERE gm.float_account_id = ${paymentAccountId}
          AND gm.is_active = true
          AND gm.mapping_type IN ('main', 'asset')
          LIMIT 1
        `;

        if (paymentMapping.length > 0) {
          const paymentGL = paymentMapping[0];

          // Create payment account GL entry
          await sql`
            INSERT INTO gl_journal_entries (
              id, transaction_id, account_id, account_code, debit, credit, description, metadata
            ) VALUES (
              gen_random_uuid(),
              ${glTransactionId},
              ${paymentGL.gl_account_id},
              ${paymentGL.gl_account_code},
              ${paymentAffected > 0 ? paymentAffected : 0},
              ${paymentAffected < 0 ? Math.abs(paymentAffected) : 0},
              ${paymentAccountType.toUpperCase() + " - " + data.reference},
              ${JSON.stringify({
                linkedTo: data.sourceModule,
                transactionId: data.transactionId,
                originalAmount: data.amount,
                paymentMethod: paymentAccountType,
              })}
            )
          `;

          console.log(`[GL] ${paymentAccountType} GL entry created`);
        } else {
          console.warn(
            `⚠️  No GL mapping found for ${paymentAccountType} account ${paymentAccountId}`
          );
        }
      }

      console.log(
        "[GL] GL entries created successfully for " +
          data.sourceModule +
          " transaction: " +
          data.transactionId
      );

      // Helper function to get user's full name
      async function getUserFullName(userId: string): Promise<string> {
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

      const userName = await getUserFullName(data.processedBy);
      await AuditLoggerService.log({
        userId: data.processedBy,
        username: userName,
        actionType: "gl_transaction_create",
        entityType: "gl_transaction",
        entityId: glTransactionId,
        description:
          "GL entries created for " +
          data.sourceModule +
          " " +
          data.transactionType +
          " transaction",
        details: {
          sourceTransactionId: data.transactionId,
          sourceModule: data.sourceModule,
          transactionType: data.transactionType,
          amount: data.amount,
          fee: data.fee,
          entriesCount: entries.length,
        },
        severity: "low",
        branchId: data.branchId,
        branchName: data.branchName || "Unknown Branch",
        status: "success",
      });

      return { success: true, glTransactionId };
    } catch (error) {
      console.error("[GL] Error creating GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private static async getGLAccountsForTransaction(
    sourceModule: string,
    transactionType: string,
    branchId: string,
    data: UnifiedGLTransactionData
  ): Promise<Record<string, any>> {
    try {
      console.log(
        "[DEBUG] Getting GL accounts for transaction:",
        sourceModule,
        transactionType,
        branchId
      );

      // Special handling for float operations with custom entries
      if (sourceModule === "float_operations" && data.metadata?.customEntries) {
        console.log("[DEBUG] Processing float operations with custom entries");

        // Get account codes for the custom entries
        const accountCodes: Record<string, string> = {};
        for (const customEntry of data.metadata.customEntries) {
          const accountCode = await this.getAccountCodeById(
            customEntry.accountId
          );
          if (accountCode) {
            accountCodes[customEntry.accountId] = accountCode;
          }
        }

        return {
          customEntries: data.metadata.customEntries,
          accountCodes: accountCodes,
        };
      }

      // Determine the correct transaction type based on source module and float account
      let actualTransactionType = transactionType;

      // For float-based transactions, we need to use the specific float account type
      if (
        sourceModule === "momo" &&
        ["cash-in", "cash-out"].includes(transactionType)
      ) {
        actualTransactionType = "momo_float";
      } else if (
        sourceModule === "agency_banking" &&
        ["deposit", "withdrawal", "interbank", "interbank_transfer"].includes(
          transactionType
        )
      ) {
        actualTransactionType = "agency_banking_float";
      } else if (
        sourceModule === "e_zwich" &&
        ["withdrawal", "card_issuance"].includes(transactionType)
      ) {
        actualTransactionType = "e_zwich_float";
      } else if (
        sourceModule === "power" &&
        ["sale", "purchase"].includes(transactionType)
      ) {
        actualTransactionType = "power_float";
      } else if (
        sourceModule === "jumia" &&
        ["pod_collection", "settlement"].includes(transactionType)
      ) {
        actualTransactionType = "jumia_float";
      }

      console.log(
        "[DEBUG] Using transaction type for GL mapping:",
        actualTransactionType
      );

      // Get GL mappings for this transaction type with account codes
      const mappings = await sql`
        SELECT 
          gm.mapping_type, 
          gm.gl_account_id, 
          ga.code as gl_account_code
        FROM gl_mappings gm
        JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        WHERE gm.transaction_type = ${actualTransactionType}
          AND gm.branch_id = ${branchId}
          AND gm.is_active = true
      `;

      console.log("[DEBUG] Found GL mappings:", mappings);

      // Get the actual provider from the transaction data
      const actualProvider =
        data.metadata?.provider || data.metadata?.actualProvider;

      // If we have a specific provider, try to find provider-specific mappings
      if (actualProvider && mappings.length > 0) {
        const expectedProviderCode = actualProvider
          .toUpperCase()
          .replace(/\s+/g, "");

        // Filter mappings to find provider-specific ones
        const providerSpecificMappings = mappings.filter((mapping) =>
          mapping.gl_account_code.includes(expectedProviderCode)
        );

        if (providerSpecificMappings.length > 0) {
          console.log(
            `[DEBUG] Found ${providerSpecificMappings.length} provider-specific mappings for '${actualProvider}'`
          );
          return this.formatGLAccounts(providerSpecificMappings);
        } else {
          console.log(
            `[DEBUG] No provider-specific mappings found for '${actualProvider}', will create them`
          );
        }
      }

      // Check if we need to create provider-specific mappings
      let shouldCreateProviderSpecificMappings = false;
      if (actualProvider && mappings.length > 0) {
        const expectedProviderCode = actualProvider
          .toUpperCase()
          .replace(/\s+/g, "");
        const hasCorrectProvider = mappings.some((mapping) =>
          mapping.gl_account_code.includes(expectedProviderCode)
        );

        if (!hasCorrectProvider) {
          console.log(
            `[DEBUG] No mappings found for provider '${actualProvider}', will create provider-specific mappings`
          );
          shouldCreateProviderSpecificMappings = true;
        }
      }

      if (mappings.length === 0 || shouldCreateProviderSpecificMappings) {
        // Try to get default mappings from the main branch
        const defaultMappings = await sql`
          SELECT 
            gm.mapping_type, 
            gm.gl_account_id, 
            ga.code as gl_account_code
          FROM gl_mappings gm
          JOIN gl_accounts ga ON gm.gl_account_id = ga.id
          WHERE gm.transaction_type = ${actualTransactionType}
            AND gm.branch_id = '635844ab-029a-43f8-8523-d7882915266a'
            AND gm.is_active = true
        `;

        if (defaultMappings.length === 0) {
          // If no mappings found, try to create them automatically
          console.log(
            "[DEBUG] No GL mappings found, attempting to create them automatically"
          );

          try {
            const requiredMappings =
              this.getRequiredMappingsForModule(sourceModule);

            await AutoGLMappingService.ensureGLMappings(
              sourceModule,
              actualTransactionType,
              branchId,
              requiredMappings,
              undefined, // floatAccountId
              actualProvider // Pass the actual provider
            );

            // Try to get the mappings again after creation
            const newMappings = await sql`
              SELECT 
                gm.mapping_type, 
                gm.gl_account_id, 
                ga.code as gl_account_code
              FROM gl_mappings gm
              JOIN gl_accounts ga ON gm.gl_account_id = ga.id
              WHERE gm.transaction_type = ${actualTransactionType}
                AND gm.branch_id = ${branchId}
                AND gm.is_active = true
            `;

            console.log(
              "[DEBUG] Successfully created and found GL mappings:",
              newMappings
            );
            return this.formatGLAccounts(newMappings);
          } catch (error) {
            console.error(
              "[DEBUG] Failed to create GL mappings automatically:",
              error
            );
            return {};
          }
        } else {
          // Check if default mappings also use the correct provider
          if (actualProvider) {
            const expectedProviderCode = actualProvider
              .toUpperCase()
              .replace(/\s+/g, "");
            const hasCorrectProvider = defaultMappings.some((mapping) =>
              mapping.gl_account_code.includes(expectedProviderCode)
            );

            if (!hasCorrectProvider) {
              console.log(
                `[DEBUG] Default mappings also don't use correct provider '${actualProvider}', creating new ones`
              );

              try {
                const requiredMappings =
                  this.getRequiredMappingsForModule(sourceModule);

                await AutoGLMappingService.ensureGLMappings(
                  sourceModule,
                  actualTransactionType,
                  branchId,
                  requiredMappings,
                  undefined, // floatAccountId
                  actualProvider // Pass the actual provider
                );

                // Try to get the mappings again after creation
                const newMappings = await sql`
                  SELECT 
                    gm.mapping_type, 
                    gm.gl_account_id, 
                    ga.code as gl_account_code
                  FROM gl_mappings gm
                  JOIN gl_accounts ga ON gm.gl_account_id = ga.id
                  WHERE gm.transaction_type = ${actualTransactionType}
                    AND gm.branch_id = ${branchId}
                    AND gm.is_active = true
                `;

                console.log(
                  "[DEBUG] Successfully created and found GL mappings:",
                  newMappings
                );
                return this.formatGLAccounts(newMappings);
              } catch (error) {
                console.error(
                  "[DEBUG] Failed to create GL mappings automatically:",
                  error
                );
                return {};
              }
            }
          }

          console.log(
            "[DEBUG] Using default mappings from main branch:",
            defaultMappings
          );
          return this.formatGLAccounts(defaultMappings);
        }
      }

      console.log(
        "[DEBUG] Successfully created and found GL mappings:",
        mappings
      );
      return this.formatGLAccounts(mappings);
    } catch (error) {
      console.error(
        "[DEBUG] Error getting GL accounts for transaction:",
        error
      );
      return {};
    }
  }

  private static async getGLAccountIdByCode(
    accountCode: string
  ): Promise<string | null> {
    try {
      const result = await sql`
        SELECT id FROM gl_accounts 
        WHERE account_code = ${accountCode}
        LIMIT 1
      `;
      return result.length > 0 ? result[0].id : null;
    } catch (error) {
      console.error("Error getting GL account ID by code:", error);
      return null;
    }
  }

  private static async getAccountCodeById(
    accountId: string
  ): Promise<string | null> {
    try {
      const result = await sql`
        SELECT code FROM gl_accounts 
        WHERE id = ${accountId}
        LIMIT 1
      `;
      return result.length > 0 ? result[0].code : null;
    } catch (error) {
      console.error("Error getting GL account code by ID:", error);
      return null;
    }
  }

  /**
   * Get required mapping types for a module
   */
  private static getRequiredMappingsForModule(sourceModule: string): string[] {
    switch (sourceModule) {
      case "momo":
        return ["main", "liability", "fee", "revenue"];
      case "agency_banking":
        return ["main", "liability", "fee", "revenue"];
      case "e_zwich":
        return ["main", "liability", "fee", "revenue"];
      case "power":
        return ["main", "liability", "fee", "revenue"];
      case "jumia":
        return ["main", "liability", "fee", "revenue"];
      case "expenses":
        return ["expense", "asset"];
      case "commissions":
        return ["expense", "asset"];
      case "float_transfers":
        return ["main", "asset"];
      case "float_operations":
        return ["main", "revenue", "expense", "asset"];
      default:
        return ["main"];
    }
  }

  private static formatGLAccounts(
    mappings: Array<{
      mapping_type: string;
      gl_account_id: string;
      gl_account_code: string;
    }>
  ): Record<string, any> {
    const accounts: Record<string, any> = {};

    for (const mapping of mappings) {
      accounts[mapping.mapping_type] = mapping.gl_account_id;
      accounts[`${mapping.mapping_type}Code`] = mapping.gl_account_code;
    }

    return accounts;
  }

  private static async createGLEntriesForTransaction(
    data: UnifiedGLTransactionData,
    accounts: Record<string, any>
  ): Promise<
    Array<{
      accountId: string;
      accountCode: string;
      debit: number;
      credit: number;
      description: string;
      metadata?: Record<string, any>;
    }>
  > {
    const entries: Array<{
      accountId: string;
      accountCode: string;
      debit: number;
      credit: number;
      description: string;
      metadata?: Record<string, any>;
    }> = [];

    // Create entries based on transaction type
    switch (data.transactionType) {
      case "initial_balance":
      case "recharge":
      case "balance_adjustment":
      case "transfer":
        // Handle float operations with custom entries (EXCLUDING withdrawal)
        if (
          data.metadata?.customEntries &&
          Array.isArray(data.metadata.customEntries)
        ) {
          // Use the custom entries provided in metadata
          for (const customEntry of data.metadata.customEntries) {
            const accountCode =
              accounts.accountCodes?.[customEntry.accountId] || "";
            entries.push({
              accountId: customEntry.accountId,
              accountCode: accountCode,
              debit: customEntry.debit,
              credit: customEntry.credit,
              description: customEntry.description,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                floatAccountId: data.metadata.floatAccountId,
                operationType: data.metadata.operationType,
              },
            });
          }
        } else {
          // Fallback to default float operation entries
          if (accounts.main && accounts.liability) {
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
              debit: data.amount,
              credit: 0,
              description: `Float ${data.transactionType} - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                floatAccountId: data.metadata?.floatAccountId,
              },
            });

            entries.push({
              accountId: accounts.liability,
              accountCode: accounts.liabilityCode,
              debit: 0,
              credit: data.amount,
              description: `Float ${data.transactionType} Liability - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                floatAccountId: data.metadata?.floatAccountId,
              },
            });
          }
        }
        break;

      case "cash-in":
        // MoMo Cash-In: Customer gives cash, we send MoMo
        // Main account (MoMo float) DECREASES = CREDIT
        // Cash-in-till INCREASES = DEBIT (handled separately)
        if (accounts.main) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `MoMo Cash-In - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          // If liability account exists, debit it (for double-entry)
          if (accounts.liability) {
            entries.push({
              accountId: accounts.liability,
              accountCode: accounts.liabilityCode,
              debit: data.amount,
              credit: 0,
              description: `MoMo Cash-In Liability - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });
          }

          // Fee is handled via cash-in-till GL entries separately
        }
        break;

      case "cash-out":
        // MoMo Cash-Out: Customer gives MoMo, we give cash
        // Main account (MoMo float) INCREASES = DEBIT
        // Cash-in-till DECREASES = CREDIT (handled separately)
        if (accounts.main) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: data.amount,
            credit: 0,
            description: `MoMo Cash-Out - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          // If liability account exists, credit it (for double-entry)
          if (accounts.liability) {
            entries.push({
              accountId: accounts.liability,
              accountCode: accounts.liabilityCode,
              debit: 0,
              credit: data.amount,
              description: `MoMo Cash-Out Liability - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });
          }
        }
        break;

      case "deposit":
        // Agency/MoMo Deposit: Customer gives cash, we send MoMo
        // Main account (MoMo float) DECREASES = CREDIT
        // Cash-in-till INCREASES = DEBIT (handled separately)
        if (accounts.main) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Deposit - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          // If liability account exists, debit it (for double-entry)
          if (accounts.liability) {
            entries.push({
              accountId: accounts.liability,
              accountCode: accounts.liabilityCode,
              debit: data.amount,
              credit: 0,
              description: `Deposit Liability - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });
          }

          // Fee is handled via cash-in-till GL entries separately
        }
        break;

      case "withdrawal":
        // MoMo/Agency Withdrawal: Customer gives MoMo, we give cash
        // Main account (MoMo float) INCREASES = DEBIT
        // Cash-in-till DECREASES = CREDIT (handled separately)
        if (accounts.main) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: data.amount,
            credit: 0,
            description: `Withdrawal - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          // If liability account exists, credit it (for double-entry)
          if (accounts.liability) {
            entries.push({
              accountId: accounts.liability,
              accountCode: accounts.liabilityCode,
              debit: 0,
              credit: data.amount,
              description: `Withdrawal Liability - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });
          }

          // Add fee entry if fee exists (fee increases float)
          if (data.fee > 0 && accounts.fee) {
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
              debit: data.fee,
              credit: 0,
              description: `Fee - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });

            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: 0,
              credit: data.fee,
              description: `Fee Revenue - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });
          }
        }
        break;

      case "transfer":
        // Debit destination, credit source
        if (accounts.main && accounts.asset) {
          entries.push({
            accountId: accounts.asset,
            accountCode: accounts.assetCode,
            debit: data.amount,
            credit: 0,
            description: `Transfer to Asset - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Transfer from Main - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });
        }
        break;

      case "sale":
        // Power Sale: Credit power float (inventory out), debit revenue/cash
        // Power goes OUT of float, so CREDIT the float account
        if (accounts.main && accounts.revenue) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Power Sale - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          entries.push({
            accountId: accounts.revenue,
            accountCode: accounts.revenueCode,
            debit: data.amount,
            credit: 0,
            description: `Power Sale Revenue - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          // Fee is handled separately via cash-in-till GL entries
          // Don't post fee to power float account - it's handled in the main transaction flow
        }
        break;

      case "pod_collection":
        // Jumia POD Collection: Debit main account, credit revenue
        if (accounts.main && accounts.revenue) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: data.amount,
            credit: 0,
            description: `Jumia POD Collection - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          entries.push({
            accountId: accounts.revenue,
            accountCode: accounts.revenueCode,
            debit: 0,
            credit: data.amount,
            description: `Jumia POD Collection Revenue - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          // Add fee entry if fee exists
          if (data.fee > 0 && accounts.fee) {
            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: 0,
              credit: data.fee,
              description: `Fee Revenue - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });

            // Add corresponding debit entry for fee
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
              debit: data.fee,
              credit: 0,
              description: `Fee Debit - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });
          }
        }
        break;

      case "settlement":
        // Jumia Settlement: Debit liability, credit the specific float account used for payment
        if (accounts.liability) {
          // Debit the Jumia liability account
          entries.push({
            accountId: accounts.liability,
            accountCode: accounts.liabilityCode,
            debit: data.amount,
            credit: 0,
            description: `Jumia Settlement Liability - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });

          // Credit the specific float account used for payment
          // Use the payment account from metadata if available, otherwise fall back to main account
          const paymentAccountId = data.metadata?.paymentAccountCode
            ? await this.getGLAccountIdByCode(data.metadata.paymentAccountCode)
            : accounts.main;

          const paymentAccountCode =
            data.metadata?.paymentAccountCode || accounts.mainCode;

          if (paymentAccountId) {
            entries.push({
              accountId: paymentAccountId,
              accountCode: paymentAccountCode,
              debit: 0,
              credit: data.amount,
              description: `Jumia Settlement - ${data.reference} (via ${
                data.metadata?.paymentAccountName || "Float Account"
              })`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
                paymentMethod: data.metadata?.paymentAccountName,
              },
            });
          } else {
            // Fallback to main account if payment account not found
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
              debit: 0,
              credit: data.amount,
              description: `Jumia Settlement - ${data.reference}`,
              metadata: {
                transactionId: data.transactionId,
                sourceModule: data.sourceModule,
                transactionType: data.transactionType,
                customerName: data.customerName,
              },
            });
          }
        }
        break;

      case "float_operations":
        // Float operations: Handle initial balance, recharge, withdrawal, etc.
        if (accounts.main) {
          const operationType =
            data.metadata?.operationType || data.transactionType;

          switch (operationType) {
            case "initial_balance":
              // Initial balance setup: Debit the float account
              entries.push({
                accountId: accounts.main,
                accountCode: accounts.mainCode,
                debit: data.amount,
                credit: 0,
                description: `Initial float balance setup - ${data.reference}`,
                metadata: {
                  transactionId: data.transactionId,
                  sourceModule: data.sourceModule,
                  transactionType: data.transactionType,
                  operationType: "initial_balance",
                  floatAccountId: data.metadata?.floatAccountId,
                },
              });
              break;

            case "recharge":
              // Float recharge: Debit the float account, credit revenue
              entries.push({
                accountId: accounts.main,
                accountCode: accounts.mainCode,
                debit: data.amount,
                credit: 0,
                description: `Float recharge via ${
                  data.metadata?.rechargeMethod || "unknown"
                } - ${data.reference}`,
                metadata: {
                  transactionId: data.transactionId,
                  sourceModule: data.sourceModule,
                  transactionType: data.transactionType,
                  operationType: "recharge",
                  floatAccountId: data.metadata?.floatAccountId,
                  rechargeMethod: data.metadata?.rechargeMethod,
                },
              });

              // Credit revenue account if available
              if (accounts.revenue) {
                entries.push({
                  accountId: accounts.revenue,
                  accountCode: accounts.revenueCode,
                  debit: 0,
                  credit: data.amount,
                  description: `Float recharge revenue - ${data.reference}`,
                  metadata: {
                    transactionId: data.transactionId,
                    sourceModule: data.sourceModule,
                    transactionType: data.transactionType,
                    operationType: "recharge",
                    floatAccountId: data.metadata?.floatAccountId,
                    rechargeMethod: data.metadata?.rechargeMethod,
                  },
                });
              }
              break;

            case "withdrawal":
              // Float withdrawal: Credit the float account, debit expense
              entries.push({
                accountId: accounts.main,
                accountCode: accounts.mainCode,
                debit: 0,
                credit: data.amount,
                description: `Float withdrawal - ${data.reference}`,
                metadata: {
                  transactionId: data.transactionId,
                  sourceModule: data.sourceModule,
                  transactionType: data.transactionType,
                  operationType: "withdrawal",
                  floatAccountId: data.metadata?.floatAccountId,
                },
              });

              // Debit expense account if available
              if (accounts.expense) {
                entries.push({
                  accountId: accounts.expense,
                  accountCode: accounts.expenseCode,
                  debit: data.amount,
                  credit: 0,
                  description: `Float withdrawal expense - ${data.reference}`,
                  metadata: {
                    transactionId: data.transactionId,
                    sourceModule: data.sourceModule,
                    transactionType: data.transactionType,
                    operationType: "withdrawal",
                    floatAccountId: data.metadata?.floatAccountId,
                  },
                });
              }
              break;

            case "transfer":
              // Float transfer: Debit source account, credit destination account
              const sourceAccountId =
                data.metadata?.sourceAccountId || accounts.main;
              const sourceAccountCode =
                data.metadata?.sourceAccountCode || accounts.mainCode;
              const destAccountId = data.metadata?.destinationAccountId;
              const destAccountCode = data.metadata?.destinationAccountCode;

              if (destAccountId && destAccountCode) {
                // Debit source account
                entries.push({
                  accountId: sourceAccountId,
                  accountCode: sourceAccountCode,
                  debit: 0,
                  credit: data.amount,
                  description: `Float transfer from ${
                    data.metadata?.sourceAccountName || "source"
                  } - ${data.reference}`,
                  metadata: {
                    transactionId: data.transactionId,
                    sourceModule: data.sourceModule,
                    transactionType: data.transactionType,
                    operationType: "transfer",
                    sourceAccountId,
                    destinationAccountId: destAccountId,
                  },
                });

                // Credit destination account
                entries.push({
                  accountId: destAccountId,
                  accountCode: destAccountCode,
                  debit: data.amount,
                  credit: 0,
                  description: `Float transfer to ${
                    data.metadata?.destinationAccountName || "destination"
                  } - ${data.reference}`,
                  metadata: {
                    transactionId: data.transactionId,
                    sourceModule: data.sourceModule,
                    transactionType: data.transactionType,
                    operationType: "transfer",
                    sourceAccountId,
                    destinationAccountId: destAccountId,
                  },
                });
              }
              break;

            default:
              // Generic float operation
              entries.push({
                accountId: accounts.main,
                accountCode: accounts.mainCode,
                debit: data.amount > 0 ? data.amount : 0,
                credit: data.amount < 0 ? Math.abs(data.amount) : 0,
                description: `${operationType} - ${data.reference}`,
                metadata: {
                  transactionId: data.transactionId,
                  sourceModule: data.sourceModule,
                  transactionType: data.transactionType,
                  operationType,
                  floatAccountId: data.metadata?.floatAccountId,
                },
              });
              break;
          }
        }
        break;

      default:
        // Generic entry for unknown transaction types
        if (accounts.main) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: data.amount,
            credit: 0,
            description: `${data.transactionType} - ${data.reference}`,
            metadata: {
              transactionId: data.transactionId,
              sourceModule: data.sourceModule,
              transactionType: data.transactionType,
              customerName: data.customerName,
            },
          });
        }
        break;
    }

    return entries;
  }

  private static async updateAccountBalances(
    entries: Array<{ accountId: string; debit: number; credit: number }>
  ): Promise<void> {
    for (const entry of entries) {
      await sql`
        UPDATE gl_accounts 
        SET balance = balance + ${entry.debit - entry.credit}
        WHERE id = ${entry.accountId}
      `;
    }
  }

  static generateReceipt(data: ReceiptData): string {
    const receipt = `
╔══════════════════════════════════════════════════════════════╗
║                    MIMHAAD ERP SYSTEM                        ║
║                    TRANSACTION RECEIPT                       ║
╠══════════════════════════════════════════════════════════════╣
║ Date: ${data.date}                                           ║
║ Transaction ID: ${data.transactionId}                        ║
║ Reference: ${data.reference}                                 ║
║ Branch: ${data.branchName}                                   ║
╠══════════════════════════════════════════════════════════════╣
║ Transaction Details:                                          ║
║   Type: ${data.transactionType}                              ║
║   Amount: ₵${data.amount.toFixed(2)}                         ║
║   Fee: ₵${data.fee.toFixed(2)}                               ║
║   Total: ₵${(data.amount + data.fee).toFixed(2)}             ║
╠══════════════════════════════════════════════════════════════╣
║ Customer: ${data.customerName || "N/A"}                      ║
║ Module: ${data.sourceModule}                                 ║
╠══════════════════════════════════════════════════════════════╣
║                    THANK YOU FOR YOUR BUSINESS               ║
║                    Powered by MIMHAAD ERP                    ║
╚══════════════════════════════════════════════════════════════╝
    `;
    return receipt;
  }

  static printReceipt(data: ReceiptData): void {
    const receipt = this.generateReceipt(data);
    console.log(receipt);
    // In a real application, you would send this to a printer
  }

  static async deleteGLEntries({
    transactionId,
    sourceModule,
  }: {
    transactionId: string;
    sourceModule: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("[GL] Deleting GL entries for transaction:", transactionId);

      // Get the GL transaction ID
      const glTransaction = await sql`
        SELECT id FROM gl_transactions 
        WHERE source_transaction_id = ${transactionId} 
        AND source_module = ${sourceModule}
      `;

      if (glTransaction.length === 0) {
        console.log("[GL] No GL transaction found to delete");
        return { success: true };
      }

      const glTransactionId = glTransaction[0].id;

      // Get journal entries to reverse account balances
      const journalEntries = await sql`
        SELECT account_id, debit, credit FROM gl_journal_entries 
        WHERE transaction_id = ${glTransactionId}
      `;

      // Reverse account balances
      for (const entry of journalEntries) {
        await sql`
          UPDATE gl_accounts 
          SET balance = balance - ${entry.debit - entry.credit}
          WHERE id = ${entry.account_id}
        `;
      }

      // Delete journal entries
      await sql`
        DELETE FROM gl_journal_entries 
        WHERE transaction_id = ${glTransactionId}
      `;

      // Delete GL transaction
      await sql`
        DELETE FROM gl_transactions 
        WHERE id = ${glTransactionId}
      `;

      console.log("[GL] GL entries deleted successfully");
      return { success: true };
    } catch (error) {
      console.error("[GL] Error deleting GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async createCommissionGLEntries({
    transactionId,
    sourceModule,
    transactionType,
    amount,
    fee,
    customerName,
    reference,
    processedBy,
    branchId,
    branchName,
    metadata,
  }: UnifiedGLTransactionData): Promise<{
    success: boolean;
    glTransactionId?: string;
    error?: string;
  }> {
    try {
      console.log(
        "[GL] Creating commission GL entries for transaction:",
        transactionId
      );

      // Check if commission GL entries already exist
      const existingCommission = await sql`
        SELECT id FROM gl_transactions 
        WHERE source_transaction_id = ${transactionId} 
        AND source_module = ${sourceModule}
        AND source_transaction_type = 'commission'
      `;

      if (existingCommission.length > 0) {
        console.log(
          "[GL] Commission GL entries already exist for transaction:",
          transactionId
        );
        return { success: true, glTransactionId: existingCommission[0].id };
      }

      const glTransactionIdResult = await sql`SELECT gen_random_uuid() as id`;
      const glTransactionId = glTransactionIdResult[0].id;

      // Get GL accounts for commission posting
      const accounts = await this.getGLAccountsForTransaction(
        sourceModule,
        transactionType,
        branchId,
        {
          transactionId,
          sourceModule,
          transactionType,
          amount,
          fee,
          customerName,
          reference,
          processedBy,
          branchId,
          branchName,
          metadata,
        }
      );

      console.log(`[GL] Commission accounts:`, accounts);

      // Validate that we have the required accounts
      // For commissions: asset = receivable, expense = commission expense
      if (!accounts.asset && !accounts.expense) {
        throw new Error(
          `No commission accounts found for GL posting. Available accounts: ${Object.keys(
            accounts
          ).join(", ")}`
        );
      }

      // Commission GL entries:
      // Debit: Commission Expense (cost to company)
      // Credit: Commission Payable/Receivable (liability/asset - money owed to agents)
      const expenseAccountId = accounts.expense;
      const expenseAccountCode = accounts.expenseCode;
      const assetAccountId = accounts.asset;
      const assetAccountCode = accounts.assetCode;

      const entries = [
        {
          accountId: expenseAccountId,
          accountCode: expenseAccountCode,
          debit: amount,
          credit: 0,
          description: `Commission Expense - ${reference}`,
          metadata: {
            transactionId,
            source: metadata?.source || "Unknown",
            sourceName: metadata?.sourceName || "Unknown Partner",
            month: metadata?.month || "",
            status: metadata?.status || "pending",
            originalTransactionType: transactionType,
          },
        },
        {
          accountId: assetAccountId,
          accountCode: assetAccountCode,
          debit: 0,
          credit: amount,
          description: `Commission Payable - ${reference}`,
          metadata: {
            transactionId,
            source: metadata?.source || "Unknown",
            sourceName: metadata?.sourceName || "Unknown Partner",
            month: metadata?.month || "",
            status: metadata?.status || "pending",
            originalTransactionType: transactionType,
          },
        },
      ];

      // Verify entries balance
      const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredits = entries.reduce(
        (sum, entry) => sum + entry.credit,
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          "Commission GL entries do not balance: Debits " +
            totalDebits +
            ", Credits " +
            totalCredits
        );
      }

      // Create GL transaction record
      await sql`
        INSERT INTO gl_transactions (id, date, source_module, source_transaction_id, source_transaction_type, description, status, created_by, metadata)
        VALUES (${glTransactionId}, CURRENT_DATE, ${sourceModule}, ${transactionId}, 'commission', ${`Commission - ${reference}`}, 'posted', ${processedBy}, ${JSON.stringify(
        metadata || {}
      )})
      `;

      // Create journal entries
      for (const entry of entries) {
        await sql`
          INSERT INTO gl_journal_entries (id, transaction_id, account_id, account_code, debit, credit, description, metadata)
          VALUES (gen_random_uuid(), ${glTransactionId}, ${entry.accountId}, ${
          entry.accountCode
        }, ${entry.debit}, ${entry.credit}, ${
          entry.description
        }, ${JSON.stringify(entry.metadata || {})})
        `;
      }

      // Update account balances
      await this.updateAccountBalances(entries);

      console.log(
        "[GL] Commission GL entries created successfully for transaction:",
        transactionId
      );

      // Log audit trail
      await AuditLoggerService.log({
        userId: processedBy,
        username: processedBy,
        actionType: "gl_transaction_create",
        entityType: "gl_transaction",
        entityId: glTransactionId,
        description: `Commission GL entries created for ${sourceModule} transaction`,
        details: {
          sourceTransactionId: transactionId,
          sourceModule,
          transactionType: "commission",
          amount,
          fee,
          entriesCount: entries.length,
        },
        severity: "low",
        branchId,
        branchName: branchName || "Unknown Branch",
        status: "success",
      });

      return { success: true, glTransactionId };
    } catch (error) {
      console.error("[GL] Error creating commission GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async createInventoryPurchaseGLEntries({
    transactionId,
    sourceModule,
    transactionType,
    amount,
    fee,
    customerName,
    reference,
    processedBy,
    branchId,
    branchName,
    metadata,
  }: UnifiedGLTransactionData): Promise<{
    success: boolean;
    glTransactionId?: string;
    error?: string;
  }> {
    try {
      console.log(
        "[GL] Creating inventory purchase GL entries for transaction:",
        transactionId
      );

      // Check if inventory purchase GL entries already exist
      const existingInventory = await sql`
        SELECT id FROM gl_transactions 
        WHERE source_transaction_id = ${transactionId} 
        AND source_module = ${sourceModule}
        AND source_transaction_type = 'inventory_purchase'
      `;

      if (existingInventory.length > 0) {
        console.log(
          "[GL] Inventory purchase GL entries already exist for transaction:",
          transactionId
        );
        return { success: true, glTransactionId: existingInventory[0].id };
      }

      const glTransactionIdResult = await sql`SELECT gen_random_uuid() as id`;
      const glTransactionId = glTransactionIdResult[0].id;

      // Get GL accounts for inventory purchase posting
      const accounts = await this.getGLAccountsForTransaction(
        sourceModule,
        transactionType,
        branchId,
        {
          transactionId,
          sourceModule,
          transactionType,
          amount,
          fee,
          customerName,
          reference,
          processedBy,
          branchId,
          branchName,
          metadata,
        }
      );

      console.log(`[GL] Inventory purchase accounts:`, accounts);

      // Validate that we have the required accounts
      if (!accounts.main) {
        throw new Error(
          `No main account found for inventory purchase GL posting. Available accounts: ${Object.keys(
            accounts
          ).join(", ")}`
        );
      }

      // Create inventory purchase entries - debit inventory, credit main account
      const entries = [
        {
          accountId: accounts.inventory || accounts.expense || accounts.main,
          accountCode:
            accounts.inventoryCode || accounts.expenseCode || accounts.mainCode,
          debit: amount,
          credit: 0,
          description: `Inventory Purchase - ${reference}`,
          metadata: {
            transactionId,
            batch_code: metadata?.batch_code,
            quantity: metadata?.quantity,
            unit_cost: metadata?.unit_cost,
            partner_bank_id: metadata?.partner_bank_id,
            partner_bank_name: metadata?.partner_bank_name,
            originalTransactionType: transactionType,
          },
        },
        {
          accountId: accounts.main,
          accountCode: accounts.mainCode,
          debit: 0,
          credit: amount,
          description: `Payment for Inventory - ${reference}`,
          metadata: {
            transactionId,
            batch_code: metadata?.batch_code,
            quantity: metadata?.quantity,
            unit_cost: metadata?.unit_cost,
            partner_bank_id: metadata?.partner_bank_id,
            partner_bank_name: metadata?.partner_bank_name,
            originalTransactionType: transactionType,
          },
        },
      ];

      // Verify entries balance
      const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredits = entries.reduce(
        (sum, entry) => sum + entry.credit,
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          "Inventory purchase GL entries do not balance: Debits " +
            totalDebits +
            ", Credits " +
            totalCredits
        );
      }

      // Create GL transaction record
      await sql`
        INSERT INTO gl_transactions (id, date, source_module, source_transaction_id, source_transaction_type, description, status, created_by, metadata)
        VALUES (${glTransactionId}, CURRENT_DATE, ${sourceModule}, ${transactionId}, 'inventory_purchase', ${`Inventory Purchase - ${reference}`}, 'posted', ${processedBy}, ${JSON.stringify(
        metadata || {}
      )})
      `;

      // Create journal entries
      for (const entry of entries) {
        await sql`
          INSERT INTO gl_journal_entries (id, transaction_id, account_id, account_code, debit, credit, description, metadata)
          VALUES (gen_random_uuid(), ${glTransactionId}, ${entry.accountId}, ${
          entry.accountCode
        }, ${entry.debit}, ${entry.credit}, ${
          entry.description
        }, ${JSON.stringify(entry.metadata || {})})
        `;
      }

      // Update account balances
      await this.updateAccountBalances(entries);

      console.log(
        "[GL] Inventory purchase GL entries created successfully for transaction:",
        transactionId
      );

      // Log audit trail
      await AuditLoggerService.log({
        userId: processedBy,
        username: processedBy,
        actionType: "gl_transaction_create",
        entityType: "gl_transaction",
        entityId: glTransactionId,
        description: `Inventory purchase GL entries created for ${sourceModule} transaction`,
        details: {
          sourceTransactionId: transactionId,
          sourceModule,
          transactionType: "inventory_purchase",
          amount,
          fee,
          entriesCount: entries.length,
        },
        severity: "low",
        branchId,
        branchName: branchName || "Unknown Branch",
        status: "success",
      });

      return { success: true, glTransactionId };
    } catch (error) {
      console.error(
        "[GL] Error creating inventory purchase GL entries:",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create reversal GL entries for a transaction
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
      // Helper function to get user's full name
      async function getUserFullName(userId: string): Promise<string> {
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

      console.log(
        "[GL] Creating reversal GL entries for " +
          sourceModule +
          " transaction:",
        transactionId
      );

      // Check if reversal GL entries already exist for this transaction
      const existingTransaction = await sql`
        SELECT id FROM gl_transactions 
        WHERE source_transaction_id = ${transactionId} 
        AND source_module = ${sourceModule}
        AND source_transaction_type LIKE 'reversal_%'
      `;

      if (existingTransaction.length > 0) {
        console.log(
          "[GL] Reversal GL entries already exist for " +
            sourceModule +
            " transaction " +
            transactionId
        );
        return { success: true, glTransactionId: existingTransaction[0].id };
      }

      const glTransactionIdResult = await sql`SELECT gen_random_uuid() as id`;
      const glTransactionId = glTransactionIdResult[0].id;

      // Get GL accounts for the original transaction type
      const accounts = await this.getGLAccountsForTransaction(
        sourceModule,
        transactionType,
        branchId,
        {
          transactionId,
          sourceModule,
          transactionType,
          amount,
          fee,
          customerName,
          reference,
          processedBy,
          branchId,
          branchName,
          metadata,
        }
      );

      console.log("[DEBUG] Retrieved GL accounts for reversal:", {
        sourceModule,
        transactionType,
        accounts,
      });

      // Create reversal entries by swapping debits and credits
      const entries = await this.createReversalGLEntriesForTransaction(
        {
          transactionId,
          sourceModule,
          transactionType,
          amount,
          fee,
          customerName,
          reference,
          processedBy,
          branchId,
          branchName,
          metadata: { ...metadata, reason, reversalOf: transactionId },
        },
        accounts
      );

      console.log("[DEBUG] Created reversal GL entries:", {
        sourceModule,
        transactionType,
        amount,
        fee,
        entriesCount: entries.length,
        entries: entries.map((entry) => ({
          accountId: entry.accountId,
          accountCode: entry.accountCode,
          debit: entry.debit,
          credit: entry.credit,
          description: entry.description,
        })),
      });

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
        INSERT INTO gl_transactions (id, date, source_module, source_transaction_id, source_transaction_type, description, status, created_by, metadata)
        VALUES (${glTransactionId}, CURRENT_DATE, ${sourceModule}, ${transactionId}, ${`reversal_${transactionType}`}, ${`Reversal: ${reference} - ${reason}`}, 'posted', ${processedBy}, ${JSON.stringify(
        { ...metadata, reason, reversalOf: transactionId }
      )})
      `;

      // Create GL journal entries
      for (const entry of entries) {
        // Skip zero-value entries
        if (entry.debit === 0 && entry.credit === 0) continue;

        console.log("[DEBUG] Saving reversal GL entry:", {
          accountId: entry.accountId,
          accountCode: entry.accountCode,
          debit: entry.debit,
          credit: entry.credit,
          description: entry.description,
        });

        await sql`
          INSERT INTO gl_journal_entries (id, transaction_id, account_id, account_code, debit, credit, description, metadata)
          VALUES (gen_random_uuid(), ${glTransactionId}, ${entry.accountId}, ${
          entry.accountCode
        }, ${entry.debit}, ${entry.credit}, ${
          entry.description
        }, ${JSON.stringify(entry.metadata || {})})
        `;
        console.log("[DEBUG] Reversal GL entry saved successfully");
      }

      // Update account balances
      await this.updateAccountBalances(entries);

      // Log audit entry
      const userName = await getUserFullName(processedBy);
      await AuditLoggerService.log({
        userId: processedBy,
        username: userName,
        actionType: "gl_transaction_reversal",
        entityType: "gl_transaction",
        entityId: glTransactionId,
        description: `GL reversal entries created for ${sourceModule} transaction ${transactionId} - ${reason}`,
        details: {
          originalTransactionId: transactionId,
          reason,
          amount,
          fee,
          entriesCount: entries.length,
        },
        severity: "low",
        branchId,
        branchName: branchName || "Unknown Branch",
        status: "success",
      });

      console.log(
        "[GL] Reversal GL entries created successfully for " +
          sourceModule +
          " transaction: " +
          transactionId
      );

      return { success: true, glTransactionId };
    } catch (error) {
      console.error("[GL] Error creating reversal GL entries:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create reversal GL entries for a transaction by swapping debits and credits
   */
  private static async createReversalGLEntriesForTransaction(
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
  ): Promise<
    Array<{
      accountId: string;
      accountCode: string;
      debit: number;
      credit: number;
      description: string;
      metadata?: Record<string, any>;
    }>
  > {
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
            accountId: accounts.revenue,
            accountCode: accounts.revenueCode,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Revenue for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse main account entry
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
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
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse revenue entry
          entries.push({
            accountId: accounts.revenue,
            accountCode: accounts.revenueCode,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Revenue for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
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
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse liability entry
          entries.push({
            accountId: accounts.liability,
            accountCode: accounts.liabilityCode,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Liability for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
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
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse asset entry
          entries.push({
            accountId: accounts.asset,
            accountCode: accounts.assetCode,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Asset for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
              debit: 0,
              credit: data.fee,
              description: `Reversal: Fee debit for ${data.reference}`,
              metadata: data.metadata,
            });
          }
        }
        break;

      case "sale":
        // Original: Main debit, Revenue credit, Fee credit, Main debit
        // Reversal: Main credit, Revenue debit, Fee debit, Main credit
        if (accounts.main && accounts.revenue) {
          // Reverse main account entry
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse revenue entry
          entries.push({
            accountId: accounts.revenue,
            accountCode: accounts.revenueCode,
            debit: data.amount,
            credit: 0,
            description: `Reversal: Revenue for ${data.reference}`,
            metadata: data.metadata,
          });

          // Reverse fee entries if fee exists
          if (data.fee > 0 && accounts.fee) {
            // Reverse fee revenue entry
            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee revenue for ${data.reference}`,
              metadata: data.metadata,
            });

            // Reverse fee debit entry
            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
              debit: 0,
              credit: data.fee,
              description: `Reversal: Fee debit for ${data.reference}`,
              metadata: data.metadata,
            });
          }
        }
        break;

      default:
        // For other transaction types, create generic reversal entries
        if (accounts.main) {
          entries.push({
            accountId: accounts.main,
            accountCode: accounts.mainCode,
            debit: 0,
            credit: data.amount,
            description: `Reversal: Main account for ${data.reference}`,
            metadata: data.metadata,
          });

          if (accounts.revenue) {
            entries.push({
              accountId: accounts.revenue,
              accountCode: accounts.revenueCode,
              debit: data.amount,
              credit: 0,
              description: `Reversal: Revenue for ${data.reference}`,
              metadata: data.metadata,
            });
          }

          if (data.fee > 0 && accounts.fee) {
            entries.push({
              accountId: accounts.fee,
              accountCode: accounts.feeCode,
              debit: data.fee,
              credit: 0,
              description: `Reversal: Fee for ${data.reference}`,
              metadata: data.metadata,
            });

            entries.push({
              accountId: accounts.main,
              accountCode: accounts.mainCode,
              debit: 0,
              credit: data.fee,
              description: `Reversal: Fee debit for ${data.reference}`,
              metadata: data.metadata,
            });
          }
        }
        break;
    }

    return entries;
  }
}
