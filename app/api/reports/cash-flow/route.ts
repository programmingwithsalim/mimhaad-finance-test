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

    // OPERATING ACTIVITIES
    // Net Income
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

    const netIncome = totalRevenue - totalExpenses;

    // Depreciation (calculate for the period)
    // For each active asset, calculate depreciation for the reporting period
    // Annual Depreciation = (Purchase Cost - Salvage Value) / Useful Life
    // Period Depreciation = Annual Depreciation × (Days in Period / 365)

    // Set default dates for depreciation calculation
    const depreciationStartDate = from || "1900-01-01";
    const depreciationEndDate = to || new Date().toISOString().split("T")[0];

    const depreciationResult = await sql`
      SELECT 
        COALESCE(
          SUM(
            CASE 
              -- If asset was purchased during the period, calculate from purchase date to end of period
              WHEN purchase_date::date >= ${depreciationStartDate}::date 
                THEN ((purchase_cost - COALESCE(salvage_value, 0)) / NULLIF(useful_life, 0)) 
                     * (EXTRACT(EPOCH FROM AGE(${depreciationEndDate}::date, purchase_date::date)) / (365.0 * 86400))
              -- If asset existed before period, calculate for full period
              ELSE ((purchase_cost - COALESCE(salvage_value, 0)) / NULLIF(useful_life, 0)) 
                   * (EXTRACT(EPOCH FROM AGE(${depreciationEndDate}::date, ${depreciationStartDate}::date)) / (365.0 * 86400))
            END
          ), 
          0
        ) as period_depreciation
      FROM fixed_assets 
      WHERE status = 'active'
        AND purchase_date::date <= ${depreciationEndDate}::date
        ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND fixed_assets.branch_id = ${effectiveBranchId}`
            : sql``
        }
    `;

    const depreciation = Number(depreciationResult[0].period_depreciation) || 0;

    // Changes in Working Capital
    // Accounts Receivable (pending transactions)
    const receivablesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_receivables
      FROM (
        SELECT amount FROM agency_banking_transactions WHERE status = 'pending' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND agency_banking_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM momo_transactions WHERE status = 'pending' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND momo_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM e_zwich_withdrawals WHERE status = 'pending' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND e_zwich_withdrawals.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM power_transactions WHERE status = 'pending' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND power_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
        UNION ALL
        SELECT amount FROM jumia_transactions WHERE status = 'pending' ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND jumia_transactions.branch_id = ${effectiveBranchId}`
            : sql``
        } ${dateFilter}
      ) pending_transactions
    `;
    const accountsReceivable =
      Number(receivablesResult[0].total_receivables) || 0;

    // Accounts Payable (pending expenses)
    const payablesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_payables
      FROM expenses 
      WHERE status IN ('pending', 'approved') ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND expenses.branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const accountsPayable = Number(payablesResult[0].total_payables) || 0;

    const netCashFromOperations =
      netIncome + depreciation - accountsReceivable + accountsPayable;

    // INVESTING ACTIVITIES
    // Purchase of Fixed Assets
    const fixedAssetsPurchaseResult = await sql`
      SELECT COALESCE(SUM(purchase_cost), 0) as total_purchase
      FROM fixed_assets 
      WHERE purchase_date BETWEEN ${from} AND ${to} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND fixed_assets.branch_id = ${effectiveBranchId}`
        : sql``
    }
    `;
    const purchaseOfFixedAssets =
      Number(fixedAssetsPurchaseResult[0].total_purchase) || 0;

    const netCashFromInvesting = -purchaseOfFixedAssets;

    // FINANCING ACTIVITIES
    // Dividends (represented by commissions paid)
    const dividendsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM commissions 
      WHERE status = 'paid' ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND commissions.branch_id = ${effectiveBranchId}`
          : sql``
      } ${dateFilter}
    `;
    const dividendsPaid = Number(dividendsResult[0].total_commissions) || 0;

    const netCashFromFinancing = -dividendsPaid;

    // Net Change in Cash
    const netChangeInCash =
      netCashFromOperations + netCashFromInvesting + netCashFromFinancing;

    // Ending Cash Balance (excluding Jumia - we don't own it)
    const endingCashResult = await sql`
      SELECT COALESCE(SUM(current_balance), 0) as total_cash
      FROM float_accounts 
      WHERE is_active = true 
        AND account_type != 'jumia'
        ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND float_accounts.branch_id = ${effectiveBranchId}`
            : sql``
        }
    `;
    const endingCashBalance = Number(endingCashResult[0].total_cash) || 0;

    // Get opening cash balance (cash at start of period)
    // Since we don't have historical data, we'll calculate it as:
    // Opening Cash = Ending Cash - Net Change in Cash
    const openingCashBalance = endingCashBalance - netChangeInCash;

    // Get inventory changes
    const inventoryChangeResult = await sql`
      SELECT COALESCE(SUM(quantity_available * unit_cost), 0) as inventory_value
      FROM ezwich_card_batches 
      WHERE quantity_available > 0
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;
    const inventoryChange =
      Number(inventoryChangeResult[0].inventory_value) || 0;

    // Get Jumia float changes (all treated as liability/accounts payable)
    const jumiaFloatResult = await sql`
      SELECT COALESCE(SUM(ABS(current_balance)), 0) as total_jumia_float
      FROM float_accounts 
      WHERE is_active = true 
        AND account_type = 'jumia'
        ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND branch_id = ${effectiveBranchId}`
            : sql``
        }
    `;
    const settlementsArrears =
      Number(jumiaFloatResult[0].total_jumia_float) || 0;

    // Get equity adjustments (from equity transactions)
    const equityIntroducedResult = await sql`
      SELECT COALESCE(SUM(credit), 0) as total_equity
      FROM equity_transactions
      WHERE ledger_type = 'share_capital'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      ${
        from && to ? sql`AND transaction_date BETWEEN ${from} AND ${to}` : sql``
      }
    `;
    const equityIntroduced =
      Number(equityIntroducedResult[0].total_equity) || 0;

    const retainedEarningsAdjustmentResult = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as adjustment
      FROM equity_transactions
      WHERE ledger_type = 'retained_earnings'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      ${
        from && to ? sql`AND transaction_date BETWEEN ${from} AND ${to}` : sql``
      }
    `;
    const retainedEarningsAdjustment =
      Number(retainedEarningsAdjustmentResult[0].adjustment) || 0;

    // Bank loan (from system settings)
    const bankLoanResult = await sql`
      SELECT COALESCE(CAST(value AS DECIMAL), 0) as loan_value
      FROM system_settings
      WHERE key = 'bank_loan'
      LIMIT 1
    `;
    const bankLoan = Number(bankLoanResult[0]?.loan_value) || 0;

    return NextResponse.json({
      success: true,
      data: {
        period: { from, to },
        operatingActivities: {
          netProfit: { note: 28, value: netIncome },
          depreciation: { note: null, value: depreciation },
          otherNonCashCharges: { note: null, value: 0 },
          operatingProfitBeforeWorkingCapital: netIncome + depreciation,
          workingCapitalChanges: {
            accountsReceivable: { note: 29, value: -accountsReceivable },
            inventory: { note: 30, value: -inventoryChange },
            accountsPayable: { note: 31, value: accountsPayable },
            settlementsArrears: { note: 32, value: settlementsArrears },
          },
          netCashFromOperations,
        },
        investingActivities: {
          purchaseOfFixedAssets: { note: 33, value: -purchaseOfFixedAssets },
          disposalOfFixedAssets: { note: 34, value: 0 },
          netCashFromInvesting,
        },
        financingActivities: {
          equityIntroduced: { note: 35, value: equityIntroduced },
          retainedEarningsAdjustment: {
            note: 36,
            value: retainedEarningsAdjustment,
          },
          bankLoan: { note: 37, value: bankLoan },
          dividendsPaid: { note: 38, value: -dividendsPaid },
          netCashFromFinancing:
            equityIntroduced +
            retainedEarningsAdjustment +
            bankLoan -
            dividendsPaid,
        },
        summary: {
          netChangeInCash,
          openingCashBalance,
          closingCashBalance: endingCashBalance,
        },
        branchFilter: effectiveBranchId,
        generatedBy: user.name || user.email,
      },
    });
  } catch (error) {
    devLog.error("Error generating cash flow report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate cash flow report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
