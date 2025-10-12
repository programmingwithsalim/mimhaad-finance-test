import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const provider = searchParams.get("provider");

    console.log("📊 Fetching MoMo statistics with filters:", {
      branchId,
      dateFrom,
      dateTo,
      provider,
    });

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Get transaction statistics for today and all time
    const todayStats = await sql`
      SELECT 
        COUNT(*) as today_count,
        COALESCE(SUM(amount), 0) as today_amount,
        COALESCE(SUM(fee), 0) as today_fees
      FROM momo_transactions
      WHERE branch_id = ${branchId}
      AND DATE(created_at) = ${today}
      AND (is_reversal IS NULL OR is_reversal = false)
    `;

    const totalStats = await sql`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(fee), 0) as total_fees
      FROM momo_transactions
      WHERE branch_id = ${branchId}
      AND (is_reversal IS NULL OR is_reversal = false)
    `;

    // Get active providers count
    const activeProviders = await sql`
      SELECT COUNT(DISTINCT provider) as provider_count
      FROM momo_transactions
      WHERE branch_id = ${branchId}
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    // Get float balance for MoMo accounts
    const floatBalance = await sql`
      SELECT COALESCE(SUM(current_balance), 0) as total_float
      FROM float_accounts
      WHERE branch_id = ${branchId}
      AND account_type = 'momo'
      AND is_active = true
    `;

    // Get low float alerts count
    const lowFloatAlerts = await sql`
      SELECT COUNT(*) as alert_count
      FROM float_accounts
      WHERE branch_id = ${branchId}
      AND account_type = 'momo'
      AND is_active = true
      AND current_balance <= min_threshold
    `;

    const statistics = {
      todayTransactions: Number(todayStats[0]?.today_count || 0),
      totalTransactions: Number(totalStats[0]?.total_count || 0),
      todayVolume: Number(todayStats[0]?.today_amount || 0),
      totalVolume: Number(totalStats[0]?.total_amount || 0),
      todayCommission: Number(todayStats[0]?.today_fees || 0),
      totalCommission: Number(totalStats[0]?.total_fees || 0),
      activeProviders: Number(activeProviders[0]?.provider_count || 0),
      floatBalance: Number(floatBalance[0]?.total_float || 0),
      lowFloatAlerts: Number(lowFloatAlerts[0]?.alert_count || 0),
    };

    console.log("✅ MoMo statistics fetched successfully:", statistics);

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("❌ Error fetching MoMo statistics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch MoMo statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
