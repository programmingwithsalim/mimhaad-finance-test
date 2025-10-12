import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.CONNECTION_STRING!);

export interface FloatGLMapping {
  id: string;
  floatAccountId: string;
  glAccountId: string;
  mappingType: "main_account" | "fee_account" | "commission_account";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  floatAccount?: any;
  glAccount?: any;
}

export interface FloatAccountWithGL {
  id: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
  branchId: string;
  glMappings: FloatGLMapping[];
  mainGLAccount?: any;
  feeGLAccount?: any;
  commissionGLAccount?: any;
}

export class FloatGLMappingService {
  /**
   * Get all float accounts with their GL mappings
   */
  static async getFloatAccountsWithMappings(): Promise<FloatAccountWithGL[]> {
    try {
      const floatAccounts = await sql`
        SELECT 
          fa.*,
          b.name as branch_name
        FROM float_accounts fa
        LEFT JOIN branches b ON fa.branch_id = b.id
        WHERE fa.is_active = true
        ORDER BY fa.account_name
      `;

      const mappings = await sql`
        SELECT 
          m.*,
          g.account_code,
          g.account_name as gl_account_name,
          g.account_type as gl_account_type,
          g.current_balance as gl_balance
        FROM float_account_gl_mapping m
        JOIN gl_accounts g ON m.gl_account_id = g.id
        WHERE m.is_active = true
      `;

      return floatAccounts.map((account) => {
        const accountMappings = mappings.filter(
          (m) => m.float_account_id === account.id
        );

        return {
          id: account.id,
          accountName: account.account_name,
          accountType: account.account_type,
          currentBalance: Number.parseFloat(account.current_balance || "0"),
          branchId: account.branch_id,
          glMappings: accountMappings,
          mainGLAccount: accountMappings.find(
            (m) => m.mapping_type === "main_account"
          ),
          feeGLAccount: accountMappings.find(
            (m) => m.mapping_type === "fee_account"
          ),
          commissionGLAccount: accountMappings.find(
            (m) => m.mapping_type === "commission_account"
          ),
        };
      });
    } catch (error) {
      console.error("Error getting float accounts with mappings:", error);
      throw error;
    }
  }

  /**
   * Create or update a float-to-GL mapping
   */
  static async createOrUpdateMapping(
    floatAccountId: string,
    glAccountId: string,
    mappingType: "main_account" | "fee_account" | "commission_account"
  ): Promise<boolean> {
    try {
      // Check if mapping exists
      const existing = await sql`
        SELECT id FROM float_account_gl_mapping
        WHERE float_account_id = ${floatAccountId}
        AND mapping_type = ${mappingType}
      `;

      if (existing.length > 0) {
        // Update existing mapping
        await sql`
          UPDATE float_account_gl_mapping
          SET gl_account_id = ${glAccountId},
              is_active = true,
              updated_at = NOW()
          WHERE float_account_id = ${floatAccountId}
          AND mapping_type = ${mappingType}
        `;
      } else {
        // Create new mapping
        await sql`
          INSERT INTO float_account_gl_mapping
          (float_account_id, gl_account_id, mapping_type, is_active)
          VALUES (${floatAccountId}, ${glAccountId}, ${mappingType}, true)
        `;
      }

      return true;
    } catch (error) {
      console.error("Error creating/updating mapping:", error);
      return false;
    }
  }

  /**
   * Remove a mapping
   */
  static async removeMapping(
    floatAccountId: string,
    mappingType: string
  ): Promise<boolean> {
    try {
      await sql`
        UPDATE float_account_gl_mapping
        SET is_active = false,
            updated_at = NOW()
        WHERE float_account_id = ${floatAccountId}
        AND mapping_type = ${mappingType}
      `;
      return true;
    } catch (error) {
      console.error("Error removing mapping:", error);
      return false;
    }
  }

  /**
   * Auto-map float accounts to GL accounts based on account type
   */
  static async autoMapFloatAccounts(): Promise<{
    success: number;
    failed: number;
    details: string[];
  }> {
    const results = { success: 0, failed: 0, details: [] };

    try {
      const floatAccounts = await sql`
        SELECT * FROM float_accounts WHERE is_active = true
      `;

      const glAccounts = await sql`
        SELECT * FROM gl_accounts WHERE is_active = true
      `;

      for (const floatAccount of floatAccounts) {
        try {
          const mappings = this.getDefaultMappingsForAccountType(
            floatAccount.account_type,
            glAccounts
          );

          for (const mapping of mappings) {
            const success = await this.createOrUpdateMapping(
              floatAccount.id,
              mapping.glAccountId,
              mapping.type
            );

            if (success) {
              results.success++;
              results.details.push(
                `Mapped ${floatAccount.account_name} (${mapping.type}) to ${mapping.glAccountCode}`
              );
            } else {
              results.failed++;
              results.details.push(
                `Failed to map ${floatAccount.account_name} (${mapping.type})`
              );
            }
          }
        } catch (error) {
          results.failed++;
          results.details.push(
            `Error mapping ${floatAccount.account_name}: ${error.message}`
          );
        }
      }

      return results;
    } catch (error) {
      console.error("Error in auto-mapping:", error);
      throw error;
    }
  }

  /**
   * Get default GL account mappings for a float account type
   */
  private static getDefaultMappingsForAccountType(
    accountType: string,
    glAccounts: any[]
  ) {
    const mappings = [];

    switch (accountType.toLowerCase()) {
      case "momo":
        mappings.push({
          type: "main_account",
          glAccountCode: "1003",
          glAccountId: glAccounts.find((g) => g.account_code === "1003")?.id,
        });
        mappings.push({
          type: "fee_account",
          glAccountCode: "4003",
          glAccountId: glAccounts.find((g) => g.account_code === "4003")?.id,
        });
        mappings.push({
          type: "commission_account",
          glAccountCode: "4001",
          glAccountId: glAccounts.find((g) => g.account_code === "4001")?.id,
        });
        break;

      case "e-zwich":
        mappings.push({
          type: "main_account",
          glAccountCode: "1002",
          glAccountId: glAccounts.find((g) => g.account_code === "1002")?.id,
        });
        mappings.push({
          type: "fee_account",
          glAccountCode: "4003",
          glAccountId: glAccounts.find((g) => g.account_code === "4003")?.id,
        });
        break;

      case "power":
        mappings.push({
          type: "main_account",
          glAccountCode: "1004",
          glAccountId: glAccounts.find((g) => g.account_code === "1004")?.id,
        });
        mappings.push({
          type: "fee_account",
          glAccountCode: "4003",
          glAccountId: glAccounts.find((g) => g.account_code === "4003")?.id,
        });
        break;

      case "agency_banking":
        mappings.push({
          type: "main_account",
          glAccountCode: "1005",
          glAccountId: glAccounts.find((g) => g.account_code === "1005")?.id,
        });
        mappings.push({
          type: "fee_account",
          glAccountCode: "4002",
          glAccountId: glAccounts.find((g) => g.account_code === "4002")?.id,
        });
        break;

      case "jumia":
        mappings.push({
          type: "main_account",
          glAccountCode: "1006",
          glAccountId: glAccounts.find((g) => g.account_code === "1006")?.id,
        });
        mappings.push({
          type: "fee_account",
          glAccountCode: "4004",
          glAccountId: glAccounts.find((g) => g.account_code === "4004")?.id,
        });
        break;

      case "cash_till":
        mappings.push({
          type: "main_account",
          glAccountCode: "1001",
          glAccountId: glAccounts.find((g) => g.account_code === "1001")?.id,
        });
        break;

      default:
        mappings.push({
          type: "main_account",
          glAccountCode: "1003",
          glAccountId: glAccounts.find((g) => g.account_code === "1003")?.id,
        });
    }

    return mappings.filter((m) => m.glAccountId); // Only return mappings where GL account exists
  }

  /**
   * Sync float balances to GL accounts
   */
  static async syncFloatBalancesToGL(): Promise<{
    synced: number;
    errors: string[];
  }> {
    const result = { synced: 0, errors: [] };

    try {
      const mappings = await sql`
        SELECT 
          m.float_account_id,
          m.gl_account_id,
          m.mapping_type,
          fa.current_balance as float_balance,
          g.current_balance as gl_balance
        FROM float_account_gl_mapping m
        JOIN float_accounts fa ON m.float_account_id = fa.id
        JOIN gl_accounts g ON m.gl_account_id = g.id
        WHERE m.is_active = true
        AND m.mapping_type = 'main_account'
      `;

      for (const mapping of mappings) {
        try {
          await sql`
            UPDATE gl_accounts
            SET current_balance = ${mapping.float_balance},
                updated_at = NOW()
            WHERE id = ${mapping.gl_account_id}
          `;
          result.synced++;
        } catch (error) {
          result.errors.push(
            `Failed to sync ${mapping.float_account_id}: ${error.message}`
          );
        }
      }

      return result;
    } catch (error) {
      console.error("Error syncing float balances to GL:", error);
      throw error;
    }
  }
}
