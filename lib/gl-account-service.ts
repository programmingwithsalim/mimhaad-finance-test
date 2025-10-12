import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface GLAccountSeedData {
  accountNumber: string;
  accountName: string;
  accountType: string;
  description?: string;
  parentAccountId?: string;
  isActive: boolean;
  branchId?: string;
}

export class GLAccountService {
  static async seedGLAccounts(
    accounts: GLAccountSeedData[],
    request: Request
  ): Promise<{ success: boolean; message: string; errors?: string[] }> {
    try {
      const user = await getCurrentUser(request);
      const errors: string[] = [];

      for (const account of accounts) {
        try {
          // Check if account already exists
          const existingAccount = await sql`
            SELECT id FROM gl_accounts 
            WHERE account_number = ${account.accountNumber}
            AND branch_id = ${account.branchId || user.branchId}
          `;

          if (existingAccount.length > 0) {
            errors.push(`Account ${account.accountNumber} already exists`);
            continue;
          }

          // Create the account
          await sql`
            INSERT INTO gl_accounts (
              account_number,
              account_name,
              account_type,
              description,
              parent_account_id,
              is_active,
              branch_id,
              created_by,
              created_at,
              updated_at
            )
            VALUES (
              ${account.accountNumber},
              ${account.accountName},
              ${account.accountType},
              ${account.description || null},
              ${account.parentAccountId || null},
              ${account.isActive},
              ${account.branchId || user.branchId},
              ${user.id},
              NOW(),
              NOW()
            )
          `;
        } catch (error) {
          errors.push(
            `Failed to create account ${account.accountNumber}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: `Seeded accounts with some errors`,
          errors,
        };
      }

      return {
        success: true,
        message: `Successfully seeded ${accounts.length} GL accounts`,
      };
    } catch (error) {
      console.error("Error seeding GL accounts:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getDefaultGLAccounts(): Promise<GLAccountSeedData[]> {
    return [
      {
        accountNumber: "1000",
        accountName: "Cash",
        accountType: "asset",
        description: "Cash on hand",
        isActive: true,
      },
      {
        accountNumber: "1100",
        accountName: "Bank Account",
        accountType: "asset",
        description: "Main bank account",
        isActive: true,
      },
      {
        accountNumber: "2000",
        accountName: "Accounts Payable",
        accountType: "liability",
        description: "Amounts owed to suppliers",
        isActive: true,
      },
      {
        accountNumber: "3000",
        accountName: "Owner's Equity",
        accountType: "equity",
        description: "Owner's investment in the business",
        isActive: true,
      },
      {
        accountNumber: "4000",
        accountName: "Revenue",
        accountType: "revenue",
        description: "Income from business operations",
        isActive: true,
      },
      {
        accountNumber: "5000",
        accountName: "Expenses",
        accountType: "expense",
        description: "Business operating expenses",
        isActive: true,
      },
      {
        accountNumber: "6000",
        accountName: "Float Accounts",
        accountType: "asset",
        description: "Float accounts for various services",
        isActive: true,
      },
      {
        accountNumber: "7000",
        accountName: "Commission Income",
        accountType: "revenue",
        description: "Income from commissions",
        isActive: true,
      },
      {
        accountNumber: "8000",
        accountName: "Commission Expenses",
        accountType: "expense",
        description: "Expenses related to commissions",
        isActive: true,
      },
    ];
  }

  static async validateGLAccountStructure(
    branchId: string
  ): Promise<{ valid: boolean; missing: string[]; message: string }> {
    try {
      const requiredAccounts = [
        { number: "1000", name: "Cash" },
        { number: "1100", name: "Bank Account" },
        { number: "2000", name: "Accounts Payable" },
        { number: "3000", name: "Owner's Equity" },
        { number: "4000", name: "Revenue" },
        { number: "5000", name: "Expenses" },
        { number: "6000", name: "Float Accounts" },
        { number: "7000", name: "Commission Income" },
        { number: "8000", name: "Commission Expenses" },
      ];

      const existingAccounts = await sql`
        SELECT account_number, account_name 
        FROM gl_accounts 
        WHERE branch_id = ${branchId}
      `;

      const existingAccountNumbers = existingAccounts.map(
        (acc) => acc.account_number
      );
      const missing = requiredAccounts.filter(
        (acc) => !existingAccountNumbers.includes(acc.number)
      );

      if (missing.length === 0) {
        return {
          valid: true,
          missing: [],
          message: "GL account structure is valid",
        };
      } else {
        return {
          valid: false,
          missing: missing.map((acc) => `${acc.number} - ${acc.name}`),
          message: `Missing ${missing.length} required GL accounts`,
        };
      }
    } catch (error) {
      console.error("Error validating GL account structure:", error);
      return {
        valid: false,
        missing: [],
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
