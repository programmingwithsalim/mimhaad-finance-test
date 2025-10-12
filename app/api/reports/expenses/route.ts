import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { devLog } from "@/lib/dev-logger";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branch = searchParams.get("branch");

    // Get user context for authorization
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (error) {
      console.warn("Authentication failed:", error);
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Determine effective branch filter
    const effectiveBranchId = user.role === "admin" ? branch : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND e.branch_id = ${effectiveBranchId}`
        : sql``;

    // Date filter
    const dateFilter =
      from && to ? sql`AND e.expense_date BETWEEN ${from} AND ${to}` : sql``;

    // Get expenses with expense head details
    const expensesResult = await sql`
      SELECT 
        e.id,
        e.reference_number,
        e.amount,
        e.description,
        e.expense_date,
        e.payment_method,
        e.status,
        e.created_at,
        e.notes,
        eh.name as expense_head_name,
        eh.category as expense_category,
        b.name as branch_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM expenses e
      LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1 ${branchFilter} ${dateFilter}
      ORDER BY e.expense_date DESC, e.amount DESC
    `;

    // Get summary statistics
    const summaryResult = await sql`
      SELECT 
        COUNT(*) as total_expenses,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_expenses,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_expenses,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_expenses,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_expenses,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status IN ('approved', 'paid') THEN amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount
      FROM expenses e
      WHERE 1=1 ${branchFilter} ${dateFilter}
    `;

    // Get expenses by category
    const categoryBreakdown = await sql`
      SELECT 
        eh.category,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COALESCE(AVG(e.amount), 0) as avg_amount
      FROM expenses e
      LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
      WHERE 1=1 ${branchFilter} ${dateFilter}
      GROUP BY eh.category
      ORDER BY total_amount DESC
    `;

    // Get expenses by expense head
    const expenseHeadBreakdown = await sql`
      SELECT 
        eh.name as expense_head,
        eh.category,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COALESCE(AVG(e.amount), 0) as avg_amount
      FROM expenses e
      LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
      WHERE 1=1 ${branchFilter} ${dateFilter}
      GROUP BY eh.id, eh.name, eh.category
      ORDER BY total_amount DESC
    `;

    // Get expenses by branch
    const branchBreakdown = await sql`
      SELECT 
        b.name as branch_name,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COALESCE(AVG(e.amount), 0) as avg_amount
      FROM expenses e
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE 1=1 ${branchFilter} ${dateFilter}
      GROUP BY b.id, b.name
      ORDER BY total_amount DESC
    `;

    // Get monthly trend
    const monthlyTrend = await sql`
      SELECT 
        DATE_TRUNC('month', e.expense_date) as month,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total_amount
      FROM expenses e
      WHERE 1=1 ${branchFilter} ${dateFilter}
      GROUP BY DATE_TRUNC('month', e.expense_date)
      ORDER BY month DESC
      LIMIT 12
    `;

    const summary = summaryResult[0];
    const totalAmount = Number(summary.total_amount) || 0;
    const paidAmount = Number(summary.paid_amount) || 0;
    const pendingAmount = Number(summary.pending_amount) || 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalExpenses: Number(summary.total_expenses) || 0,
          pendingExpenses: Number(summary.pending_expenses) || 0,
          approvedExpenses: Number(summary.approved_expenses) || 0,
          paidExpenses: Number(summary.paid_expenses) || 0,
          rejectedExpenses: Number(summary.rejected_expenses) || 0,
          totalAmount,
          paidAmount,
          pendingAmount,
          approvedAmount: Number(summary.approved_amount) || 0,
          paymentRate: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
        },
        expenses: expensesResult,
        categoryBreakdown: categoryBreakdown,
        expenseHeadBreakdown: expenseHeadBreakdown,
        branchBreakdown: branchBreakdown,
        monthlyTrend: monthlyTrend,
        reportDate: new Date().toISOString(),
        generatedBy: user.name || user.email,
      },
    });
  } catch (error) {
    devLog.error("Error generating expenses report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate expenses report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
