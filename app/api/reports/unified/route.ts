import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { devLog } from "@/lib/dev-logger";

const sql = neon(process.env.DATABASE_URL!);

/**
 * UNIFIED REPORTS API - Single call to fetch all report data
 * This reduces API calls from 7+ to just 1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branch = searchParams.get("branch");

    // Authenticate once
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permissions once
    const isAdmin = user.role === "Admin";
    const isFinance = user.role === "Finance";
    const isManager = user.role === "Manager";

    if (!isAdmin && !isFinance && !isManager) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Determine effective branch filter once
    const effectiveBranchId = isAdmin ? branch : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;
    const dateFilter =
      from && to ? sql`AND created_at::date BETWEEN ${from} AND ${to}` : sql``;

    // Set default dates for depreciation calculation
    const depreciationStartDate = from || "1900-01-01";
    const depreciationEndDate = to || new Date().toISOString().split("T")[0];

    // Execute all queries in parallel for maximum performance
    const [
      agencyStats,
      momoStats,
      ezwichStats,
      powerStats,
      jumiaStats,
      commissionsResult,
      expensesResult,
      expensesByCategory,
      cashResult,
      fixedAssetsResult,
      receivablesResult,
      inventoryResult,
      equityBalances,
      payablesResult,
      jumiaFloatResult,
      overdraftResult,
      bankLoanResult,
      depreciationResult,
    ] = await Promise.all([
      // Revenue queries
      sql`SELECT COUNT(*) as transactions, COALESCE(SUM(amount),0) as volume, COALESCE(SUM(fee),0) as fees FROM agency_banking_transactions WHERE status IN ('completed', 'disbursed') ${branchFilter} ${dateFilter}`,
      sql`SELECT COUNT(*) as transactions, COALESCE(SUM(amount),0) as volume, COALESCE(SUM(fee),0) as fees FROM momo_transactions WHERE status IN ('completed', 'disbursed') ${branchFilter} ${dateFilter}`,
      sql`SELECT COUNT(*) as transactions, COALESCE(SUM(amount),0) as volume, COALESCE(SUM(fee),0) as fees FROM e_zwich_withdrawals WHERE status IN ('completed', 'disbursed') ${branchFilter} ${dateFilter}`,
      sql`SELECT COUNT(*) as transactions, COALESCE(SUM(amount),0) as volume, COALESCE(SUM(fee),0) as fees FROM power_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}`,
      sql`SELECT COUNT(*) as transactions, COALESCE(SUM(amount),0) as volume, COALESCE(SUM(fee),0) as fees FROM jumia_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}`,

      // Commissions
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE status IN ('approved', 'paid') ${branchFilter} ${dateFilter}`,

      // Expenses
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status IN ('approved', 'paid') ${branchFilter} ${
        from && to ? sql`AND expense_date BETWEEN ${from} AND ${to}` : sql``
      }`,

      // Expenses by category
      sql`SELECT COALESCE(eh.category, 'Uncategorized') as category, COALESCE(SUM(e.amount), 0) as total_amount, COUNT(*) as count FROM expenses e LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id WHERE e.status IN ('approved', 'paid') ${branchFilter} ${
        from && to ? sql`AND e.expense_date BETWEEN ${from} AND ${to}` : sql``
      } GROUP BY eh.category ORDER BY total_amount DESC`,

      // Cash position (excluding Jumia - we don't own it)
      sql`SELECT COALESCE(SUM(current_balance),0) as total FROM float_accounts WHERE is_active = true AND account_type != 'jumia' ${branchFilter}`,

      // Fixed assets
      sql`SELECT COALESCE(SUM(current_value), 0) as total_nbv, COALESCE(SUM(purchase_cost), 0) as total_cost, COUNT(*) as total_assets FROM fixed_assets WHERE status = 'active' ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }`,

      // Accounts receivable (pending/approved commissions - money owed to agents)
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE status IN ('pending', 'approved') ${branchFilter} ${dateFilter}`,

      // Closing inventory
      sql`SELECT COALESCE(SUM(quantity_available * unit_cost), 0) as total FROM ezwich_card_batches WHERE quantity_available > 0 ${branchFilter}`,

      // Equity balances
      sql`SELECT ledger_type, COALESCE(SUM(credit - debit), 0) as balance FROM equity_transactions WHERE 1=1 ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      } ${
        from && to ? sql`AND transaction_date <= ${to}` : sql``
      } GROUP BY ledger_type`,

      // Accounts payable (expenses)
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'pending' ${branchFilter} ${
        from && to ? sql`AND expense_date BETWEEN ${from} AND ${to}` : sql``
      }`,

      // Jumia Float (money held for Jumia - it's a liability)
      sql`SELECT COALESCE(SUM(ABS(current_balance)), 0) as total FROM float_accounts WHERE is_active = true AND account_type = 'jumia' ${branchFilter}`,

      // Bank overdraft
      sql`SELECT COALESCE(SUM(ABS(current_balance)), 0) as total FROM float_accounts WHERE is_active = true AND current_balance < 0 AND account_type IN ('agency-banking') ${branchFilter}`,

      // Bank loan
      sql`SELECT COALESCE(value, '0') as value FROM system_settings WHERE key = 'bank_loan' LIMIT 1`,

      // Depreciation (calculate for the period) - with details
      sql`
        SELECT 
          COALESCE(SUM(period_dep), 0) as period_depreciation,
          COUNT(*) as asset_count,
          COALESCE(SUM(annual_dep), 0) as total_annual_depreciation
        FROM (
          SELECT 
            name,
            purchase_cost,
            salvage_value,
            useful_life,
            purchase_date,
            ((purchase_cost - COALESCE(salvage_value, 0)) / NULLIF(useful_life, 0)) as annual_dep,
            CASE 
              -- If asset was purchased during the period, calculate from purchase date to end of period
              WHEN purchase_date::date >= ${depreciationStartDate}::date 
                THEN ((purchase_cost - COALESCE(salvage_value, 0)) / NULLIF(useful_life, 0)) 
                     * (EXTRACT(EPOCH FROM AGE(${depreciationEndDate}::date, purchase_date::date)) / (365.0 * 86400))
              -- If asset existed before period, calculate for full period
              ELSE ((purchase_cost - COALESCE(salvage_value, 0)) / NULLIF(useful_life, 0)) 
                   * (EXTRACT(EPOCH FROM AGE(${depreciationEndDate}::date, ${depreciationStartDate}::date)) / (365.0 * 86400))
            END as period_dep
          FROM fixed_assets 
          WHERE status = 'active'
            AND purchase_date::date <= ${depreciationEndDate}::date
            ${
              effectiveBranchId && effectiveBranchId !== "all"
                ? sql`AND branch_id = ${effectiveBranchId}`
                : sql``
            }
        ) asset_depreciation
      `,
    ]);

    // Calculate revenue and expenses
    const agencyFees = Number(agencyStats[0].fees) || 0;
    const momoFees = Number(momoStats[0].fees) || 0;
    const ezwichFees = Number(ezwichStats[0].fees) || 0;
    const powerFees = Number(powerStats[0].fees) || 0;
    const jumiaFees = Number(jumiaStats[0].fees) || 0;

    const totalServiceFees =
      agencyFees + momoFees + ezwichFees + powerFees + jumiaFees;

    const totalCommissions = Number(commissionsResult[0].total) || 0;
    // Revenue = Service fees + Commissions (commissions are revenue!)
    const totalFees = totalServiceFees;
    const totalRevenue = totalFees + totalCommissions;
    const totalExpenses = Number(expensesResult[0].total) || 0;
    // Net Income = Total Revenue - Expenses
    const netIncome = totalRevenue - totalExpenses;
    const cashPosition = Number(cashResult[0].total) || 0;
    const depreciation = Number(depreciationResult[0].period_depreciation) || 0;

    // Enhanced logging for debugging
    devLog.info("Unified Reports - Fee Breakdown:", {
      agencyFees: `GHS ${agencyFees.toFixed(2)} (${Number(
        agencyStats[0].transactions
      )} txns)`,
      momoFees: `GHS ${momoFees.toFixed(2)} (${Number(
        momoStats[0].transactions
      )} txns)`,
      ezwichFees: `GHS ${ezwichFees.toFixed(2)} (${Number(
        ezwichStats[0].transactions
      )} txns)`,
      powerFees: `GHS ${powerFees.toFixed(2)} (${Number(
        powerStats[0].transactions
      )} txns)`,
      jumiaFees: `GHS ${jumiaFees.toFixed(2)} (${Number(
        jumiaStats[0].transactions
      )} txns)`,
      totalServiceFees: `GHS ${totalServiceFees.toFixed(2)}`,
      totalCommissions: `GHS ${totalCommissions.toFixed(2)}`,
      totalRevenue: `GHS ${totalRevenue.toFixed(2)}`,
      totalExpenses: `GHS ${totalExpenses.toFixed(2)}`,
      netIncome: `GHS ${netIncome.toFixed(2)}`,
    });

    // Service breakdown
    const services = [
      {
        service: "AGENCY BANKING",
        transactions: Number(agencyStats[0].transactions),
        volume: Number(agencyStats[0].volume),
        fees: Number(agencyStats[0].fees),
      },
      {
        service: "MOMO",
        transactions: Number(momoStats[0].transactions),
        volume: Number(momoStats[0].volume),
        fees: Number(momoStats[0].fees),
      },
      {
        service: "E-ZWICH",
        transactions: Number(ezwichStats[0].transactions),
        volume: Number(ezwichStats[0].volume),
        fees: Number(ezwichStats[0].fees),
      },
      {
        service: "POWER",
        transactions: Number(powerStats[0].transactions),
        volume: Number(powerStats[0].volume),
        fees: Number(powerStats[0].fees),
      },
      {
        service: "JUMIA",
        transactions: Number(jumiaStats[0].transactions),
        volume: Number(jumiaStats[0].volume),
        fees: Number(jumiaStats[0].fees),
      },
    ];

    // Expense breakdown
    const expensesBreakdown = [
      { category: "Administrative", note: 17, amount: 0 },
      { category: "Human Resources", note: 18, amount: 0 },
      { category: "Marketing", note: 19, amount: 0 },
      { category: "Operational", note: 20, amount: 0 },
    ];

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
        expensesBreakdown[3].amount += amount;
      }
    });

    // Revenue breakdown for P&L
    const revenueBreakdown = [
      {
        service: "Agency Banking",
        note: 12,
        amount: Number(agencyStats[0].fees) || 0,
      },
      { service: "MoMo", note: 13, amount: Number(momoStats[0].fees) || 0 },
      {
        service: "E-Zwich",
        note: 14,
        amount: Number(ezwichStats[0].fees) || 0,
      },
      { service: "Power", note: 15, amount: Number(powerStats[0].fees) || 0 },
      { service: "Jumia", note: 16, amount: Number(jumiaStats[0].fees) || 0 },
    ];

    // Balance sheet data
    const fixedAssetsNBV = Number(fixedAssetsResult[0].total_nbv) || 0;
    const cashAndCashEquivalents = cashPosition > 0 ? cashPosition : 0;
    const accountsReceivable = Number(receivablesResult[0].total) || 0;
    const closingInventory = Number(inventoryResult[0].total) || 0;

    const shareCapital =
      Number(
        equityBalances.find((b) => b.ledger_type === "share_capital")?.balance
      ) || 0;
    const retainedEarnings =
      Number(
        equityBalances.find((b) => b.ledger_type === "retained_earnings")
          ?.balance
      ) || 0;
    const otherFund =
      Number(
        equityBalances.find((b) => b.ledger_type === "other_fund")?.balance
      ) || 0;

    devLog.info("Equity Balances:", {
      shareCapital: `GHS ${shareCapital.toFixed(2)}`,
      retainedEarnings: `GHS ${retainedEarnings.toFixed(2)}`,
      otherFund: `GHS ${otherFund.toFixed(2)}`,
      totalEquityRecords: equityBalances.length,
      note:
        equityBalances.length === 0
          ? "⚠️ No equity transactions found - table may not exist"
          : "Equity data loaded",
    });

    const accountsPayable =
      (Number(payablesResult[0].total) || 0) +
      (Number(jumiaFloatResult[0].total) || 0); // Includes expenses + Jumia float
    const bankOverdraft = Number(overdraftResult[0].total) || 0;
    const bankLoan = Number(bankLoanResult[0]?.value) || 0;

    const totalNonCurrentAssets = fixedAssetsNBV;
    const totalCurrentAssets =
      cashAndCashEquivalents + accountsReceivable + closingInventory;
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    const profitForTheYear = netIncome;
    const totalEquity =
      Number(shareCapital) +
      Number(retainedEarnings) +
      Number(otherFund) +
      profitForTheYear;

    const totalCurrentLiabilities = accountsPayable + bankOverdraft;
    const totalNonCurrentLiabilities = bankLoan;
    const totalLiabilities =
      totalCurrentLiabilities + totalNonCurrentLiabilities;
    const totalEquityAndLiabilities = totalEquity + totalLiabilities;

    const balanceCheck =
      Math.abs(totalAssets - totalEquityAndLiabilities) < 0.01;

    // Gross profit and net profit
    // Net Profit = Total Revenue - Expenses (commissions are part of revenue)
    const netProfit = totalRevenue - totalExpenses;

    devLog.info("Balance Sheet Summary:", {
      totalAssets: `GHS ${totalAssets.toFixed(2)}`,
      totalLiabilities: `GHS ${totalLiabilities.toFixed(2)}`,
      totalEquity: `GHS ${totalEquity.toFixed(2)}`,
      totalEquityAndLiabilities: `GHS ${totalEquityAndLiabilities.toFixed(2)}`,
      difference: `GHS ${(totalAssets - totalEquityAndLiabilities).toFixed(2)}`,
      balanceCheck: balanceCheck ? "Balanced" : "Unbalanced",
    });

    devLog.info("Profit & Loss Summary:", {
      totalFees: `GHS ${totalFees.toFixed(2)}`,
      totalCommissions: `GHS ${totalCommissions.toFixed(2)}`,
      totalRevenue: `GHS ${totalRevenue.toFixed(2)}`,
      totalExpenses: `GHS ${totalExpenses.toFixed(2)}`,
      netProfit: `GHS ${netProfit.toFixed(2)}`,
      profitMargin: `${((netProfit / (totalRevenue || 1)) * 100).toFixed(2)}%`,
    });

    return NextResponse.json({
      success: true,
      data: {
        // Summary
        summary: {
          totalFees: totalServiceFees,
          totalCommissions,
          totalRevenue,
          totalExpenses,
          netIncome,
          cashPosition,
          profitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
          revenueChange: 0,
          expenseChange: 0,
        },
        services,
        hasData: totalRevenue > 0 || totalExpenses > 0,
        lastUpdated: new Date().toISOString(),

        // Balance Sheet
        balanceSheet: {
          asOf: to || new Date().toISOString().split("T")[0],
          period: { from, to },
          assets: {
            nonCurrent: {
              fixedAssetsNet: { note: 1, value: fixedAssetsNBV },
              total: totalNonCurrentAssets,
            },
            current: {
              cashAndCashEquivalents: {
                note: 2,
                value: cashAndCashEquivalents,
              },
              accountsReceivable: { note: 3, value: accountsReceivable },
              closingInventory: { note: 4, value: closingInventory },
              total: totalCurrentAssets,
            },
            totalAssets,
          },
          equity: {
            shareholdersFund: {
              equities: { note: 5, value: Number(shareCapital) },
              retainedEarnings: { note: 6, value: Number(retainedEarnings) },
              profitForTheYear: { note: 7, value: profitForTheYear },
              otherFund: Number(otherFund),
              total: totalEquity,
            },
          },
          liabilities: {
            current: {
              accountsPayable: { note: 8, value: accountsPayable },
              bankOverdraft: { note: 9, value: bankOverdraft },
              // settlementsArrears removed - Jumia float now in accountsPayable
              total: totalCurrentLiabilities,
            },
            nonCurrent: {
              bankLoan: { note: 11, value: bankLoan },
              total: totalNonCurrentLiabilities,
            },
            totalLiabilities,
          },
          totalEquityAndLiabilities,
          summary: {
            totalAssets,
            totalEquityAndLiabilities,
            balanceCheck,
            difference: totalAssets - totalEquityAndLiabilities,
          },
        },

        // Profit & Loss
        profitLoss: {
          period: { from, to },
          fees: {
            breakdown: revenueBreakdown,
            total: totalFees,
          },
          commissions: {
            note: 21,
            total: totalCommissions,
          },
          totalRevenue,
          expenses: {
            breakdown: expensesBreakdown,
            total: totalExpenses,
          },
          netProfit,
          summary: {
            totalFees,
            totalCommissions,
            totalRevenue,
            totalExpenses,
            netProfit,
            profitMargin:
              totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
          },
        },

        // Fixed Assets
        fixedAssets: {
          summary: {
            totalAssets: Number(fixedAssetsResult[0].total_assets) || 0,
            totalCurrentValue: fixedAssetsNBV,
            totalPurchaseCost: Number(fixedAssetsResult[0].total_cost) || 0,
          },
          assets: [],
          categoryBreakdown: [],
        },

        // Expenses
        expenses: {
          summary: {
            totalAmount: totalExpenses,
            paidAmount: totalExpenses,
            pendingAmount: accountsPayable,
          },
          categoryBreakdown: expensesByCategory.map((cat) => ({
            category: cat.category,
            count: Number(cat.count),
            total_amount: Number(cat.total_amount),
          })),
          expenseHeadBreakdown: [],
        },

        // Equity (simple version - full version via separate endpoint if needed)
        equity: {
          summary: {
            totalEquity,
          },
          components: [
            { name: "Share Capital", amount: Number(shareCapital) },
            { name: "Retained Earnings", amount: Number(retainedEarnings) },
            { name: "Other Fund", amount: Number(otherFund) },
            { name: "Profit for the Year", amount: profitForTheYear },
          ],
        },

        // Cash Flow
        cashFlow: {
          period: { from, to },
          operatingActivities: {
            netIncome,
            depreciation: depreciation,
            accountsReceivable: -accountsReceivable,
            accountsPayable: accountsPayable,
            netCashFromOperations:
              netIncome + depreciation + accountsPayable - accountsReceivable,
          },
          investingActivities: {
            purchaseOfFixedAssets: 0,
            netCashFromInvesting: 0,
          },
          financingActivities: {
            dividendsPaid: 0,
            netCashFromFinancing: 0,
          },
          summary: {
            netChangeInCash:
              netIncome + depreciation + accountsPayable - accountsReceivable,
            endingCashBalance: cashPosition,
          },
        },

        // Metadata
        generatedBy: user.name || user.email,
        branchFilter: effectiveBranchId,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    devLog.error("Error fetching unified reports:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch reports data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
