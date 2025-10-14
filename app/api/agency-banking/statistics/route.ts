import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth-service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = session;
    const branchFilter = user.role === "admin" ? null : user.branchId;

    console.log(
      `Fetching agency banking statistics for user: ${user.role}, branch: ${branchFilter}`
    );

    // Get today's statistics (last 24 hours)
    let todayStats;
    if (branchFilter) {
      todayStats = await sql`
        SELECT 
          COUNT(*) as today_transactions,
          COALESCE(SUM(amount), 0) as today_volume,
          COALESCE(SUM(fee), 0) as today_fees
        FROM agency_banking_transactions
        WHERE date >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND branch_id = ${branchFilter}
          AND status = 'completed'
          AND (is_reversal IS NULL OR is_reversal = false)
      `;
    } else {
      todayStats = await sql`
        SELECT 
          COUNT(*) as today_transactions,
          COALESCE(SUM(amount), 0) as today_volume,
          COALESCE(SUM(fee), 0) as today_fees
        FROM agency_banking_transactions
        WHERE date >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND status = 'completed'
          AND (is_reversal IS NULL OR is_reversal = false)
      `;
    }

    // Get weekly statistics
    let weeklyStats;
    if (branchFilter) {
      weeklyStats = await sql`
        SELECT 
          COUNT(*) as weekly_transactions,
          COALESCE(SUM(amount), 0) as weekly_volume,
          COALESCE(SUM(fee), 0) as weekly_fees
        FROM agency_banking_transactions
        WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
          AND branch_id = ${branchFilter}
          AND status = 'completed'
          AND (is_reversal IS NULL OR is_reversal = false)
      `;
    } else {
      weeklyStats = await sql`
        SELECT 
          COUNT(*) as weekly_transactions,
          COALESCE(SUM(amount), 0) as weekly_volume,
          COALESCE(SUM(fee), 0) as weekly_fees
        FROM agency_banking_transactions
        WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
          AND status = 'completed'
          AND (is_reversal IS NULL OR is_reversal = false)
      `;
    }

    // Get monthly statistics
    let monthlyStats;
    if (branchFilter) {
      monthlyStats = await sql`
        SELECT 
          COUNT(*) as monthly_transactions,
          COALESCE(SUM(amount), 0) as monthly_volume,
          COALESCE(SUM(fee), 0) as monthly_fees
        FROM agency_banking_transactions
        WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
          AND branch_id = ${branchFilter}
          AND status = 'completed'
          AND (is_reversal IS NULL OR is_reversal = false)
      `;
    } else {
      monthlyStats = await sql`
        SELECT 
          COUNT(*) as monthly_transactions,
          COALESCE(SUM(amount), 0) as monthly_volume,
          COALESCE(SUM(fee), 0) as monthly_fees
        FROM agency_banking_transactions
        WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
          AND status = 'completed'
          AND (is_reversal IS NULL OR is_reversal = false)
      `;
    }

    // Debug: Get total count of all agency banking transactions
    const totalCount = await sql`
      SELECT COUNT(*) as total FROM agency_banking_transactions
    `;

    const completedCount = await sql`
      SELECT COUNT(*) as completed FROM agency_banking_transactions WHERE status = 'completed'
    `;

    const reversedCount = await sql`
      SELECT COUNT(*) as reversed FROM agency_banking_transactions WHERE is_reversal = true
    `;

    // Get active partner banks count and total float balance
    let activeProviders = 0;
    let floatBalance = 0;
    let lowFloatAlerts = 0;

    if (branchFilter) {
      const floatStats = await sql`
        SELECT 
          COUNT(*) as provider_count,
          COALESCE(SUM(current_balance), 0) as total_balance,
          COUNT(CASE WHEN current_balance < min_threshold THEN 1 END) as low_balance_count
        FROM float_accounts 
        WHERE account_type = 'agency-banking' 
          AND branch_id = ${branchFilter}
          AND is_active = true
      `;

      activeProviders = Number(floatStats[0]?.provider_count || 0);
      floatBalance = Number(floatStats[0]?.total_balance || 0);
      lowFloatAlerts = Number(floatStats[0]?.low_balance_count || 0);
    } else {
      const floatStats = await sql`
        SELECT 
          COUNT(*) as provider_count,
          COALESCE(SUM(current_balance), 0) as total_balance,
          COUNT(CASE WHEN current_balance < min_threshold THEN 1 END) as low_balance_count
        FROM float_accounts 
        WHERE account_type = 'agency-banking' 
          AND is_active = true
      `;

      activeProviders = Number(floatStats[0]?.provider_count || 0);
      floatBalance = Number(floatStats[0]?.total_balance || 0);
      lowFloatAlerts = Number(floatStats[0]?.low_balance_count || 0);
    }

    console.log(`Agency Banking Debug Info:`);
    console.log(`   Total transactions: ${totalCount[0]?.total || 0}`);
    console.log(
      `   Completed transactions: ${completedCount[0]?.completed || 0}`
    );
    console.log(`   Reversed transactions: ${reversedCount[0]?.reversed || 0}`);

    const today = todayStats[0] || {
      today_transactions: 0,
      today_volume: 0,
      today_fees: 0,
    };
    const weekly = weeklyStats[0] || {
      weekly_transactions: 0,
      weekly_volume: 0,
      weekly_fees: 0,
    };
    const monthly = monthlyStats[0] || {
      monthly_transactions: 0,
      monthly_volume: 0,
      monthly_fees: 0,
    };

    console.log(`📈 Agency Banking Statistics:`);
    console.log(
      `   Today: ${today.today_transactions} transactions, ${today.today_volume} volume, ${today.today_fees} fees`
    );
    console.log(
      `   Weekly: ${weekly.weekly_transactions} transactions, ${weekly.weekly_volume} volume, ${weekly.weekly_fees} fees`
    );
    console.log(
      `   Monthly: ${monthly.monthly_transactions} transactions, ${monthly.monthly_volume} volume, ${monthly.monthly_fees} fees`
    );

    return NextResponse.json({
      success: true,
      data: {
        todayTransactions: Number(today.today_transactions),
        todayVolume: Number(today.today_volume),
        todayFees: Number(today.today_fees),
        weeklyTransactions: Number(weekly.weekly_transactions),
        weeklyVolume: Number(weekly.weekly_volume),
        weeklyFees: Number(weekly.weekly_fees),
        monthlyTransactions: Number(monthly.monthly_transactions),
        monthlyVolume: Number(monthly.monthly_volume),
        monthlyFees: Number(monthly.monthly_fees),
        totalTransactions: Number(completedCount[0]?.completed || 0),
        totalVolume: Number(monthly.monthly_volume),
        totalCommission: Number(monthly.monthly_fees),
        activeProviders: activeProviders,
        floatBalance: floatBalance,
        lowFloatAlerts: lowFloatAlerts,
      },
      debug: {
        totalTransactions: Number(totalCount[0]?.total || 0),
        completedTransactions: Number(completedCount[0]?.completed || 0),
        reversedTransactions: Number(reversedCount[0]?.reversed || 0),
        userRole: user.role,
        branchFilter: branchFilter,
      },
    });
  } catch (error) {
    console.error("Error fetching Agency Banking statistics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
