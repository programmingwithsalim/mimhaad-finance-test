import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface GLAccountData {
  accountNumber: string;
  accountName: string;
  accountType: string;
  description?: string;
  parentAccountId?: string;
  isActive: boolean;
  branchId?: string;
}

export interface GLAccountResult {
  success: boolean;
  accountId?: string;
  error?: string;
}

export class GLServiceEnhanced {
  static async createGLAccount(
    accountData: GLAccountData,
    request: Request
  ): Promise<GLAccountResult> {
    try {
      const user = await getCurrentUser(request);

      // Check if account number already exists
      const existingAccount = await sql`
        SELECT id FROM gl_accounts 
        WHERE account_number = ${accountData.accountNumber}
        AND branch_id = ${accountData.branchId || user.branchId}
      `;

      if (existingAccount.length > 0) {
        return {
          success: false,
          error: "Account number already exists",
        };
      }

      const result = await sql`
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
          ${accountData.accountNumber},
          ${accountData.accountName},
          ${accountData.accountType},
          ${accountData.description || null},
          ${accountData.parentAccountId || null},
          ${accountData.isActive},
          ${accountData.branchId || user.branchId},
          ${user.id},
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return {
        success: true,
        accountId: result[0].id,
      };
    } catch (error) {
      console.error("Error creating GL account:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getGLAccounts(
    filters: {
      branchId?: string;
      accountType?: string;
      isActive?: boolean;
      searchTerm?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ accounts: any[]; pagination: any }> {
    try {
      const {
        branchId,
        accountType,
        isActive,
        searchTerm,
        page = 1,
        limit = 50,
      } = filters;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (branchId) {
        whereConditions.push(`ga.branch_id = $${paramIndex}`);
        params.push(branchId);
        paramIndex++;
      }

      if (accountType) {
        whereConditions.push(`ga.account_type = $${paramIndex}`);
        params.push(accountType);
        paramIndex++;
      }

      if (isActive !== undefined) {
        whereConditions.push(`ga.is_active = $${paramIndex}`);
        params.push(isActive);
        paramIndex++;
      }

      if (searchTerm) {
        whereConditions.push(
          `(ga.account_name ILIKE $${paramIndex} OR ga.account_number ILIKE $${paramIndex})`
        );
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM gl_accounts ga 
        ${whereClause}
      `;
      const countResult = await sql.unsafe(countQuery, params);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const offset = (page - 1) * limit;
      const accountsQuery = `
        SELECT 
          ga.id,
          ga.account_number,
          ga.account_name,
          ga.account_type,
          ga.description,
          ga.is_active,
          ga.created_at,
          ga.updated_at,
          b.name as branch_name,
          u.username as created_by,
          COALESCE(SUM(ged.debit_amount), 0) - COALESCE(SUM(ged.credit_amount), 0) as balance
        FROM gl_accounts ga
        LEFT JOIN branches b ON ga.branch_id = b.id
        LEFT JOIN users u ON ga.created_by = u.id
        LEFT JOIN gl_entry_details ged ON ga.id = ged.gl_account_id
        ${whereClause}
        GROUP BY ga.id, ga.account_number, ga.account_name, ga.account_type, ga.description, ga.is_active, ga.created_at, ga.updated_at, b.name, u.username
        ORDER BY ga.account_number
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const accountsParams = [...params, limit, offset];
      const accountsResult = await sql.unsafe(accountsQuery, accountsParams);

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        accounts: accountsResult,
        pagination,
      };
    } catch (error) {
      console.error("Error getting GL accounts:", error);
      return {
        accounts: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }

  static async updateGLAccount(
    accountId: string,
    accountData: Partial<GLAccountData>,
    request: Request
  ): Promise<GLAccountResult> {
    try {
      const user = await getCurrentUser(request);

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (accountData.accountName !== undefined) {
        updateFields.push(`account_name = $${paramIndex}`);
        params.push(accountData.accountName);
        paramIndex++;
      }

      if (accountData.accountType !== undefined) {
        updateFields.push(`account_type = $${paramIndex}`);
        params.push(accountData.accountType);
        paramIndex++;
      }

      if (accountData.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        params.push(accountData.description);
        paramIndex++;
      }

      if (accountData.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        params.push(accountData.isActive);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      const updateQuery = `
        UPDATE gl_accounts 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id
      `;
      params.push(accountId);

      const result = await sql.unsafe(updateQuery, params);

      if (result.length === 0) {
        return {
          success: false,
          error: "GL account not found",
        };
      }

      return {
        success: true,
        accountId: result[0].id,
      };
    } catch (error) {
      console.error("Error updating GL account:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async deleteGLAccount(
    accountId: string,
    request: Request
  ): Promise<GLAccountResult> {
    try {
      const user = await getCurrentUser(request);

      // Check if account has any transactions
      const hasTransactions = await sql`
        SELECT COUNT(*) as count FROM gl_entry_details WHERE gl_account_id = ${accountId}
      `;

      if (Number(hasTransactions[0]?.count || 0) > 0) {
        return {
          success: false,
          error: "Cannot delete account with existing transactions",
        };
      }

      const result = await sql`
        DELETE FROM gl_accounts 
        WHERE id = ${accountId}
        RETURNING id
      `;

      if (result.length === 0) {
        return {
          success: false,
          error: "GL account not found",
        };
      }

      return {
        success: true,
        accountId: result[0].id,
      };
    } catch (error) {
      console.error("Error deleting GL account:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getGLAccountBalance(
    accountId: string,
    branchId?: string
  ): Promise<number> {
    try {
      let query = sql`
        SELECT 
          COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as balance
        FROM gl_entry_details ged
        JOIN gl_entries ge ON ged.gl_entry_id = ge.id
        WHERE ged.gl_account_id = ${accountId}
      `;

      if (branchId) {
        query = sql`
          SELECT 
            COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as balance
          FROM gl_entry_details ged
          JOIN gl_entries ge ON ged.gl_entry_id = ge.id
          WHERE ged.gl_account_id = ${accountId}
          AND ged.branch_id = ${branchId}
        `;
      }

      const result = await query;
      return Number(result[0]?.balance || 0);
    } catch (error) {
      console.error("Error getting GL account balance:", error);
      return 0;
    }
  }
}
