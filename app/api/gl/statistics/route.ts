import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.CONNECTION_STRING!);

export async function GET(request) {
  try {
    // Get user context
    const user = await getCurrentUser(request);
    if (!user || user.id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse branchId from query or use user's branchId
    const url = request.nextUrl || request.url || {};
    const searchParams =
      url.searchParams || new URL(url, "http://localhost").searchParams;
    let branchId = searchParams.get("branchId");
    if (!branchId && user.role !== "Admin") {
      branchId = user.branchId;
    }

    // Build branch filter SQL
    const branchFilter = branchId ? sql`AND branch_id = ${branchId}` : sql``;
    const branchFilterWhere = branchId
      ? sql`WHERE branch_id = ${branchId}`
      : sql``;

    // Get account statistics
    const accountStats = await sql`
      SELECT 
        COUNT(*) as total_accounts,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_accounts,
        COUNT(CASE WHEN type = 'Asset' AND is_active = true THEN 1 END) as asset_accounts,
        COUNT(CASE WHEN type = 'Liability' AND is_active = true THEN 1 END) as liability_accounts,
        COUNT(CASE WHEN type = 'Equity' AND is_active = true THEN 1 END) as equity_accounts,
        COUNT(CASE WHEN type = 'Revenue' AND is_active = true THEN 1 END) as revenue_accounts,
        COUNT(CASE WHEN type = 'Expense' AND is_active = true THEN 1 END) as expense_accounts
      FROM gl_accounts
      ${branchFilterWhere}
    `;

    // Get transaction statistics
    const transactionStats = await sql`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
        COUNT(CASE WHEN status = 'posted' THEN 1 END) as posted_transactions
      FROM gl_transactions
      ${branchFilterWhere}
    `;

    // Get debit/credit totals and calculate net position correctly
    const balanceStats = await sql`
      SELECT 
        COALESCE(SUM(debit), 0) as total_debits,
        COALESCE(SUM(credit), 0) as total_credits
      FROM gl_journal_entries je
      JOIN gl_transactions gt ON je.transaction_id = gt.id
      WHERE gt.status = 'posted'
      ${branchId ? sql`AND gt.branch_id = ${branchId}` : sql``}
    `;

    // Get net position by account type (for proper financial position)
    const netPositionByType = await sql`
      WITH account_balances AS (
        SELECT 
          a.id, 
          a.code, 
          a.name, 
          a.type,
          CASE 
            WHEN a.type IN ('Asset', 'Expense') THEN COALESCE(SUM(je.debit), 0) - COALESCE(SUM(je.credit), 0)
            WHEN a.type IN ('Liability', 'Equity', 'Revenue') THEN COALESCE(SUM(je.credit), 0) - COALESCE(SUM(je.debit), 0)
          END as net_balance
        FROM gl_accounts a
        LEFT JOIN gl_journal_entries je ON a.id = je.account_id
        LEFT JOIN gl_transactions gt ON je.transaction_id = gt.id AND gt.status = 'posted'
        WHERE a.is_active = true
        ${branchId ? sql`AND a.branch_id = ${branchId}` : sql``}
        GROUP BY a.id, a.code, a.name, a.type
      )
      SELECT
        SUM(CASE WHEN type = 'Asset' THEN net_balance ELSE 0 END) as assets,
        SUM(CASE WHEN type = 'Liability' THEN net_balance ELSE 0 END) as liabilities,
        SUM(CASE WHEN type = 'Equity' THEN net_balance ELSE 0 END) as equity,
        SUM(CASE WHEN type = 'Revenue' THEN net_balance ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'Expense' THEN net_balance ELSE 0 END) as expenses
      FROM account_balances
    `;

    // Get recent activity by module (last 30 days)
    const recentActivity = await sql`
      SELECT 
        source_module as module,
        COUNT(*) as count,
        COALESCE(SUM(je.debit + je.credit), 0) as amount
      FROM gl_transactions gt
      JOIN gl_journal_entries je ON gt.id = je.transaction_id
      WHERE gt.created_at >= NOW() - INTERVAL '30 days'
        AND gt.status = 'posted'
        ${branchId ? sql`AND gt.branch_id = ${branchId}` : sql``}
      GROUP BY source_module
      ORDER BY amount DESC
      LIMIT 10
    `;

    const accountStatsRow = accountStats[0];
    const transactionStatsRow = transactionStats[0];
    const balanceStatsRow = balanceStats[0];
    const netPositionRow = netPositionByType[0];

    const totalDebits = Number.parseFloat(balanceStatsRow.total_debits) || 0;
    const totalCredits = Number.parseFloat(balanceStatsRow.total_credits) || 0;
    const balanceDifference = totalDebits - totalCredits;
    const isBalanced = Math.abs(balanceDifference) < 0.01;

    // Calculate actual net position (profit/loss)
    const assets = Number.parseFloat(netPositionRow.assets) || 0;
    const liabilities = Number.parseFloat(netPositionRow.liabilities) || 0;
    const equity = Number.parseFloat(netPositionRow.equity) || 0;
    const revenue = Number.parseFloat(netPositionRow.revenue) || 0;
    const expenses = Number.parseFloat(netPositionRow.expenses) || 0;

    // Get Fixed Assets (Net Book Value) from inventory
    const fixedAssetsResult = await sql`
      SELECT COALESCE(SUM(purchase_cost - COALESCE(accumulated_depreciation, 0)), 0) as net_book_value
      FROM fixed_assets
      WHERE status = 'active'
      ${branchId ? sql`AND branch_id = ${branchId}` : sql``}
    `;
    const fixedAssetsNBV =
      Number.parseFloat(fixedAssetsResult[0]?.net_book_value) || 0;

    // Get Float Balances
    const floatBalancesResult = await sql`
      SELECT COALESCE(SUM(current_balance), 0) as total_float_balance
      FROM float_accounts
      WHERE is_active = true
      ${branchId ? sql`AND branch_id = ${branchId}` : sql``}
    `;
    const floatBalances =
      Number.parseFloat(floatBalancesResult[0]?.total_float_balance) || 0;

    // Financial Position (Total Assets) = Fixed Assets NBV + Float Balances
    const financialPosition = fixedAssetsNBV + floatBalances;

    // Get total revenue from fees and commissions
    const revenueResult = await sql`
      SELECT 
        COALESCE(SUM(je.credit - je.debit), 0) as total_revenue
      FROM gl_journal_entries je
      JOIN gl_transactions gt ON je.transaction_id = gt.id
      JOIN gl_accounts ga ON je.account_id = ga.id
      WHERE ga.type = 'Revenue'
        AND gt.status = 'posted'
        ${branchId ? sql`AND gt.branch_id = ${branchId}` : sql``}
    `;
    const totalRevenue =
      Number.parseFloat(revenueResult[0]?.total_revenue) || 0;

    // Get total approved expenses
    const expensesResult = await sql`
      SELECT 
        COALESCE(SUM(je.debit - je.credit), 0) as total_expenses
      FROM gl_journal_entries je
      JOIN gl_transactions gt ON je.transaction_id = gt.id
      JOIN gl_accounts ga ON je.account_id = ga.id
      WHERE ga.type = 'Expense'
        AND gt.status = 'posted'
        ${branchId ? sql`AND gt.branch_id = ${branchId}` : sql``}
    `;
    const totalExpenses =
      Number.parseFloat(expensesResult[0]?.total_expenses) || 0;

    // Net Position (Profit/Loss) = Total Revenue - Total Expenses
    const netPosition = totalRevenue - totalExpenses;

    const statistics = {
      totalAccounts: Number.parseInt(accountStatsRow.total_accounts) || 0,
      activeAccounts: Number.parseInt(accountStatsRow.active_accounts) || 0,
      totalTransactions:
        Number.parseInt(transactionStatsRow.total_transactions) || 0,
      totalDebits,
      totalCredits,
      isBalanced,
      balanceDifference,
      netPosition,
      financialPosition,
      fixedAssetsNBV,
      floatBalances,
      totalRevenue,
      totalExpenses,
      assets,
      liabilities,
      equity,
      pendingTransactions:
        Number.parseInt(transactionStatsRow.pending_transactions) || 0,
      postedTransactions:
        Number.parseInt(transactionStatsRow.posted_transactions) || 0,
      accountsByType: {
        Asset: Number.parseInt(accountStatsRow.asset_accounts) || 0,
        Liability: Number.parseInt(accountStatsRow.liability_accounts) || 0,
        Equity: Number.parseInt(accountStatsRow.equity_accounts) || 0,
        Revenue: Number.parseInt(accountStatsRow.revenue_accounts) || 0,
        Expense: Number.parseInt(accountStatsRow.expense_accounts) || 0,
      },
      recentActivity: recentActivity.map((row) => ({
        module: row.module,
        count: Number.parseInt(row.count) || 0,
        amount: Number.parseFloat(row.amount) || 0,
      })),
      lastSyncTime: new Date().toISOString(),
    };

    return NextResponse.json(statistics);
  } catch (error) {
    console.error("Error fetching GL statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch GL statistics" },
      { status: 500 }
    );
  }
}
