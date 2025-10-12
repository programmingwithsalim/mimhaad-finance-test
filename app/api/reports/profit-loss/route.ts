import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { devLog } from "@/lib/dev-logger";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    devLog.info("🔍 Profit-Loss API called");
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branch = searchParams.get("branch");

    devLog.info("📅 Date range:", { from, to });
    devLog.info("🏢 Branch:", branch);

    // Get user context for authorization
    let user;
    try {
      user = await getCurrentUser(request);
      devLog.info("👤 User authenticated:", {
        name: user.name,
        role: user.role,
        branchId: user.branchId,
      });
    } catch (error) {
      devLog.error("❌ Authentication failed:", error);
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Determine effective branch filter
    const effectiveBranchId = user.role === "Admin" ? branch : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;

    devLog.info("🎯 Effective branch filter:", effectiveBranchId);

    // Date filter
    const dateFilter =
      from && to ? sql`AND created_at::date BETWEEN ${from} AND ${to}` : sql``;

    devLog.info("📅 Date filter applied:", !!dateFilter);

    // REVENUE SECTION
    devLog.info("💰 Starting revenue queries...");

    // Declare variables outside try-catch so they're accessible
    let agencyRevenue, momoRevenue, ezwichRevenue, powerRevenue, jumiaRevenue;

    try {
      // Get revenue by service type
      [agencyRevenue, momoRevenue, ezwichRevenue, powerRevenue, jumiaRevenue] =
        await Promise.all([
          sql`SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(fee), 0) as fees FROM agency_banking_transactions WHERE status = 'completed' ${branchFilter} ${
            from && to
              ? sql`AND agency_banking_transactions.created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }`,
          sql`SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(fee), 0) as fees FROM momo_transactions WHERE status = 'completed' ${branchFilter} ${
            from && to
              ? sql`AND momo_transactions.created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }`,
          sql`SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(fee), 0) as fees FROM e_zwich_withdrawals WHERE status = 'completed' ${branchFilter} ${
            from && to
              ? sql`AND e_zwich_withdrawals.created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }`,
          sql`SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(fee), 0) as fees FROM power_transactions WHERE status = 'completed' ${branchFilter} ${
            from && to
              ? sql`AND power_transactions.created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }`,
          sql`SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(fee), 0) as fees FROM jumia_transactions WHERE status = 'completed' ${branchFilter} ${
            from && to
              ? sql`AND jumia_transactions.created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }`,
        ]);

      devLog.info("📊 Revenue results:", {
        agency: agencyRevenue[0],
        momo: momoRevenue[0],
        ezwich: ezwichRevenue[0],
        power: powerRevenue[0],
        jumia: jumiaRevenue[0],
      });
    } catch (dbError) {
      devLog.error("❌ Database error in revenue queries:", dbError);
      return NextResponse.json(
        {
          success: false,
          error: "Database connection error",
          details:
            dbError instanceof Error
              ? dbError.message
              : "Unknown database error",
        },
        { status: 500 }
      );
    }

    // Revenue breakdown - FEES ONLY (not amounts)
    const revenueBreakdown = [
      {
        service: "Agency Banking",
        note: 12,
        amount: Number(agencyRevenue[0].fees) || 0,
      },
      {
        service: "MoMo",
        note: 13,
        amount: Number(momoRevenue[0].fees) || 0,
      },
      {
        service: "E-Zwich",
        note: 14,
        amount: Number(ezwichRevenue[0].fees) || 0,
      },
      {
        service: "Power",
        note: 15,
        amount: Number(powerRevenue[0].fees) || 0,
      },
      {
        service: "Jumia",
        note: 16,
        amount: Number(jumiaRevenue[0].fees) || 0,
      },
    ];

    const totalRevenue = revenueBreakdown.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // EXPENSES SECTION
    // Get expenses by category
    const expensesByCategory = await sql`
      SELECT 
        COALESCE(eh.category, 'Uncategorized') as category,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(*) as count
      FROM expenses e
      LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
      WHERE e.status IN ('approved', 'paid') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND e.branch_id = ${effectiveBranchId}`
          : sql``
      } ${
      from && to ? sql`AND e.created_at::date BETWEEN ${from} AND ${to}` : sql``
    }
      GROUP BY eh.category
      ORDER BY total_amount DESC
    `;

    // Map to standardized categories with notes
    const categoryMap: Record<string, { note: number; label: string }> = {
      administrative: { note: 17, label: "Administrative" },
      "human resources": { note: 18, label: "Human Resources" },
      marketing: { note: 19, label: "Marketing" },
      operational: { note: 20, label: "Operational" },
    };

    const expensesBreakdown = [
      {
        category: "Administrative",
        note: 17,
        amount: 0,
      },
      {
        category: "Human Resources",
        note: 18,
        amount: 0,
      },
      {
        category: "Marketing",
        note: 19,
        amount: 0,
      },
      {
        category: "Operational",
        note: 20,
        amount: 0,
      },
    ];

    // Populate expenses from database results
    expensesByCategory.forEach((expense) => {
      const categoryLower = (expense.category || "").toLowerCase();
      const amount = Number(expense.total_amount) || 0;

      if (categoryLower.includes("admin")) {
        expensesBreakdown[0].amount += amount;
      } else if (
        categoryLower.includes("human") ||
        categoryLower.includes("hr") ||
        categoryLower.includes("staff") ||
        categoryLower.includes("salary")
      ) {
        expensesBreakdown[1].amount += amount;
      } else if (categoryLower.includes("market")) {
        expensesBreakdown[2].amount += amount;
      } else {
        // Default to operational
        expensesBreakdown[3].amount += amount;
      }
    });

    const totalExpenses = expensesBreakdown.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // COMMISSIONS
    const commissionsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM commissions 
      WHERE status IN ('approved', 'paid') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND commissions.branch_id = ${effectiveBranchId}`
          : sql``
      } ${
      from && to
        ? sql`AND commissions.created_at::date BETWEEN ${from} AND ${to}`
        : sql``
    }
    `;
    const totalCommissions =
      Number(commissionsResult[0].total_commissions) || 0;

    // Calculate profit/loss
    const grossProfit = totalRevenue - totalExpenses;
    const netProfit = grossProfit + totalCommissions;
    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        period: { from, to },

        // REVENUE (Fees only)
        revenue: {
          breakdown: revenueBreakdown,
          total: totalRevenue,
        },

        // EXPENSES (By category)
        expenses: {
          breakdown: expensesBreakdown,
          total: totalExpenses,
        },

        // Gross Profit/Loss
        grossProfit,

        // COMMISSIONS
        commissions: {
          note: 21,
          total: totalCommissions,
        },

        // Net Profit/Loss
        netProfit,

        // Summary
        summary: {
          totalRevenue,
          totalExpenses,
          grossProfit,
          totalCommissions,
          netProfit,
          profitMargin,
        },

        branchFilter: effectiveBranchId,
        generatedBy: user.name || user.email,
      },
    });
  } catch (error) {
    console.error("Error generating profit & loss report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate profit & loss report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
