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
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;

    // Date filter for transactions
    const dateFilter =
      from && to ? sql`AND created_at::date BETWEEN ${from} AND ${to}` : sql``;

    // ==================== ASSETS SECTION ====================

    // 1. NON-CURRENT ASSETS
    // Fixed Assets (Net Book Value from Fixed Assets Register)
    // Note: current_value already represents the net book value (purchase_cost - depreciation)
    // We should NOT subtract accumulated_depreciation again to avoid double-deduction
    const fixedAssetsResult = await sql`
      SELECT 
        COALESCE(SUM(current_value), 0) as total_nbv
      FROM fixed_assets 
      WHERE status = 'active' ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;
    const fixedAssetsNBV = Number(fixedAssetsResult[0].total_nbv) || 0;
    const totalNonCurrentAssets = fixedAssetsNBV;

    // 2. CURRENT ASSETS
    // Cash and Cash Equivalents (Positive balances only)
    const cashResult = await sql`
      SELECT COALESCE(SUM(current_balance), 0) as total_cash
      FROM float_accounts 
      WHERE is_active = true 
        AND current_balance > 0
        ${branchFilter}
    `;
    const cashAndCashEquivalents = Number(cashResult[0].total_cash) || 0;

    // Accounts Receivable (Unapproved/Pending Commissions)
    const receivablesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_receivables
      FROM commissions 
      WHERE status IN ('pending') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const accountsReceivable =
      Number(receivablesResult[0].total_receivables) || 0;

    // Closing Inventory (Available E-Zwich cards × unit cost)
    const inventoryResult = await sql`
      SELECT 
        COALESCE(SUM(quantity_available * unit_cost), 0) as total_inventory_value
      FROM ezwich_card_batches 
      WHERE quantity_available > 0 
        ${branchFilter}
    `;
    const closingInventory =
      Number(inventoryResult[0].total_inventory_value) || 0;

    const totalCurrentAssets =
      cashAndCashEquivalents + accountsReceivable + closingInventory;
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    // ==================== EQUITIES AND LIABILITIES SECTION ====================

    // Ensure system_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) UNIQUE NOT NULL,
        value DECIMAL(15,2) DEFAULT 0,
        description TEXT,
        updated_by VARCHAR(255),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 1. SHAREHOLDERS FUND (EQUITY)
    // Share Capital (from equity transactions ledger)
    const shareCapitalResult = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE ledger_type = 'share_capital'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      ${from && to ? sql`AND transaction_date <= ${to}` : sql``}
    `;
    const shareCapital = Number(shareCapitalResult[0]?.balance) || 0;

    // Retained Earnings (from equity transactions ledger - before current period)
    const retainedEarningsResult = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE ledger_type = 'retained_earnings'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      ${from ? sql`AND transaction_date < ${from}` : sql``}
    `;
    const retainedEarnings = Number(retainedEarningsResult[0]?.balance) || 0;

    // Other Fund (from equity transactions ledger)
    const otherFundResult = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE ledger_type = 'other_fund'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      ${from && to ? sql`AND transaction_date <= ${to}` : sql``}
    `;
    const otherFund = Number(otherFundResult[0]?.balance) || 0;

    // Profit for the Year (Total Revenue - Total Expenses for the period)
    // Total Revenue = Fees + Commissions from all services
    const revenueResult = await sql`
      SELECT 
        COALESCE(SUM(fee), 0) as total_fees
      FROM (
        SELECT fee FROM agency_banking_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
        UNION ALL
        SELECT fee FROM momo_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
        UNION ALL
        SELECT fee FROM e_zwich_withdrawals WHERE status = 'completed' ${branchFilter} ${dateFilter}
        UNION ALL
        SELECT fee FROM power_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
        UNION ALL
        SELECT COALESCE(fee, 0) FROM jumia_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
      ) all_fees
    `;
    const totalFees = Number(revenueResult[0].total_fees) || 0;

    const commissionsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM commissions 
      WHERE status IN ('approved', 'paid') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const totalCommissions =
      Number(commissionsResult[0].total_commissions) || 0;
    const totalRevenue = totalFees + totalCommissions;

    // Total Expenses (Approved expenses only)
    const expensesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses 
      WHERE status IN ('approved', 'paid') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const totalExpenses = Number(expensesResult[0].total_expenses) || 0;

    const profitForTheYear = totalRevenue - totalExpenses;
    const totalEquity =
      shareCapital + retainedEarnings + otherFund + profitForTheYear;

    // 2. CURRENT LIABILITIES
    // Accounts Payable (Pending/Unapproved Expenses)
    const payablesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_payables
      FROM expenses 
      WHERE status = 'pending' ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const accountsPayable = Number(payablesResult[0].total_payables) || 0;

    // Bank Overdraft (Negative bank float balances)
    const overdraftResult = await sql`
      SELECT COALESCE(SUM(ABS(current_balance)), 0) as total_overdraft
      FROM float_accounts 
      WHERE is_active = true 
        AND current_balance < 0
        AND account_type IN ('bank', 'agency-banking')
        ${branchFilter}
    `;
    const bankOverdraft = Number(overdraftResult[0].total_overdraft) || 0;

    // Settlement Arrears (Negative Jumia float balance)
    const settlementsResult = await sql`
      SELECT COALESCE(SUM(ABS(current_balance)), 0) as total_arrears
      FROM float_accounts 
      WHERE is_active = true 
        AND current_balance < 0
        AND account_type = 'jumia'
        ${branchFilter}
    `;
    const settlementsArrears = Number(settlementsResult[0].total_arrears) || 0;

    const totalCurrentLiabilities =
      accountsPayable + bankOverdraft + settlementsArrears;

    // 3. NON-CURRENT LIABILITIES
    // Bank Loan (from system settings or negative long-term liability accounts)
    const bankLoanResult = await sql`
      SELECT COALESCE(CAST(value AS DECIMAL), 0) as loan_value
      FROM system_settings
      WHERE key = 'bank_loan'
      LIMIT 1
    `;
    const bankLoan = Number(bankLoanResult[0]?.loan_value) || 0;
    const totalNonCurrentLiabilities = bankLoan;

    const totalLiabilities =
      totalCurrentLiabilities + totalNonCurrentLiabilities;
    const totalEquityAndLiabilities = totalEquity + totalLiabilities;

    // Balance Check
    const balanceCheck =
      Math.abs(totalAssets - totalEquityAndLiabilities) < 0.01;

    return NextResponse.json({
      success: true,
      data: {
        asOf: to || new Date().toISOString().split("T")[0],
        period: {
          from: from || null,
          to: to || null,
        },

        // ASSETS
        assets: {
          nonCurrent: {
            fixedAssetsNet: { note: 1, value: fixedAssetsNBV },
            total: totalNonCurrentAssets,
          },
          current: {
            cashAndCashEquivalents: { note: 2, value: cashAndCashEquivalents },
            accountsReceivable: { note: 3, value: accountsReceivable },
            closingInventory: { note: 4, value: closingInventory },
            total: totalCurrentAssets,
          },
          totalAssets,
        },

        // EQUITIES AND LIABILITIES
        equity: {
          shareholdersFund: {
            equities: { note: 5, value: shareCapital },
            retainedEarnings: { note: 6, value: retainedEarnings },
            profitForTheYear: { note: 7, value: profitForTheYear },
            otherFund: otherFund,
            total: totalEquity,
          },
        },
        liabilities: {
          current: {
            accountsPayable: { note: 8, value: accountsPayable },
            bankOverdraft: { note: 9, value: bankOverdraft },
            settlementsArrears: { note: 10, value: settlementsArrears },
            total: totalCurrentLiabilities,
          },
          nonCurrent: {
            bankLoan: { note: 11, value: bankLoan },
            total: totalNonCurrentLiabilities,
          },
          totalLiabilities,
        },
        totalEquityAndLiabilities,

        // Summary
        summary: {
          totalAssets,
          totalEquityAndLiabilities,
          balanceCheck,
          difference: totalAssets - totalEquityAndLiabilities,
        },

        // Additional Info
        branchFilter: effectiveBranchId,
        generatedBy: user.name || user.email,

        // Revenue & Expense Breakdown (for reference)
        revenueBreakdown: {
          totalFees,
          totalCommissions,
          totalRevenue,
        },
        expenseBreakdown: {
          totalExpenses,
        },
      },
    });
  } catch (error) {
    devLog.error("Error generating balance sheet:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate balance sheet",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
