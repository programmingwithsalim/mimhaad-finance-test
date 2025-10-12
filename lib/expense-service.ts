import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface ExpenseData {
  amount: number;
  description: string;
  expenseHeadId: string;
  reference?: string;
  receiptNumber?: string;
  branchId?: string;
  date?: string;
}

export interface ExpenseResult {
  success: boolean;
  expenseId?: string;
  error?: string;
}

export class ExpenseService {
  static async createExpense(
    expenseData: ExpenseData,
    request: Request
  ): Promise<ExpenseResult> {
    try {
      const user = await getCurrentUser(request);

      const result = await sql`
        INSERT INTO expenses (
          amount,
          description,
          expense_head_id,
          reference,
          receipt_number,
          branch_id,
          expense_date,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${expenseData.amount},
          ${expenseData.description},
          ${expenseData.expenseHeadId},
          ${expenseData.reference || null},
          ${expenseData.receiptNumber || null},
          ${expenseData.branchId || user.branchId},
          ${expenseData.date || new Date().toISOString().split("T")[0]},
          ${user.id},
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return {
        success: true,
        expenseId: result[0].id,
      };
    } catch (error) {
      console.error("Error creating expense:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getExpenses(
    filters: {
      branchId?: string;
      expenseHeadId?: string;
      startDate?: string;
      endDate?: string;
      searchTerm?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ expenses: any[]; pagination: any }> {
    try {
      const {
        branchId,
        expenseHeadId,
        startDate,
        endDate,
        searchTerm,
        page = 1,
        limit = 50,
      } = filters;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (branchId) {
        whereConditions.push(`e.branch_id = $${paramIndex}`);
        params.push(branchId);
        paramIndex++;
      }

      if (expenseHeadId) {
        whereConditions.push(`e.expense_head_id = $${paramIndex}`);
        params.push(expenseHeadId);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`e.expense_date >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`e.expense_date <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      if (searchTerm) {
        whereConditions.push(
          `(e.description ILIKE $${paramIndex} OR e.reference ILIKE $${paramIndex})`
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
        FROM expenses e 
        ${whereClause}
      `;
      const countResult = await sql.unsafe(countQuery, params);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const offset = (page - 1) * limit;
      const expensesQuery = `
        SELECT 
          e.id,
          e.amount,
          e.description,
          e.reference,
          e.receipt_number,
          e.expense_date,
          e.created_at,
          eh.name as expense_head_name,
          b.name as branch_name,
          u.username as created_by
        FROM expenses e
        LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN users u ON e.created_by = u.id
        ${whereClause}
        ORDER BY e.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const expensesParams = [...params, limit, offset];
      const expensesResult = await sql.unsafe(expensesQuery, expensesParams);

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        expenses: expensesResult,
        pagination,
      };
    } catch (error) {
      console.error("Error getting expenses:", error);
      return {
        expenses: [],
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

  static async getExpenseStatistics(branchId?: string): Promise<any> {
    try {
      let whereClause = "";
      let params: any[] = [];

      if (branchId) {
        whereClause = "WHERE e.branch_id = $1";
        params.push(branchId);
      }

      // Get total expenses
      const totalExpensesResult = await sql.unsafe(
        `SELECT COUNT(*) as total, SUM(amount) as total_amount FROM expenses e ${whereClause}`,
        params
      );
      const totalExpenses = Number(totalExpensesResult[0]?.total || 0);
      const totalAmount = Number(totalExpensesResult[0]?.total_amount || 0);

      // Get expenses by head
      const expensesByHeadResult = await sql.unsafe(
        `SELECT 
          eh.name as expense_head,
          COUNT(e.id) as count,
          SUM(e.amount) as total_amount
        FROM expenses e
        LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
        ${whereClause}
        GROUP BY eh.id, eh.name
        ORDER BY total_amount DESC
        LIMIT 10`,
        params
      );

      // Get monthly expenses for last 6 months
      const monthlyExpensesResult = await sql.unsafe(
        `SELECT 
          DATE_TRUNC('month', expense_date) as month,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM expenses e
        ${whereClause}
        AND expense_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', expense_date)
        ORDER BY month DESC`,
        params
      );

      return {
        totalExpenses,
        totalAmount,
        expensesByHead: expensesByHeadResult,
        monthlyExpenses: monthlyExpensesResult,
      };
    } catch (error) {
      console.error("Error getting expense statistics:", error);
      return {
        totalExpenses: 0,
        totalAmount: 0,
        expensesByHead: [],
        monthlyExpenses: [],
      };
    }
  }

  static async updateExpense(
    expenseId: string,
    expenseData: Partial<ExpenseData>,
    request: Request
  ): Promise<ExpenseResult> {
    try {
      const user = await getCurrentUser(request);

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (expenseData.amount !== undefined) {
        updateFields.push(`amount = $${paramIndex}`);
        params.push(expenseData.amount);
        paramIndex++;
      }

      if (expenseData.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        params.push(expenseData.description);
        paramIndex++;
      }

      if (expenseData.expenseHeadId !== undefined) {
        updateFields.push(`expense_head_id = $${paramIndex}`);
        params.push(expenseData.expenseHeadId);
        paramIndex++;
      }

      if (expenseData.reference !== undefined) {
        updateFields.push(`reference = $${paramIndex}`);
        params.push(expenseData.reference);
        paramIndex++;
      }

      if (expenseData.receiptNumber !== undefined) {
        updateFields.push(`receipt_number = $${paramIndex}`);
        params.push(expenseData.receiptNumber);
        paramIndex++;
      }

      if (expenseData.date !== undefined) {
        updateFields.push(`expense_date = $${paramIndex}`);
        params.push(expenseData.date);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      const updateQuery = `
        UPDATE expenses 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id
      `;
      params.push(expenseId);

      const result = await sql.unsafe(updateQuery, params);

      if (result.length === 0) {
        return {
          success: false,
          error: "Expense not found",
        };
      }

      return {
        success: true,
        expenseId: result[0].id,
      };
    } catch (error) {
      console.error("Error updating expense:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async deleteExpense(
    expenseId: string,
    request: Request
  ): Promise<ExpenseResult> {
    try {
      const user = await getCurrentUser(request);

      const result = await sql`
        DELETE FROM expenses 
        WHERE id = ${expenseId}
        RETURNING id
      `;

      if (result.length === 0) {
        return {
          success: false,
          error: "Expense not found",
        };
      }

      return {
        success: true,
        expenseId: result[0].id,
      };
    } catch (error) {
      console.error("Error deleting expense:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
