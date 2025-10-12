import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export class BankAccountFilterService {
  static async getAgencyBankingAccounts(branchId?: string) {
    try {
      const branchFilter = branchId ? sql`AND branch_id = ${branchId}` : sql``;

      const accounts = await sql`
        SELECT 
          id,
          account_number,
          account_name,
          bank_name,
          account_type,
          current_balance,
          branch_id,
          is_active,
          created_at,
          updated_at
        FROM bank_accounts
        WHERE account_type = 'agency-banking'
          AND is_active = true
          ${branchFilter}
        ORDER BY account_name ASC
      `;

      return accounts;
    } catch (error) {
      console.error("Error fetching agency banking accounts:", error);
      return [];
    }
  }

  static async getBankAccountsOnly(branchId?: string) {
    try {
      const branchFilter = branchId ? sql`AND branch_id = ${branchId}` : sql``;

      const accounts = await sql`
        SELECT 
          id,
          account_number,
          account_name,
          bank_name,
          account_type,
          current_balance,
          branch_id,
          is_active,
          created_at,
          updated_at
        FROM bank_accounts
        WHERE account_type != 'momo'
          AND is_active = true
          ${branchFilter}
        ORDER BY account_name ASC
      `;

      return accounts;
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      return [];
    }
  }
}
