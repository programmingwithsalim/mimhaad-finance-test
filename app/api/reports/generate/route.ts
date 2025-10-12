import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import * as XLSX from "xlsx";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { reportType, format, dateRange, branch } = await request.json();

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

    // Check permissions
    const isAdmin = user.role === "Admin";
    const isFinance = user.role === "Finance";
    const isManager = user.role === "Manager";

    if (!isAdmin && !isFinance && !isManager) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Determine effective branch filter
    const effectiveBranchId = isAdmin ? branch : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;

    // Date filter
    const dateFilter =
      dateRange?.from && dateRange?.to
        ? sql`AND created_at::date BETWEEN ${dateRange.from} AND ${dateRange.to}`
        : sql``;

    let reportData: any = {};
    let fileName = "";

    switch (reportType) {
      case "comprehensive":
        reportData = await generateComprehensiveReport(
          branchFilter,
          dateFilter
        );
        fileName = "Comprehensive_Financial_Report";
        break;
      case "profit-loss":
        reportData = await generateProfitLossReport(branchFilter, dateFilter);
        fileName = "Profit_Loss_Statement";
        break;
      case "fixed-assets":
        reportData = await generateFixedAssetsReport(branchFilter, dateFilter);
        fileName = "Fixed_Assets_Report";
        break;
      case "expenses":
        reportData = await generateExpensesReport(branchFilter, dateFilter);
        fileName = "Expenses_Report";
        break;
      case "equity":
        reportData = await generateEquityReport(branchFilter, dateFilter);
        fileName = "Equity_Report";
        break;
      case "balance-sheet":
        reportData = await generateBalanceSheetReport(branchFilter, dateFilter);
        fileName = "Balance_Sheet";
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid report type" },
          { status: 400 }
        );
    }

    if (format === "excel") {
      return generateExcelReport(reportData, fileName);
    } else if (format === "csv") {
      return generateCSVReport(reportData, fileName);
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported format" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function generateComprehensiveReport(branchFilter: any, dateFilter: any) {
  // Get all financial data
  const [revenue, expenses, assets, equity] = await Promise.all([
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM agency_banking_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}`,
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status IN ('approved', 'paid') ${branchFilter} ${dateFilter}`,
    sql`SELECT COUNT(*) as count, COALESCE(SUM(purchase_cost), 0) as total_cost FROM fixed_assets WHERE status = 'active' ${branchFilter}`,
    sql`SELECT COALESCE(SUM(balance), 0) as total FROM gl_accounts WHERE type = 'Equity' AND is_active = true`,
  ]);

  return {
    summary: {
      totalRevenue: Number(revenue[0].total),
      totalExpenses: Number(expenses[0].total),
      totalAssets: Number(assets[0].count),
      totalEquity: Number(equity[0].total),
      netIncome: Number(revenue[0].total) - Number(expenses[0].total),
    },
    reportDate: new Date().toISOString(),
  };
}

async function generateProfitLossReport(branchFilter: any, dateFilter: any) {
  const revenueBreakdown = await sql`
    WITH revenue_data AS (
      SELECT 'MoMo' as service, COALESCE(SUM(fee), 0) as revenue FROM momo_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
      UNION ALL
      SELECT 'Agency Banking' as service, COALESCE(SUM(fee), 0) as revenue FROM agency_banking_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
      UNION ALL
      SELECT 'E-Zwich' as service, COALESCE(SUM(fee), 0) as revenue FROM e_zwich_withdrawals WHERE status = 'completed' ${branchFilter} ${dateFilter}
      UNION ALL
      SELECT 'Power' as service, COALESCE(SUM(commission), 0) as revenue FROM power_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
      UNION ALL
      SELECT 'Jumia' as service, COALESCE(SUM(fee), 0) as revenue FROM jumia_transactions WHERE status = 'completed' ${branchFilter} ${dateFilter}
    )
    SELECT service, revenue FROM revenue_data ORDER BY revenue DESC
  `;

  const expenseBreakdown = await sql`
    SELECT eh.category, COUNT(*) as count, COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses e
    LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
    WHERE e.status IN ('approved', 'paid') ${branchFilter} ${dateFilter}
    GROUP BY eh.category
    ORDER BY total_amount DESC
  `;

  return {
    revenueBreakdown,
    expenseBreakdown,
    reportDate: new Date().toISOString(),
  };
}

async function generateFixedAssetsReport(branchFilter: any, dateFilter: any) {
  const assets = await sql`
    SELECT 
      name, category, purchase_cost, current_value, accumulated_depreciation,
      purchase_date, status, location, branch_name
    FROM fixed_assets
    WHERE 1=1 ${branchFilter}
    ORDER BY category, name
  `;

  const summary = await sql`
    SELECT 
      COUNT(*) as total_assets,
      COALESCE(SUM(purchase_cost), 0) as total_cost,
      COALESCE(SUM(current_value), 0) as total_value,
      COALESCE(SUM(accumulated_depreciation), 0) as total_depreciation
    FROM fixed_assets
    WHERE status = 'active' ${branchFilter}
  `;

  return {
    assets,
    summary: summary[0],
    reportDate: new Date().toISOString(),
  };
}

async function generateExpensesReport(branchFilter: any, dateFilter: any) {
  const expenses = await sql`
    SELECT 
      e.reference_number, e.amount, e.description, e.expense_date,
      e.payment_method, e.status, eh.name as expense_head, eh.category,
      b.name as branch_name
    FROM expenses e
    LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE 1=1 ${branchFilter} ${dateFilter}
    ORDER BY e.expense_date DESC
  `;

  const summary = await sql`
    SELECT 
      COUNT(*) as total_expenses,
      COALESCE(SUM(amount), 0) as total_amount,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
    FROM expenses
    WHERE status IN ('approved', 'paid') ${branchFilter} ${dateFilter}
  `;

  return {
    expenses,
    summary: summary[0],
    reportDate: new Date().toISOString(),
  };
}

async function generateEquityReport(branchFilter: any, dateFilter: any) {
  const equityAccounts = await sql`
    SELECT code, name, balance, is_active
    FROM gl_accounts
    WHERE type = 'Equity' AND is_active = true
    ORDER BY code
  `;

  const equityTransactions = await sql`
    SELECT 
      gt.date, gt.description, gt.amount, je.debit, je.credit,
      a.code as account_code, a.name as account_name
    FROM gl_transactions gt
    JOIN gl_journal_entries je ON gt.id = je.transaction_id
    JOIN gl_accounts a ON je.account_id = a.id
    WHERE a.type = 'Equity' AND gt.status = 'posted' ${branchFilter} ${dateFilter}
    ORDER BY gt.date DESC
  `;

  return {
    equityAccounts,
    equityTransactions,
    reportDate: new Date().toISOString(),
  };
}

async function generateBalanceSheetReport(branchFilter: any, dateFilter: any) {
  const assets = await sql`
    SELECT code, name, balance
    FROM gl_accounts
    WHERE type = 'Asset' AND is_active = true
    ORDER BY code
  `;

  const liabilities = await sql`
    SELECT code, name, balance
    FROM gl_accounts
    WHERE type = 'Liability' AND is_active = true
    ORDER BY code
  `;

  const equity = await sql`
    SELECT code, name, balance
    FROM gl_accounts
    WHERE type = 'Equity' AND is_active = true
    ORDER BY code
  `;

  return {
    assets,
    liabilities,
    equity,
    reportDate: new Date().toISOString(),
  };
}

function generateExcelReport(data: any, fileName: string) {
  const workbook = XLSX.utils.book_new();

  // Create summary sheet
  const summaryData = [
    ["Report Summary"],
    ["Generated Date", new Date().toLocaleString()],
    ["", ""],
    ["Key Metrics", "Value"],
    ["Total Revenue", data.summary?.totalRevenue || 0],
    ["Total Expenses", data.summary?.totalExpenses || 0],
    ["Net Income", data.summary?.netIncome || 0],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Add data sheets based on report type
  if (data.revenueBreakdown) {
    const revenueSheet = XLSX.utils.json_to_sheet(data.revenueBreakdown);
    XLSX.utils.book_append_sheet(workbook, revenueSheet, "Revenue");
  }

  if (data.expenseBreakdown) {
    const expenseSheet = XLSX.utils.json_to_sheet(data.expenseBreakdown);
    XLSX.utils.book_append_sheet(workbook, expenseSheet, "Expenses");
  }

  if (data.assets) {
    const assetsSheet = XLSX.utils.json_to_sheet(data.assets);
    XLSX.utils.book_append_sheet(workbook, assetsSheet, "Fixed Assets");
  }

  if (data.expenses) {
    const expensesSheet = XLSX.utils.json_to_sheet(data.expenses);
    XLSX.utils.book_append_sheet(workbook, expensesSheet, "Expenses Detail");
  }

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return new NextResponse(excelBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
    },
  });
}

function generateCSVReport(data: any, fileName: string) {
  let csvContent = "Report Summary\n";
  csvContent += "Generated Date," + new Date().toLocaleString() + "\n\n";
  csvContent += "Key Metrics,Value\n";
  csvContent += "Total Revenue," + (data.summary?.totalRevenue || 0) + "\n";
  csvContent += "Total Expenses," + (data.summary?.totalExpenses || 0) + "\n";
  csvContent += "Net Income," + (data.summary?.netIncome || 0) + "\n\n";

  // Add data sections
  if (data.revenueBreakdown) {
    csvContent += "Revenue Breakdown\n";
    csvContent += "Service,Revenue\n";
    data.revenueBreakdown.forEach((item: any) => {
      csvContent += `${item.service},${item.revenue}\n`;
    });
    csvContent += "\n";
  }

  if (data.expenseBreakdown) {
    csvContent += "Expense Breakdown\n";
    csvContent += "Category,Count,Total Amount\n";
    data.expenseBreakdown.forEach((item: any) => {
      csvContent += `${item.category},${item.count},${item.total_amount}\n`;
    });
    csvContent += "\n";
  }

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${fileName}.csv"`,
    },
  });
}
