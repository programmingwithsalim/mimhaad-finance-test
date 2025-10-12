import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to validate UUID
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Types
export interface ExpenseHead {
  id: string;
  name: string;
  category: string;
  description: string | null;
  gl_account_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  reference_number: string;
  branch_id: string;
  expense_head_id: string;
  amount: number;
  description: string;
  expense_date: string;
  payment_source: string;
  payment_account_id: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  gl_journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseFilters {
  branch_id?: string;
  expense_head_id?: string;
  category?: string;
  status?: string;
  payment_source?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  created_by?: string;
}

export interface ExpenseStatistics {
  total_expenses: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  approved_count: number;
  approved_amount: number;
  paid_count: number;
  paid_amount: number;
  rejected_count: number;
  rejected_amount: number;
  by_category: Record<string, { count: number; amount: number }>;
  by_payment_source: Record<string, { count: number; amount: number }>;
  recent_expenses: Expense[];
}

// Expense Head Operations
export async function getExpenseHeads(): Promise<ExpenseHead[]> {
  try {
    console.log("Fetching expense heads from database...");

    // Use a prepared statement for better performance
    const result = await sql`
      SELECT * FROM expense_heads 
      WHERE is_active = true 
      ORDER BY category, name
    `;

    console.log(`Found ${result.length} expense heads`);
    return result as ExpenseHead[];
  } catch (error) {
    console.error("Error fetching expense heads:", error);
    // Return mock data as fallback
    return [
      {
        id: "1",
        name: "Office Supplies",
        category: "Operational",
        description: "Stationery and office materials",
        gl_account_code: "6100",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Utilities",
        category: "Operational",
        description: "Electricity, water, internet bills",
        gl_account_code: "6200",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "3",
        name: "Travel & Transport",
        category: "Operational",
        description: "Business travel and transportation",
        gl_account_code: "6500",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }
}

export async function createExpenseHead(
  data: Omit<ExpenseHead, "id" | "created_at" | "updated_at">
): Promise<ExpenseHead | null> {
  try {
    const result = await sql`
      INSERT INTO expense_heads (name, category, description, gl_account_code, is_active)
      VALUES (${data.name}, ${data.category}, ${data.description}, ${data.gl_account_code}, ${data.is_active})
      RETURNING *
    `;
    return result[0] as ExpenseHead;
  } catch (error) {
    console.error("Error creating expense head:", error);
    return null;
  }
}

export async function getExpenseHeadById(
  id: string
): Promise<ExpenseHead | null> {
  try {
    const result = await sql`
      SELECT * FROM expense_heads WHERE id = ${id}
    `;
    return (result[0] as ExpenseHead) || null;
  } catch (error) {
    console.error("Error fetching expense head by ID:", error);
    return null;
  }
}

export async function updateExpenseHead(
  id: string,
  data: Partial<Omit<ExpenseHead, "id" | "created_at" | "updated_at">>
): Promise<ExpenseHead | null> {
  try {
    const result = await sql`
      UPDATE expense_heads 
      SET 
        name = COALESCE(${data.name}, name),
        category = COALESCE(${data.category}, category),
        description = COALESCE(${data.description}, description),
        gl_account_code = COALESCE(${data.gl_account_code}, gl_account_code),
        is_active = COALESCE(${data.is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return (result[0] as ExpenseHead) || null;
  } catch (error) {
    console.error("Error updating expense head:", error);
    return null;
  }
}

export async function deleteExpenseHead(id: string): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM expense_heads WHERE id = ${id}
    `;
    return true;
  } catch (error) {
    console.error("Error deleting expense head:", error);
    return false;
  }
}

// Expense Operations - Optimized for performance
export async function getExpenses(
  filters?: ExpenseFilters
): Promise<Expense[]> {
  try {
    console.log("Fetching expenses with filters:", filters);

    // Build query dynamically for better performance
    let query = `
      SELECT e.*, eh.name as expense_head_name, eh.category as expense_head_category
      FROM expenses e
      LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters) {
      if (filters.branch_id) {
        conditions.push(`e.branch_id = $${paramIndex}`);
        params.push(filters.branch_id);
        paramIndex++;
      }

      if (filters.expense_head_id) {
        conditions.push(`e.expense_head_id = $${paramIndex}`);
        params.push(filters.expense_head_id);
        paramIndex++;
      }

      if (filters.category) {
        conditions.push(`eh.category = $${paramIndex}`);
        params.push(filters.category);
        paramIndex++;
      }

      if (filters.status) {
        conditions.push(`e.status = $${paramIndex}`);
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.payment_source) {
        conditions.push(`e.payment_source = $${paramIndex}`);
        params.push(filters.payment_source);
        paramIndex++;
      }

      if (filters.start_date) {
        conditions.push(`e.expense_date >= $${paramIndex}`);
        params.push(filters.start_date);
        paramIndex++;
      }

      if (filters.end_date) {
        conditions.push(`e.expense_date <= $${paramIndex}`);
        params.push(filters.end_date);
        paramIndex++;
      }

      if (filters.min_amount !== undefined) {
        conditions.push(`e.amount >= $${paramIndex}`);
        params.push(filters.min_amount);
        paramIndex++;
      }

      if (filters.max_amount !== undefined) {
        conditions.push(`e.amount <= $${paramIndex}`);
        params.push(filters.max_amount);
        paramIndex++;
      }

      if (filters.created_by) {
        conditions.push(`e.created_by = $${paramIndex}`);
        params.push(filters.created_by);
        paramIndex++;
      }
    }

    // Add WHERE clause if we have conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Add ORDER BY clause
    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    // Add LIMIT for better performance
    query += ` LIMIT 500`;

    console.log("Executing optimized query:", query);
    console.log("Query params:", params);

    // Execute the query
    const result = await sql.query(query, params);

    console.log(`Found ${result.length} expenses`);
    return result as Expense[];
  } catch (error) {
    console.error("Error fetching expenses:", error);
    // Return empty array as fallback
    return [];
  }
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  try {
    console.log("Fetching expense by ID:", id);

    // Validate UUID format
    if (!isValidUUID(id)) {
      console.error("Invalid UUID format:", id);
      return null;
    }

    const result = await sql`
      SELECT e.*, eh.name as expense_head_name, eh.category as expense_head_category
      FROM expenses e
      LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
      WHERE e.id = ${id}
    `;

    console.log("Query result:", result);
    return (result[0] as Expense) || null;
  } catch (error) {
    console.error("Error fetching expense by ID:", error);
    return null;
  }
}

export async function createExpense(data: {
  branch_id: string;
  expense_head_id: string;
  amount: number;
  description: string;
  expense_date: string;
  payment_source: string;
  payment_account_id?: string;
  created_by: string;
}): Promise<Expense | null> {
  try {
    console.log("Creating expense with data:", data);

    // Generate reference number
    const referenceNumber = `EXP-${new Date().getFullYear()}-${String(
      Date.now()
    ).slice(-6)}`;

    const result = await sql`
      INSERT INTO expenses (
        reference_number, branch_id, expense_head_id, amount, description,
        expense_date, payment_source, payment_account_id, created_by
      )
      VALUES (
        ${referenceNumber}, ${data.branch_id}, ${data.expense_head_id}, ${
      data.amount
    }, 
        ${data.description}, ${data.expense_date}, ${data.payment_source}, 
        ${data.payment_account_id || null}, ${data.created_by}
      )
      RETURNING *
    `;

    console.log("Created expense:", result[0]);
    return result[0] as Expense;
  } catch (error) {
    console.error("Error creating expense:", error);
    return null;
  }
}

export async function updateExpense(
  id: string,
  data: Partial<Expense>
): Promise<Expense | null> {
  try {
    console.log("Updating expense with ID:", id, "Data:", data);

    // Build dynamic update query
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Add fields to update
    if (data.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }

    if (data.amount !== undefined) {
      updateFields.push(`amount = $${paramIndex}`);
      params.push(data.amount);
      paramIndex++;
    }

    if (data.expense_head_id !== undefined) {
      updateFields.push(`expense_head_id = $${paramIndex}`);
      params.push(data.expense_head_id);
      paramIndex++;
    }

    if (data.expense_date !== undefined) {
      updateFields.push(`expense_date = $${paramIndex}`);
      params.push(data.expense_date);
      paramIndex++;
    }

    if (data.payment_source !== undefined) {
      updateFields.push(`payment_source = $${paramIndex}`);
      params.push(data.payment_source);
      paramIndex++;
    }

    if (data.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(data.status);
      paramIndex++;
    }

    // Always update the updated_at field
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateFields.length === 1) {
      // Only updated_at field
      console.log("No fields to update");
      return await getExpenseById(id);
    }

    // Add the ID parameter
    params.push(id);
    const idParamIndex = paramIndex;

    const query = `
      UPDATE expenses 
      SET ${updateFields.join(", ")}
      WHERE id = $${idParamIndex}
      RETURNING *
    `;

    console.log("Update query:", query);
    console.log("Update params:", params);

    const result = await sql.query(query, params);

    if (result.length === 0) {
      console.log("No expense found to update");
      return null;
    }

    console.log("Updated expense:", result[0]);
    return result[0] as Expense;
  } catch (error) {
    console.error("Error updating expense:", error);
    return null;
  }
}

export async function approveExpense(
  id: string,
  approver_id: string,
  comments?: string
): Promise<Expense | null> {
  try {
    console.log(`Approving expense ${id} by ${approver_id}`);

    // Update expense status
    const result = await sql`
      UPDATE expenses 
      SET status = 'approved', approved_by = ${approver_id}, approved_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND status = 'pending'
      RETURNING *
    `;

    if (result.length === 0) {
      console.log(
        "No expense found to approve or expense not in pending status"
      );
      return null;
    }

    // Add approval record if comments provided
    if (comments) {
      try {
        await sql`
          INSERT INTO expense_approvals (expense_id, approver_id, action, comments)
          VALUES (${id}, ${approver_id}, 'approved', ${comments})
        `;
      } catch (approvalError) {
        console.log("Could not insert approval record");
      }
    }

    console.log("Expense approved successfully");
    return result[0] as Expense;
  } catch (error) {
    console.error("Error approving expense:", error);
    return null;
  }
}

export async function rejectExpense(
  id: string,
  rejector_id: string,
  reason: string
): Promise<Expense | null> {
  try {
    console.log(`Rejecting expense ${id} by ${rejector_id}`);

    // Update expense status
    const result = await sql`
      UPDATE expenses 
      SET status = 'rejected', rejected_by = ${rejector_id}, rejected_at = CURRENT_TIMESTAMP, rejection_reason = ${reason}
      WHERE id = ${id} AND status = 'pending'
      RETURNING *
    `;

    if (result.length === 0) {
      console.log(
        "No expense found to reject or expense not in pending status"
      );
      return null;
    }

    // Add approval record
    try {
      await sql`
        INSERT INTO expense_approvals (expense_id, approver_id, action, comments)
        VALUES (${id}, ${rejector_id}, 'rejected', ${reason})
      `;
    } catch (approvalError) {
      console.log("Could not insert approval record");
    }

    console.log("Expense rejected successfully");
    return result[0] as Expense;
  } catch (error) {
    console.error("Error rejecting expense:", error);
    return null;
  }
}

export async function markExpensePaid(
  id: string,
  payer_id: string
): Promise<Expense | null> {
  try {
    console.log(`Marking expense ${id} as paid by ${payer_id}`);

    const result = await sql`
      UPDATE expenses 
      SET status = 'paid', paid_by = ${payer_id}, paid_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND status = 'approved'
      RETURNING *
    `;

    if (result.length === 0) {
      console.log(
        "No expense found to mark as paid or expense not in approved status"
      );
      return null;
    }

    console.log("Expense marked as paid successfully");
    return result[0] as Expense;
  } catch (error) {
    console.error("Error marking expense as paid:", error);
    return null;
  }
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    console.log(`Deleting expense ${id}`);

    // Validate UUID format
    if (!isValidUUID(id)) {
      console.error("Invalid UUID format:", id);
      return false;
    }

    // First check if expense exists
    const existingExpense = await sql`
      SELECT id FROM expenses WHERE id = ${id}
    `;

    if (existingExpense.length === 0) {
      console.log("Expense not found for deletion");
      return false;
    }

    console.log("Found expense to delete, proceeding with deletion...");

    // Delete the expense
    const result = await sql`
      DELETE FROM expenses WHERE id = ${id}
    `;

    console.log("Delete result:", result);

    // Check if deletion was successful
    // Different database drivers return different properties
    const success =
      result.rowCount > 0 || result.count > 0 || result.length === 0;

    console.log(`Expense deletion ${success ? "successful" : "failed"}`);
    return success;
  } catch (error) {
    console.error("Error deleting expense:", error);
    return false;
  }
}

export async function getExpenseStatistics(
  filters?: ExpenseFilters
): Promise<ExpenseStatistics> {
  try {
    console.log("Fetching expense statistics...", filters);

    // Get basic statistics
    let statsResult;
    if (filters?.branch_id) {
      statsResult = await sql`
        SELECT 
          COUNT(*) as total_expenses,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END), 0) as rejected_amount
        FROM expenses e
        WHERE e.branch_id = ${filters.branch_id}
      `;
    } else {
      statsResult = await sql`
        SELECT 
          COUNT(*) as total_expenses,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END), 0) as rejected_amount
        FROM expenses e
      `;
    }

    if (
      !statsResult ||
      !Array.isArray(statsResult) ||
      statsResult.length === 0 ||
      !statsResult[0]
    ) {
      throw new Error("No statistics returned from database query");
    }

    // Get category breakdown
    let categoryResult;
    if (filters?.branch_id) {
      categoryResult = await sql`
        SELECT 
          eh.category,
          COUNT(*) as count,
          COALESCE(SUM(e.amount), 0) as amount
        FROM expenses e
        LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
        WHERE e.branch_id = ${filters.branch_id}
        GROUP BY eh.category
        ORDER BY amount DESC
      `;
    } else {
      categoryResult = await sql`
        SELECT 
          eh.category,
          COUNT(*) as count,
          COALESCE(SUM(e.amount), 0) as amount
        FROM expenses e
        LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
        GROUP BY eh.category
        ORDER BY amount DESC
      `;
    }

    // Get payment source breakdown
    let paymentSourceResult;
    if (filters?.branch_id) {
      paymentSourceResult = await sql`
        SELECT 
          payment_source,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM expenses e
        WHERE e.branch_id = ${filters.branch_id}
        GROUP BY payment_source
        ORDER BY amount DESC
      `;
    } else {
      paymentSourceResult = await sql`
        SELECT 
          payment_source,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM expenses e
        GROUP BY payment_source
        ORDER BY amount DESC
      `;
    }

    // Get recent expenses
    let recentResult;
    if (filters?.branch_id) {
      recentResult = await sql`
        SELECT e.*, eh.name as expense_head_name, eh.category as expense_head_category
        FROM expenses e
        LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
        WHERE e.branch_id = ${filters.branch_id}
        ORDER BY e.created_at DESC
        LIMIT 10
      `;
    } else {
      recentResult = await sql`
        SELECT e.*, eh.name as expense_head_name, eh.category as expense_head_category
        FROM expenses e
        LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
        ORDER BY e.created_at DESC
        LIMIT 10
      `;
    }

    const stats = statsResult[0];
    const byCategory: Record<string, { count: number; amount: number }> = {};
    const byPaymentSource: Record<string, { count: number; amount: number }> =
      {};

    categoryResult.forEach((row: any) => {
      if (row.category) {
        byCategory[row.category] = {
          count: Number(row.count),
          amount: Number(row.amount),
        };
      }
    });

    paymentSourceResult.forEach((row: any) => {
      byPaymentSource[row.payment_source] = {
        count: Number(row.count),
        amount: Number(row.amount),
      };
    });

    const statistics = {
      total_expenses: Number(stats.total_expenses),
      total_amount: Number(stats.total_amount),
      pending_count: Number(stats.pending_count),
      pending_amount: Number(stats.pending_amount),
      approved_count: Number(stats.approved_count),
      approved_amount: Number(stats.approved_amount),
      paid_count: Number(stats.paid_count),
      paid_amount: Number(stats.paid_amount),
      rejected_count: Number(stats.rejected_count),
      rejected_amount: Number(stats.rejected_amount),
      by_category: byCategory,
      by_payment_source: byPaymentSource,
      recent_expenses: recentResult as Expense[],
    };

    console.log("Expense statistics:", statistics);
    return statistics;
  } catch (error) {
    console.error("Error fetching expense statistics:", error);
    throw error;
  }
}
