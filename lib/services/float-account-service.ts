import { neon } from "@neondatabase/serverless";
import { AutoGLMappingService } from "./auto-gl-mapping-service";
import { BranchStaffService } from "./branch-staff-service";

const sql = neon(process.env.DATABASE_URL!);

export interface FloatAccount {
  id: string;
  branch_id: string;
  account_type:
    | "cash-in-till"
    | "momo"
    | "agency-banking"
    | "e-zwich"
    | "power"
    | "jumia";
  provider?: string; // For power (NEDCo, ECG), momo (MTN, Telecel, etc.)
  account_number: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_updated?: string; // Optional since it's derived from updated_at
  isezwichpartner?: boolean; // Optional since column doesn't exist in table
  name?: string; // Optional since it's generated
}

export class FloatAccountService {
  /**
   * Create a float account and automatically create GL mappings
   */
  static async createFloatAccount(data: {
    branch_id: string;
    account_type:
      | "cash-in-till"
      | "momo"
      | "agency-banking"
      | "e-zwich"
      | "power"
      | "jumia";
    provider?: string;
    account_number: string;
    initial_balance?: number;
    userId?: string; // Add userId parameter
  }): Promise<FloatAccount> {
    try {
      console.log("💰 [FLOAT] Creating float account:", data);

      // Normalize account type for database (convert hyphens to underscores)
      const normalizedAccountType = data.account_type.replace(/-/g, "_");

      // Check if isezwichpartner column exists
      let hasIsezwichpartner = false;
      try {
        const columnCheck = await sql`
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'float_accounts' 
            AND column_name = 'isezwichpartner'
          ) as exists
        `;

        hasIsezwichpartner = columnCheck[0]?.exists || false;
      } catch (error) {
        console.warn(
          "Could not check isezwichpartner column, assuming it doesn't exist:",
          error
        );
        hasIsezwichpartner = false;
      }

      // Create the float account with conditional columns
      let result;
      if (hasIsezwichpartner) {
        result = await sql`
          INSERT INTO float_accounts (
            id,
            branch_id,
            account_type,
            provider,
            account_number,
            current_balance,
            min_threshold,
            max_threshold,
            is_active,
            created_by,
            created_at,
            updated_at,
            isezwichpartner
          ) VALUES (
            gen_random_uuid(),
            ${data.branch_id},
            ${
              data.account_type
            }, -- Keep original hyphenated format for database
            ${data.provider || null},
            ${data.account_number},
            ${data.initial_balance || 0},
            0,
            1000000,
            true,
            'system',
            NOW(),
            NOW(),
            false
          ) RETURNING *
        `;
      } else {
        result = await sql`
          INSERT INTO float_accounts (
            id,
            branch_id,
            account_type,
            provider,
            account_number,
            current_balance,
            min_threshold,
            max_threshold,
            is_active,
            created_by,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            ${data.branch_id},
            ${
              data.account_type
            }, -- Keep original hyphenated format for database
            ${data.provider || null},
            ${data.account_number},
            ${data.initial_balance || 0},
            0,
            1000000,
            true,
            'system',
            NOW(),
            NOW()
          ) RETURNING *
        `;
      }

      const floatAccount = result[0];

      console.log("✅ [FLOAT] Float account created:", floatAccount.id);

      // Create GL accounts and mappings using AutoGLMappingService
      try {
        const module = this.getModuleFromAccountType(floatAccount.account_type);
        const transactionType = `${floatAccount.account_type.replace(
          /-/g,
          "_"
        )}_float`;
        const requiredMappings = this.getRequiredMappingsForAccountType(
          floatAccount.account_type
        );

        await AutoGLMappingService.ensureGLMappings(
          module,
          transactionType,
          floatAccount.branch_id,
          requiredMappings,
          floatAccount.id, // Pass the float account ID
          floatAccount.provider // Pass the actual provider
        );
        console.log("✅ [FLOAT] GL accounts and mappings created successfully");

        // Create GL entries for initial balance if provided
        if (data.initial_balance && data.initial_balance > 0) {
          try {
            const { FloatAccountGLService } = await import(
              "./float-account-gl-service"
            );
            const glResult =
              await FloatAccountGLService.createInitialBalanceGLEntries(
                floatAccount.id,
                data.initial_balance,
                data.userId || "system", // processedBy
                floatAccount.branch_id
              );

            if (glResult.success) {
              console.log("✅ [FLOAT] GL entries created for initial balance");
            } else {
              console.warn(
                "⚠️ [FLOAT] Failed to create GL entries for initial balance:",
                glResult.error
              );
            }
          } catch (glEntryError) {
            console.error(
              "❌ [FLOAT] Failed to create GL entries for initial balance:",
              glEntryError
            );
            // Don't fail the entire operation for GL entry issues
          }
        }
      } catch (glError) {
        console.error(
          "❌ [FLOAT] Failed to create GL accounts/mappings:",
          glError
        );
        // Don't fail the entire operation for GL mapping issues
      }

      // Update branch staff count
      try {
        await BranchStaffService.updateBranchStaffCount(data.branch_id);
      } catch (error) {
        console.warn("⚠️ [FLOAT] Failed to update branch staff count:", error);
      }

      return {
        id: floatAccount.id,
        branch_id: floatAccount.branch_id,
        account_type: floatAccount.account_type,
        provider: floatAccount.provider,
        account_number: floatAccount.account_number,
        current_balance: Number(floatAccount.current_balance),
        min_threshold: Number(floatAccount.min_threshold),
        max_threshold: Number(floatAccount.max_threshold),
        is_active: floatAccount.is_active,
        created_by: floatAccount.created_by,
        created_at: floatAccount.created_at,
        updated_at: floatAccount.updated_at,
        last_updated: floatAccount.updated_at, // Use updated_at as last_updated
        isezwichpartner: hasIsezwichpartner
          ? floatAccount.isezwichpartner
          : false, // Use actual value if column exists, otherwise default
        name: `${data.account_type
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())} Account`, // Generate name
      };
    } catch (error) {
      console.error("❌ [FLOAT] Error creating float account:", error);
      throw new Error("Failed to create float account");
    }
  }

  /**
   * Create reversal GL mappings for a float account using AutoGLMappingService
   */
  private static async createReversalGLMappingsForFloatAccount(
    floatAccount: any,
    existingMappings: Record<string, string>
  ): Promise<void> {
    const module = this.getModuleFromAccountType(floatAccount.account_type);
    const transactionType = `${floatAccount.account_type.replace(
      /-/g,
      "_"
    )}_float`;

    try {
      await AutoGLMappingService.ensureReversalMappings(
        module,
        transactionType,
        floatAccount.branch_id,
        existingMappings,
        floatAccount.id // Pass the float account ID
      );

      console.log(
        `✅ [FLOAT] Created reversal mappings for ${floatAccount.account_type}`
      );
    } catch (error) {
      console.warn(
        `⚠️ [FLOAT] Failed to create reversal mappings for ${floatAccount.account_type}:`,
        error
      );
      // Don't throw error for reversal mappings - they're not critical
    }
  }

  /**
   * Get reversal transaction types for a given account type
   */
  private static getReversalTransactionTypes(accountType: string): string[] {
    switch (accountType) {
      case "momo":
        return [
          "reversal_cash-in",
          "reversal_cash-out",
          "reversal_deposit",
          "reversal_withdrawal",
        ];
      case "agency_banking":
        return ["reversal_deposit", "reversal_withdrawal"];
      case "e_zwich":
        return ["reversal_card_issuance", "reversal_withdrawal"];
      case "power":
        return ["reversal_purchase", "reversal_payment"];
      case "jumia":
        return ["reversal_purchase", "reversal_payment"];
      case "cash_till":
        return ["reversal_cash-in", "reversal_cash-out"];
      default:
        return ["reversal_deposit", "reversal_withdrawal"];
    }
  }

  private static generateGLAccountName(
    floatAccount: any,
    type: string,
    mapping: string
  ): string {
    // Handle undefined account_type
    if (!floatAccount.account_type) {
      return `Unknown Float Account${
        floatAccount.provider ? ` - ${floatAccount.provider}` : ""
      }`;
    }

    const provider = floatAccount.provider ? ` - ${floatAccount.provider}` : "";
    const accountType = this.prettyType(floatAccount.account_type);

    switch (mapping) {
      case "main":
        return `${accountType} Float Account${provider}`;
      case "revenue":
        return `${accountType} Fee Revenue${provider}`; // For fee income from transactions
      case "expense":
        return `${accountType} Fee Expense${provider}`; // For fee expenses (net effect with revenue)
      case "commission":
        return `${accountType} Commission Revenue${provider}`; // For commission income
      case "fee":
        return `${accountType} Transaction Fees${provider}`; // For transaction fee tracking
      default:
        return `${accountType} GL Account${provider}`;
    }
  }

  private static prettyType(type: string): string {
    switch (type) {
      case "cash-in-till":
      case "cash_till":
        return "Cash in Till";
      case "momo":
        return "MoMo";
      case "agency-banking":
      case "agency_banking":
        return "Agency Banking";
      case "e-zwich":
      case "e_zwich":
        return "E-Zwich";
      case "power":
        return "Power";
      case "jumia":
        return "Jumia";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  /**
   * Create GL account for float account
   */
  private static async createGLAccountForFloatAccount(
    floatAccount: any,
    glAccountCode: string,
    glAccountName: string
  ): Promise<any> {
    const glAccount = await sql`
      INSERT INTO gl_accounts (
        id,
        code,
        name,
        type,
        branch_id,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        ${glAccountCode},
        ${glAccountName},
        'Asset',
        ${floatAccount.branch_id},
        true,
        NOW(),
        NOW()
      ) RETURNING *
    `;

    return glAccount[0];
  }

  /**
   * Generate GL account code for float account
   */
  private static generateGLAccountCode(floatAccount: any): string {
    const branchCode = floatAccount.branch_id.substring(0, 6);

    switch (floatAccount.account_type) {
      case "cash_till":
        return `CASH-${branchCode}`;
      case "momo":
        return `MOMO-${branchCode}-${
          floatAccount.provider?.toUpperCase() || "GEN"
        }`;
      case "agency_banking":
        return `AGB-${branchCode}-${
          floatAccount.provider?.toUpperCase() || "GEN"
        }`;
      case "e_zwich":
        return `EZWICH-${branchCode}`;
      case "power":
        return `PWR-${branchCode}-${
          floatAccount.provider?.toUpperCase() || "GEN"
        }`;
      case "jumia":
        return `JUMIA-${branchCode}`;
      default:
        return `FLOAT-${branchCode}-${floatAccount.account_type.toUpperCase()}`;
    }
  }

  /**
   * Create GL mappings for a float account
   */
  private static async createGLMappingsForFloatAccount(
    floatAccount: any,
    glAccountId: string
  ): Promise<void> {
    const mappings = this.getRequiredMappingsForAccountType(
      floatAccount.account_type,
      glAccountId,
      floatAccount.id
    );

    for (const mapping of mappings) {
      await sql`
        INSERT INTO gl_mappings (
          id,
          branch_id,
          transaction_type,
          gl_account_id,
          float_account_id,
          mapping_type,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          ${floatAccount.branch_id},
          ${mapping.transaction_type},
          ${mapping.gl_account_id},
          ${mapping.float_account_id},
          ${mapping.mapping_type},
          true,
          NOW(),
          NOW()
        )
      `;
    }
  }

  /**
   * Get module name from account type
   */
  private static getModuleFromAccountType(accountType: string): string {
    switch (accountType) {
      case "momo":
        return "momo";
      case "agency-banking":
        return "agency_banking";
      case "e-zwich":
        return "e_zwich";
      case "power":
        return "power";
      case "jumia":
        return "jumia";
      case "cash-in-till":
        return "cash_till";
      default:
        return accountType.replace(/-/g, "_");
    }
  }

  /**
   * Get required mapping types for an account type
   */
  private static getRequiredMappingsForAccountType(
    accountType: string
  ): string[] {
    switch (accountType) {
      case "momo":
      case "agency-banking":
      case "e-zwich":
        return ["main", "liability", "fee", "revenue", "expense"];
      case "power":
      case "jumia":
        return ["main", "revenue", "fee", "expense"];
      case "cash-in-till":
        return ["main"];
      default:
        return ["main"];
    }
  }

  /**
   * Get required GL mappings for an account type (legacy method)
   */
  private static getRequiredMappingsForAccountTypeLegacy(
    accountType: string,
    glAccountId: string,
    floatAccountId: string
  ): Array<{
    transaction_type: string;
    gl_account_id: string;
    float_account_id: string;
    mapping_type: string;
  }> {
    const mappings = [];

    switch (accountType) {
      case "cash_till":
        // Cash in Till mappings
        mappings.push({
          transaction_type: "cash_in_till",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "main",
        });
        break;

      case "momo":
        // MoMo mappings
        mappings.push({
          transaction_type: "momo_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "main",
        });
        mappings.push({
          transaction_type: "momo_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "float",
        });
        mappings.push({
          transaction_type: "momo_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "asset",
        });
        break;

      case "agency_banking":
        // Agency Banking mappings
        mappings.push({
          transaction_type: "agency_banking_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "main",
        });
        mappings.push({
          transaction_type: "agency_banking_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "float",
        });
        mappings.push({
          transaction_type: "agency_banking_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "asset",
        });
        break;

      case "e_zwich":
        // E-Zwich mappings
        mappings.push({
          transaction_type: "e_zwich_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "main",
        });
        mappings.push({
          transaction_type: "e_zwich_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "float",
        });
        mappings.push({
          transaction_type: "e_zwich_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "asset",
        });
        break;

      case "power":
        // Power mappings
        mappings.push({
          transaction_type: "power_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "main",
        });
        mappings.push({
          transaction_type: "power_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "float",
        });
        mappings.push({
          transaction_type: "power_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "asset",
        });
        break;

      case "jumia":
        // Jumia mappings
        mappings.push({
          transaction_type: "jumia_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "main",
        });
        mappings.push({
          transaction_type: "jumia_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "float",
        });
        mappings.push({
          transaction_type: "jumia_float",
          gl_account_id: glAccountId,
          float_account_id: floatAccountId,
          mapping_type: "asset",
        });
        break;
    }

    return mappings;
  }

  /**
   * Get float account by ID
   */
  static async getFloatAccountById(id: string): Promise<FloatAccount | null> {
    const result = await sql`
      SELECT * FROM float_accounts WHERE id = ${id} AND is_active = true
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      branch_id: row.branch_id,
      account_type: row.account_type,
      provider: row.provider,
      account_number: row.account_number,
      current_balance: Number(row.current_balance),
      min_threshold: Number(row.min_threshold),
      max_threshold: Number(row.max_threshold),
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_updated: row.updated_at, // Use updated_at as last_updated
      isezwichpartner: row.isezwichpartner || false, // Handle case where column doesn't exist
      name:
        row.name ||
        `${row.account_type
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())} Account`, // Generate name if not exists
    };
  }

  /**
   * Get float accounts for a branch
   */
  static async getFloatAccountsByBranch(
    branchId: string
  ): Promise<FloatAccount[]> {
    const result = await sql`
      SELECT * FROM float_accounts 
      WHERE branch_id = ${branchId} AND is_active = true
      ORDER BY account_type, provider, created_at
    `;

    return result.map((row) => ({
      id: row.id,
      branch_id: row.branch_id,
      account_type: row.account_type,
      provider: row.provider,
      account_number: row.account_number,
      current_balance: Number(row.current_balance),
      min_threshold: Number(row.min_threshold),
      max_threshold: Number(row.max_threshold),
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_updated: row.updated_at, // Use updated_at as last_updated
      isezwichpartner: row.isezwichpartner || false, // Handle case where column doesn't exist
      name:
        row.name ||
        `${row.account_type
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())} Account`, // Generate name if not exists
    }));
  }

  /**
   * Update float account balance
   */
  static async updateFloatAccountBalance(
    id: string,
    newBalance: number
  ): Promise<void> {
    await sql`
      UPDATE float_accounts 
      SET current_balance = ${newBalance}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  /**
   * Deactivate float account and clean up associated GL accounts and mappings
   */
  static async deactivateFloatAccount(id: string): Promise<void> {
    try {
      console.log(
        "🗑️ [FLOAT] Deactivating float account and cleaning up GL resources:",
        id
      );

      // Get the float account details before deactivation
      const floatAccount = await sql`
        SELECT * FROM float_accounts WHERE id = ${id}
      `;

      if (floatAccount.length === 0) {
        throw new Error("Float account not found");
      }

      const account = floatAccount[0];
      const transactionType = `${account.account_type.replace(
        /-/g,
        "_"
      )}_float`;

      console.log(
        `🗑️ [FLOAT] Cleaning up GL resources for ${account.account_type} (${transactionType})`
      );

      // 1. Deactivate the float account
      await sql`
        UPDATE float_accounts 
        SET is_active = false, updated_at = NOW()
        WHERE id = ${id}
      `;

      // 2. Deactivate GL mappings associated with this float account type
      await sql`
        UPDATE gl_mappings 
        SET is_active = false, updated_at = NOW()
        WHERE transaction_type = ${transactionType}
          AND branch_id = ${account.branch_id}
      `;

      console.log(
        `🗑️ [FLOAT] Deactivated GL mappings for transaction type: ${transactionType}`
      );

      // 3. Get the GL account IDs that were used by this float account type
      const glAccounts = await sql`
        SELECT DISTINCT gl_account_id 
        FROM gl_mappings 
        WHERE transaction_type = ${transactionType}
          AND branch_id = ${account.branch_id}
          AND is_active = false
      `;

      // 4. Check if these GL accounts are used by other active mappings
      for (const glAccount of glAccounts) {
        const otherMappings = await sql`
          SELECT COUNT(*) as count
          FROM gl_mappings 
          WHERE gl_account_id = ${glAccount.gl_account_id}
            AND is_active = true
        `;

        // If no other active mappings use this GL account, deactivate it
        if (otherMappings[0].count === 0) {
          await sql`
            UPDATE gl_accounts 
            SET is_active = false, updated_at = NOW()
            WHERE id = ${glAccount.gl_account_id}
          `;
          console.log(
            `🗑️ [FLOAT] Deactivated GL account: ${glAccount.gl_account_id}`
          );
        } else {
          console.log(
            `ℹ️ [FLOAT] GL account ${glAccount.gl_account_id} still in use by other mappings, keeping active`
          );
        }
      }

      console.log(
        `✅ [FLOAT] Successfully deactivated float account and cleaned up GL resources: ${id}`
      );
    } catch (error) {
      console.error("❌ [FLOAT] Error deactivating float account:", error);
      throw new Error(
        `Failed to deactivate float account: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Permanently delete float account and all associated GL resources
   * WARNING: This will permanently delete GL accounts and mappings
   */
  static async deleteFloatAccount(id: string): Promise<void> {
    try {
      console.log(
        "🗑️ [FLOAT] Permanently deleting float account and GL resources:",
        id
      );

      // Get the float account details before deletion
      const floatAccount = await sql`
        SELECT * FROM float_accounts WHERE id = ${id}
      `;

      if (floatAccount.length === 0) {
        throw new Error("Float account not found");
      }

      const account = floatAccount[0];
      const transactionType = `${account.account_type.replace(
        /-/g,
        "_"
      )}_float`;

      console.log(
        `🗑️ [FLOAT] Deleting GL resources for ${account.account_type} (${transactionType})`
      );

      // 1. Get the GL account IDs that were used by this float account type
      const glAccounts = await sql`
        SELECT DISTINCT gl_account_id 
        FROM gl_mappings 
        WHERE transaction_type = ${transactionType}
          AND branch_id = ${account.branch_id}
      `;

      // 2. Check if these GL accounts are used by other mappings
      const accountsToDelete = [];
      for (const glAccount of glAccounts) {
        const otherMappings = await sql`
          SELECT COUNT(*) as count
          FROM gl_mappings 
          WHERE gl_account_id = ${glAccount.gl_account_id}
            AND transaction_type != ${transactionType}
        `;

        // Only delete if no other transaction types use this GL account
        if (otherMappings[0].count === 0) {
          accountsToDelete.push(glAccount.gl_account_id);
        } else {
          console.log(
            `ℹ️ [FLOAT] GL account ${glAccount.gl_account_id} used by other transaction types, skipping deletion`
          );
        }
      }

      // 3. Delete GL mappings for this float account type
      await sql`
        DELETE FROM gl_mappings 
        WHERE transaction_type = ${transactionType}
          AND branch_id = ${account.branch_id}
      `;

      console.log(
        `🗑️ [FLOAT] Deleted GL mappings for transaction type: ${transactionType}`
      );

      // 4. Delete GL accounts that are no longer used
      if (accountsToDelete.length > 0) {
        await sql`
          DELETE FROM gl_accounts 
          WHERE id = ANY(${accountsToDelete})
        `;
        console.log(
          `🗑️ [FLOAT] Deleted ${accountsToDelete.length} GL accounts:`,
          accountsToDelete
        );
      }

      // 5. Delete the float account
      await sql`
        DELETE FROM float_accounts 
        WHERE id = ${id}
      `;

      console.log(
        `✅ [FLOAT] Successfully deleted float account and GL resources: ${id}`
      );
    } catch (error) {
      console.error("❌ [FLOAT] Error deleting float account:", error);
      throw new Error(
        `Failed to delete float account: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
