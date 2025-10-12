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
    const effectiveBranchId = user.role === "Admin" ? branch : user.branchId;

    // Date filter
    const dateFilter =
      from && to ? sql`AND created_at::date BETWEEN ${from} AND ${to}` : sql``;

    // EQUITY COMPONENTS

    // 1. Share Capital (Initial investment - represented by float accounts)
    const shareCapitalResult = await sql`
      SELECT COALESCE(SUM(current_balance), 0) as total_float
      FROM float_accounts 
      WHERE is_active = true ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND float_accounts.branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;
    const shareCapital = Number(shareCapitalResult[0].total_float) || 0;

    // 2. Retained Earnings (Net income from operations)
    const revenueResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_revenue
      FROM (
        SELECT amount FROM agency_banking_transactions WHERE status = 'completed' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND agency_banking_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM momo_transactions WHERE status = 'completed' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND momo_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM e_zwich_withdrawals WHERE status = 'completed' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND e_zwich_withdrawals.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM power_transactions WHERE status = 'completed' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND power_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM jumia_transactions WHERE status = 'completed' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND jumia_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
      ) completed_transactions
    `;
    const totalRevenue = Number(revenueResult[0].total_revenue) || 0;

    const expensesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses 
      WHERE status IN ('approved', 'paid') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND expenses.branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const totalExpenses = Number(expensesResult[0].total_expenses) || 0;

    const retainedEarnings = totalRevenue - totalExpenses;

    // 3. Other Reserves (Commissions and other income)
    const commissionsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM commissions 
      WHERE status IN ('approved', 'paid') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND commissions.branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const otherReserves = Number(commissionsResult[0].total_commissions) || 0;

    // 4. Fixed Assets (Net book value)
    const fixedAssetsResult = await sql`
      SELECT COALESCE(SUM(current_value), 0) as net_book_value
      FROM fixed_assets 
      WHERE status = 'active' ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND fixed_assets.branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;
    const fixedAssetsEquity = Number(fixedAssetsResult[0].net_book_value) || 0;

    // Calculate total equity
    const totalEquity =
      shareCapital + retainedEarnings + otherReserves + fixedAssetsEquity;

    // Get equity transactions (commissions)
    const equityTransactions = await sql`
      SELECT 
        source,
        source_name,
        amount,
        month,
        status,
        created_at
      FROM commissions 
      WHERE status IN ('approved', 'paid') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND commissions.branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: {
        period: { from, to },
        summary: {
          totalEquity,
          shareCapital,
          retainedEarnings,
          otherReserves,
          fixedAssetsEquity,
          equityAccounts: 4, // Share Capital, Retained Earnings, Other Reserves, Fixed Assets
          totalTransactions: equityTransactions.length,
        },
        components: [
          {
            name: "Share Capital",
            amount: shareCapital,
            description: "Initial investment in float accounts",
          },
          {
            name: "Retained Earnings",
            amount: retainedEarnings,
            description: "Net income from operations",
          },
          {
            name: "Other Reserves",
            amount: otherReserves,
            description: "Commissions and other income",
          },
          {
            name: "Fixed Assets",
            amount: fixedAssetsEquity,
            description: "Net book value of fixed assets",
          },
        ],
        transactions: equityTransactions,
        branchFilter: effectiveBranchId,
        generatedBy: user.name || user.email,
      },
    });
  } catch (error) {
    devLog.error("Error generating equity report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate equity report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
