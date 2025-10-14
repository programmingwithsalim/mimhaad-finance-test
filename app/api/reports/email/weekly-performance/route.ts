import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { EmailService } from "@/lib/email-service";
import { getCurrentUser } from "@/lib/auth-utils";
import { formatCurrency } from "@/lib/currency";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, recipientEmails, branchId } = body;

    console.log("[EMAIL] Generating weekly performance report...");

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

    // Calculate week dates (last 7 days if not provided)
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const startDateObj = startDate
      ? new Date(startDate)
      : new Date(endDateObj.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startDateStr = startDateObj.toISOString().split("T")[0];
    const endDateStr = endDateObj.toISOString().split("T")[0];

    // Build branch filter
    const effectiveBranchId =
      user.role === "Admin" ? branchId || "all" : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;

    // Get weekly statistics
    // 1. Daily breakdown
    const dailyBreakdown = await sql`
      SELECT 
        date,
        SUM(transaction_count) as total_transactions,
        SUM(total_volume) as total_volume,
        SUM(total_revenue) as total_revenue
      FROM (
        SELECT 
          created_at::date as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(fee), 0) as total_revenue
        FROM momo_transactions
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr}
          AND status = 'completed'
          AND deleted = false
          ${branchFilter}
        GROUP BY created_at::date
        UNION ALL
        SELECT 
          created_at::date as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(fee), 0) as total_revenue
        FROM agency_banking_transactions
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr}
          AND status = 'completed'
          AND deleted = false
          ${branchFilter}
        GROUP BY created_at::date
        UNION ALL
        SELECT 
          created_at::date as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(fee), 0) as total_revenue
        FROM power_transactions
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr}
          AND status = 'completed'
          AND deleted = false
          ${branchFilter}
        GROUP BY created_at::date
        UNION ALL
        SELECT 
          created_at::date as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(fee), 0) as total_revenue
        FROM jumia_transactions
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr}
          AND status = 'completed'
          AND deleted = false
          ${branchFilter}
        GROUP BY created_at::date
      ) daily
      GROUP BY date
      ORDER BY date ASC
    `;

    // 2. Top performing branches (Admin only)
    let topBranches: any[] = [];
    if (user.role === "Admin") {
      topBranches = await sql`
        SELECT 
          branch_id,
          branch_name,
          COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(fee), 0) as total_revenue
        FROM (
          SELECT branch_id, branch_name, amount, fee FROM momo_transactions 
          WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false
          UNION ALL
          SELECT branch_id, branch_name, amount, fee FROM agency_banking_transactions 
          WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false
          UNION ALL
          SELECT branch_id, branch_name, amount, fee FROM power_transactions 
          WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false
          UNION ALL
          SELECT branch_id, branch_name, amount, fee FROM jumia_transactions 
          WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false
        ) branches
        GROUP BY branch_id, branch_name
        ORDER BY total_revenue DESC
        LIMIT 5
      `;
    }

    // 3. Top performing users
    const topUsers = await sql`
      SELECT 
        processed_by,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_revenue
      FROM (
        SELECT processed_by, amount, fee FROM momo_transactions 
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false ${branchFilter}
        UNION ALL
        SELECT processed_by, amount, fee FROM agency_banking_transactions 
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false ${branchFilter}
        UNION ALL
        SELECT processed_by, amount, fee FROM power_transactions 
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false ${branchFilter}
        UNION ALL
        SELECT processed_by, amount, fee FROM jumia_transactions 
        WHERE created_at::date BETWEEN ${startDateStr} AND ${endDateStr} AND status = 'completed' AND deleted = false ${branchFilter}
      ) users
      WHERE processed_by IS NOT NULL
      GROUP BY processed_by
      ORDER BY total_revenue DESC
      LIMIT 5
    `;

    // Get user names
    const userIds = topUsers.map((u) => u.processed_by);
    const userNames =
      userIds.length > 0
        ? await sql`
      SELECT id, first_name, last_name
      FROM users
      WHERE id = ANY(${userIds})
    `
        : [];

    const topUsersWithNames = topUsers.map((u) => {
      const userInfo = userNames.find((un) => un.id === u.processed_by);
      return {
        ...u,
        name: userInfo
          ? `${userInfo.first_name} ${userInfo.last_name}`
          : u.processed_by,
      };
    });

    // Calculate week totals
    const weekTotals = dailyBreakdown.reduce(
      (acc, day) => ({
        transactions: acc.transactions + Number(day.total_transactions),
        volume: acc.volume + Number(day.total_volume),
        revenue: acc.revenue + Number(day.total_revenue),
      }),
      { transactions: 0, volume: 0, revenue: 0 }
    );

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
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
    .rank {
      display: inline-block;
      width: 24px;
      height: 24px;
      background: #3b82f6;
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      font-size: 12px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Weekly Performance Report</h1>
    <p>Mimhaad Financial Services</p>
    <p>${startDateObj.toLocaleDateString()} - ${endDateObj.toLocaleDateString()}</p>
  </div>

  <div class="content">
    <h2>Week Summary</h2>
    
    <div class="metric-grid">
      <div class="metric-card">
        <h3>Total Transactions</h3>
        <p>${weekTotals.transactions.toLocaleString()}</p>
      </div>
      <div class="metric-card">
        <h3>Transaction Volume</h3>
        <p>${formatCurrency(weekTotals.volume)}</p>
      </div>
      <div class="metric-card">
        <h3>Total Revenue</h3>
        <p>${formatCurrency(weekTotals.revenue)}</p>
      </div>
      <div class="metric-card">
        <h3>Daily Average</h3>
        <p>${formatCurrency(weekTotals.revenue / 7)}</p>
      </div>
    </div>

    <h2>Daily Trend</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Transactions</th>
          <th>Volume</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${dailyBreakdown
          .map(
            (day) => `
          <tr>
            <td>${new Date(day.date).toLocaleDateString()}</td>
            <td>${Number(day.total_transactions).toLocaleString()}</td>
            <td>${formatCurrency(Number(day.total_volume))}</td>
            <td>${formatCurrency(Number(day.total_revenue))}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    ${
      topBranches.length > 0
        ? `
    <h2>Top Performing Branches</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Branch</th>
          <th>Transactions</th>
          <th>Volume</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${topBranches
          .map(
            (branch, index) => `
          <tr>
            <td><span class="rank">${index + 1}</span></td>
            <td>${branch.branch_name}</td>
            <td>${Number(branch.transaction_count).toLocaleString()}</td>
            <td>${formatCurrency(Number(branch.total_volume))}</td>
            <td>${formatCurrency(Number(branch.total_revenue))}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    `
        : ""
    }

    <h2>Top Performing Staff</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Staff Member</th>
          <th>Transactions</th>
          <th>Volume</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${topUsersWithNames
          .map(
            (user, index) => `
          <tr>
            <td><span class="rank">${index + 1}</span></td>
            <td>${user.name}</td>
            <td>${Number(user.transaction_count).toLocaleString()}</td>
            <td>${formatCurrency(Number(user.total_volume))}</td>
            <td>${formatCurrency(Number(user.total_revenue))}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0; color: #065f46;">
        <strong>Performance Summary:</strong> The week recorded ${weekTotals.transactions.toLocaleString()} transactions 
        with total revenue of ${formatCurrency(weekTotals.revenue)}. 
        Average daily revenue is ${formatCurrency(weekTotals.revenue / 7)}.
      </p>
    </div>
  </div>

  <div class="footer">
    <p>This is an automated weekly performance report from Mimhaad Financial Services ERP</p>
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
          subject: `Weekly Performance Report - ${startDateObj.toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          )} to ${endDateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}`,
          html: emailHtml,
        });
        sentCount++;
        console.log(`[EMAIL] Weekly report sent to ${email}`);
      } catch (error) {
        console.error(`[EMAIL] Failed to send to ${email}:`, error);
      }
    }

    console.log(
      `[EMAIL] Weekly performance reports sent: ${sentCount}/${recipients.length}`
    );

    return NextResponse.json({
      success: true,
      message: `Sent weekly performance report to ${sentCount} recipient(s)`,
      recipients: sentCount,
      data: {
        weekTotals,
        topBranches: topBranches.length,
        topUsers: topUsersWithNames.length,
      },
    });
  } catch (error) {
    console.error("[EMAIL] Error sending weekly report:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send weekly report",
      },
      { status: 500 }
    );
  }
}
