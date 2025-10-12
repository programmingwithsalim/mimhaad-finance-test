import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { EmailService } from "@/lib/email-service";
import { getCurrentUser } from "@/lib/auth-utils";
import { formatCurrency } from "@/lib/currency";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, recipientEmails, branchId } = body;

    console.log("📧 [EMAIL] Generating daily summary report...");

    // Get current user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only Admin and Finance can send reports
    if (!["Admin", "Finance", "Manager"].includes(user.role || "")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Use today's date if not provided
    const reportDate = date ? new Date(date) : new Date();
    const dateStr = reportDate.toISOString().split("T")[0];

    // Build branch filter
    const effectiveBranchId =
      user.role === "Admin" ? branchId || "all" : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;

    // Get daily statistics
    // 1. Total transactions
    const transactionsResult = await sql`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_volume
      FROM (
        SELECT amount, branch_id FROM momo_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT amount, branch_id FROM agency_banking_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT amount, branch_id FROM power_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT amount, branch_id FROM jumia_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT withdrawal_amount as amount, branch_id FROM ezwich_withdrawals WHERE created_at::date = ${dateStr}
      ) t
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`WHERE branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;

    // 2. Revenue (fees + commissions)
    const revenueResult = await sql`
      SELECT 
        COALESCE(SUM(fee), 0) as total_fees
      FROM (
        SELECT fee FROM momo_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT fee FROM agency_banking_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT fee FROM power_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT fee FROM jumia_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT commission_amount as fee FROM ezwich_withdrawals WHERE created_at::date = ${dateStr} AND status = 'completed'
      ) r
    `;

    const commissionsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM commissions
      WHERE created_at::date = ${dateStr}
        AND status IN ('approved', 'paid')
        ${branchFilter}
    `;

    // 3. Expenses
    const expensesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE created_at::date = ${dateStr}
        AND status IN ('approved', 'paid')
        ${branchFilter}
    `;

    // 4. Float balances
    const floatBalancesResult = await sql`
      SELECT 
        account_type,
        provider,
        SUM(current_balance) as total_balance
      FROM float_accounts
      WHERE is_active = true
        ${branchFilter}
      GROUP BY account_type, provider
      ORDER BY account_type, provider
    `;

    // 5. Service breakdown
    const serviceBreakdown = await sql`
      SELECT 
        'Mobile Money' as service,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_revenue
      FROM momo_transactions
      WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false ${branchFilter}
      UNION ALL
      SELECT 
        'Agency Banking' as service,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_revenue
      FROM agency_banking_transactions
      WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false ${branchFilter}
      UNION ALL
      SELECT 
        'Power/Utilities' as service,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_revenue
      FROM power_transactions
      WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false ${branchFilter}
      UNION ALL
      SELECT 
        'Jumia Pay' as service,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_revenue
      FROM jumia_transactions
      WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false ${branchFilter}
    `;

    // Prepare data
    const totalTransactions = Number(transactionsResult[0]?.total_count || 0);
    const totalVolume = Number(transactionsResult[0]?.total_volume || 0);
    const totalFees = Number(revenueResult[0]?.total_fees || 0);
    const totalCommissions = Number(
      commissionsResult[0]?.total_commissions || 0
    );
    const totalRevenue = totalFees + totalCommissions;
    const totalExpenses = Number(expensesResult[0]?.total_expenses || 0);
    const netProfit = totalRevenue - totalExpenses;

    // Build HTML email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white;
      padding: 30px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .metric-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
    }
    .metric-card p {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
      color: #111827;
    }
    .profit {
      color: ${netProfit >= 0 ? "#10b981" : "#ef4444"};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      margin: 20px 0;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-size: 14px;
      color: #374151;
    }
    td {
      padding: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Daily Summary Report</h1>
    <p>Mimhaad Financial Services - ${reportDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}</p>
  </div>

  <div class="content">
    <h2>Financial Performance</h2>
    
    <div class="metric-grid">
      <div class="metric-card">
        <h3>Total Transactions</h3>
        <p>${totalTransactions.toLocaleString()}</p>
      </div>
      <div class="metric-card">
        <h3>Transaction Volume</h3>
        <p>${formatCurrency(totalVolume)}</p>
      </div>
      <div class="metric-card">
        <h3>Total Revenue</h3>
        <p>${formatCurrency(totalRevenue)}</p>
      </div>
      <div class="metric-card">
        <h3>Total Expenses</h3>
        <p>${formatCurrency(totalExpenses)}</p>
      </div>
      <div class="metric-card">
        <h3>Net Profit</h3>
        <p class="profit">${formatCurrency(netProfit)}</p>
      </div>
    </div>

    <h2>Service Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Transactions</th>
          <th>Volume</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${serviceBreakdown
          .map(
            (service) => `
          <tr>
            <td>${service.service}</td>
            <td>${Number(service.transaction_count).toLocaleString()}</td>
            <td>${formatCurrency(Number(service.total_volume))}</td>
            <td>${formatCurrency(Number(service.total_revenue))}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <h2>Float Balances</h2>
    <table>
      <thead>
        <tr>
          <th>Account Type</th>
          <th>Provider</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        ${floatBalancesResult
          .map(
            (float) => `
          <tr>
            <td>${float.account_type}</td>
            <td>${float.provider || "N/A"}</td>
            <td>${formatCurrency(Number(float.total_balance))}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0; color: #1e40af;">
        <strong>Summary:</strong> ${totalTransactions} transactions processed with a total volume of ${formatCurrency(
      totalVolume
    )}. 
        Net profit for the day is ${formatCurrency(netProfit)} (${
      netProfit >= 0 ? "positive" : "negative"
    }).
      </p>
    </div>
  </div>

  <div class="footer">
    <p>This is an automated daily summary from Mimhaad Financial Services ERP</p>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
    `;

    // Send email to recipients
    const recipients = recipientEmails || [user.email];
    let sentCount = 0;

    for (const email of recipients) {
      try {
        await EmailService.sendEmail({
          to: email,
          subject: `Daily Summary Report - ${reportDate.toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          )}`,
          html: emailHtml,
        });
        sentCount++;
        console.log(`✅ [EMAIL] Daily summary sent to ${email}`);
      } catch (error) {
        console.error(`❌ [EMAIL] Failed to send to ${email}:`, error);
      }
    }

    console.log(
      `✅ [EMAIL] Daily summary reports sent: ${sentCount}/${recipients.length}`
    );

    return NextResponse.json({
      success: true,
      message: `Sent daily summary to ${sentCount} recipient(s)`,
      recipients: sentCount,
      data: {
        totalTransactions,
        totalVolume,
        totalRevenue,
        totalExpenses,
        netProfit,
      },
    });
  } catch (error) {
    console.error("❌ [EMAIL] Error sending daily summary:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send daily summary",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to preview daily summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const branchId = searchParams.get("branchId");

    const reportDate = date ? new Date(date) : new Date();
    const dateStr = reportDate.toISOString().split("T")[0];

    // Get current user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Build branch filter
    const effectiveBranchId =
      user.role === "Admin" ? branchId || "all" : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;

    // Get daily statistics (same queries as above)
    const transactionsResult = await sql`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_volume
      FROM (
        SELECT amount, branch_id FROM momo_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT amount, branch_id FROM agency_banking_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT amount, branch_id FROM power_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT amount, branch_id FROM jumia_transactions WHERE created_at::date = ${dateStr} AND deleted = false
        UNION ALL
        SELECT withdrawal_amount as amount, branch_id FROM ezwich_withdrawals WHERE created_at::date = ${dateStr}
      ) t
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`WHERE branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;

    const revenueResult = await sql`
      SELECT 
        COALESCE(SUM(fee), 0) as total_fees
      FROM (
        SELECT fee FROM momo_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT fee FROM agency_banking_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT fee FROM power_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT fee FROM jumia_transactions WHERE created_at::date = ${dateStr} AND status = 'completed' AND deleted = false
        UNION ALL
        SELECT commission_amount as fee FROM ezwich_withdrawals WHERE created_at::date = ${dateStr} AND status = 'completed'
      ) r
    `;

    const commissionsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM commissions
      WHERE created_at::date = ${dateStr}
        AND status IN ('approved', 'paid')
        ${branchFilter}
    `;

    const expensesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE created_at::date = ${dateStr}
        AND status IN ('approved', 'paid')
        ${branchFilter}
    `;

    return NextResponse.json({
      success: true,
      date: reportDate,
      data: {
        totalTransactions: Number(transactionsResult[0]?.total_count || 0),
        totalVolume: Number(transactionsResult[0]?.total_volume || 0),
        totalRevenue:
          Number(revenueResult[0]?.total_fees || 0) +
          Number(commissionsResult[0]?.total_commissions || 0),
        totalExpenses: Number(expensesResult[0]?.total_expenses || 0),
        netProfit:
          Number(revenueResult[0]?.total_fees || 0) +
          Number(commissionsResult[0]?.total_commissions || 0) -
          Number(expensesResult[0]?.total_expenses || 0),
      },
    });
  } catch (error) {
    console.error("❌ [EMAIL] Error previewing daily summary:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to preview daily summary",
      },
      { status: 500 }
    );
  }
}

