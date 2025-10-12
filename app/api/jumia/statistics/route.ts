import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.nextUrl);
    const branchId = searchParams.get("branchId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    console.log("📊 Fetching Jumia statistics with filters:", {
      branchId,
      dateFrom,
      dateTo,
    });

    // Get overall transaction statistics
    let statsResult;
    if (branchId && branchId !== "all" && dateFrom && dateTo) {
      statsResult = await sql`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(CASE WHEN transaction_type = 'package_receipt' THEN 1 END) as package_count,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as pod_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN amount ELSE 0 END), 0) as pod_amount,
          COUNT(CASE WHEN transaction_type = 'settlement' THEN 1 END) as settlement_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'settlement' THEN amount ELSE 0 END), 0) as settlement_amount
        FROM jumia_transactions 
        WHERE branch_id::text = ${branchId}
        AND created_at >= ${dateFrom}
        AND created_at <= ${dateTo}
        AND deleted = false
      `;
    } else if (branchId && branchId !== "all") {
      statsResult = await sql`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(CASE WHEN transaction_type = 'package_receipt' THEN 1 END) as package_count,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as pod_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN amount ELSE 0 END), 0) as pod_amount,
          COUNT(CASE WHEN transaction_type = 'settlement' THEN 1 END) as settlement_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'settlement' THEN amount ELSE 0 END), 0) as settlement_amount
        FROM jumia_transactions 
        WHERE branch_id::text = ${branchId}
        AND deleted = false
      `;
    } else if (dateFrom && dateTo) {
      statsResult = await sql`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(CASE WHEN transaction_type = 'package_receipt' THEN 1 END) as package_count,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as pod_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN amount ELSE 0 END), 0) as pod_amount,
          COUNT(CASE WHEN transaction_type = 'settlement' THEN 1 END) as settlement_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'settlement' THEN amount ELSE 0 END), 0) as settlement_amount
        FROM jumia_transactions 
        WHERE created_at >= ${dateFrom}
        AND created_at <= ${dateTo}
        AND deleted = false
      `;
    } else {
      statsResult = await sql`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(CASE WHEN transaction_type = 'package_receipt' THEN 1 END) as package_count,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as pod_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN amount ELSE 0 END), 0) as pod_amount,
          COUNT(CASE WHEN transaction_type = 'settlement' THEN 1 END) as settlement_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'settlement' THEN amount ELSE 0 END), 0) as settlement_amount
        FROM jumia_transactions 
        WHERE deleted = false
      `;
    }
    const stats = statsResult[0] || {};

    // Get today's statistics
    let todayStats;
    if (branchId && branchId !== "all") {
      todayStats = await sql`
        SELECT 
          COUNT(CASE WHEN transaction_type = 'package_receipt' THEN 1 END) as today_packages,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as today_collections,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN amount ELSE 0 END), 0) as today_collection_amount,
          COUNT(CASE WHEN transaction_type = 'settlement' THEN 1 END) as today_settlements,
          COALESCE(SUM(CASE WHEN transaction_type = 'settlement' THEN amount ELSE 0 END), 0) as today_settlement_amount
        FROM jumia_transactions
        WHERE created_at >= CURRENT_DATE 
        AND deleted = false
        AND branch_id::text = ${branchId}
      `;
    } else {
      todayStats = await sql`
        SELECT 
          COUNT(CASE WHEN transaction_type = 'package_receipt' THEN 1 END) as today_packages,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as today_collections,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN amount ELSE 0 END), 0) as today_collection_amount,
          COUNT(CASE WHEN transaction_type = 'settlement' THEN 1 END) as today_settlements,
          COALESCE(SUM(CASE WHEN transaction_type = 'settlement' THEN amount ELSE 0 END), 0) as today_settlement_amount
        FROM jumia_transactions
        WHERE created_at >= CURRENT_DATE 
        AND deleted = false
      `;
    }
    const todayData = todayStats[0] || {};

    // Get unsettled POD collections (collections that haven't been settled)
    let unsettledStats;
    if (branchId && branchId !== "all") {
      unsettledStats = await sql`
        SELECT 
          COUNT(*) as unsettled_count,
          COALESCE(SUM(amount), 0) as unsettled_amount
        FROM jumia_transactions
        WHERE transaction_type = 'pod_collection' 
        AND status != 'settled'
        AND deleted = false
        AND branch_id::text = ${branchId}
      `;
    } else {
      unsettledStats = await sql`
        SELECT 
          COUNT(*) as unsettled_count,
          COALESCE(SUM(amount), 0) as unsettled_amount
        FROM jumia_transactions
        WHERE transaction_type = 'pod_collection' 
        AND status != 'settled'
        AND deleted = false
      `;
    }
    const unsettledData = unsettledStats[0] || {};

    // Get daily breakdown for the last 30 days
    let dailyStats;
    if (branchId && branchId !== "all") {
      dailyStats = await sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as collections,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN CAST(amount AS DECIMAL) ELSE 0 END), 0) as collection_amount
        FROM jumia_transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND deleted = false
        AND branch_id::text = ${branchId}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
    } else {
      dailyStats = await sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount,
          COUNT(CASE WHEN transaction_type = 'pod_collection' THEN 1 END) as collections,
          COALESCE(SUM(CASE WHEN transaction_type = 'pod_collection' THEN CAST(amount AS DECIMAL) ELSE 0 END), 0) as collection_amount
        FROM jumia_transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND deleted = false
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
    }

    // Get transaction type breakdown
    let typeStats;
    if (branchId && branchId !== "all" && dateFrom && dateTo) {
      typeStats = await sql`
        SELECT 
          transaction_type,
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
        FROM jumia_transactions
        WHERE branch_id::text = ${branchId}
        AND created_at >= ${dateFrom}
        AND created_at <= ${dateTo}
        AND deleted = false
        GROUP BY transaction_type
        ORDER BY total_amount DESC
      `;
    } else if (branchId && branchId !== "all") {
      typeStats = await sql`
        SELECT 
          transaction_type,
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
        FROM jumia_transactions
        WHERE branch_id::text = ${branchId}
        AND deleted = false
        GROUP BY transaction_type
        ORDER BY total_amount DESC
      `;
    } else if (dateFrom && dateTo) {
      typeStats = await sql`
        SELECT 
          transaction_type,
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
        FROM jumia_transactions
        WHERE created_at >= ${dateFrom}
        AND created_at <= ${dateTo}
        AND deleted = false
        GROUP BY transaction_type
        ORDER BY total_amount DESC
      `;
    } else {
      typeStats = await sql`
        SELECT 
          transaction_type,
          COUNT(*) as count,
          COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
        FROM jumia_transactions
        WHERE deleted = false
        GROUP BY transaction_type
        ORDER BY total_amount DESC
      `;
    }

    // Get Jumia float account balance for this branch
    let float_balance = 0;
    if (branchId && branchId !== "all") {
      const floatResult = await sql`
        SELECT current_balance FROM float_accounts WHERE branch_id = ${branchId} AND account_type = 'jumia' AND is_active = true LIMIT 1
      `;
      if (floatResult.length > 0 && floatResult[0].current_balance != null) {
        float_balance = Number.parseFloat(floatResult[0].current_balance);
      }
    }

    const statistics = {
      // Main statistics for frontend cards - Clear naming
      todayPackages: Number(todayData.today_packages || 0),
      totalPackages: Number(stats.package_count || 0),
      todayCollections: Number(todayData.today_collections || 0),
      totalCollections: Number(stats.pod_count || 0),
      todayCollectionAmount: Number(todayData.today_collection_amount || 0),
      totalCollectionAmount: Number(stats.pod_amount || 0),
      todaySettlements: Number(todayData.today_settlements || 0),
      totalSettlements: Number(stats.settlement_count || 0),
      todaySettlementAmount: Number(todayData.today_settlement_amount || 0),
      totalSettlementAmount: Number(stats.settlement_amount || 0),
      unsettledCollections: Number(unsettledData.unsettled_count || 0),
      unsettledAmount: Number(unsettledData.unsettled_amount || 0),
      floatBalance: float_balance,

      // Legacy compatibility fields
      todayTransactions: Number(todayData.today_collections || 0),
      totalTransactions: Number(stats.pod_count || 0),
      todayVolume: Number(todayData.today_collection_amount || 0),
      totalVolume: Number(stats.pod_amount || 0),
      todayCommission: Number(todayData.today_collection_amount || 0),
      totalCommission: Number(stats.pod_amount || 0),
      activeProviders: 1,
      lowFloatAlerts: 0,
      float_balance,

      // Additional detailed data
      summary: {
        totalCount: Number(stats.total_count || 0),
        totalAmount: Number(stats.total_amount || 0),
        packageCount: Number(stats.package_count || 0),
        podCount: Number(stats.pod_count || 0),
        podAmount: Number(stats.pod_amount || 0),
        settlementCount: Number(stats.settlement_count || 0),
        settlementAmount: Number(stats.settlement_amount || 0),
        todayPackages: Number(todayData.today_packages || 0),
        todayCollections: Number(todayData.today_collections || 0),
        todayCollectionAmount: Number(todayData.today_collection_amount || 0),
        todaySettlements: Number(todayData.today_settlements || 0),
        todaySettlementAmount: Number(todayData.today_settlement_amount || 0),
        unsettledCollections: Number(unsettledData.unsettled_count || 0),
        unsettledAmount: Number(unsettledData.unsettled_amount || 0),
      },

      // Daily breakdown
      dailyBreakdown: dailyStats.map((row: any) => ({
        date: row.date,
        transactions: Number(row.count || 0),
        volume: Number(row.total_amount || 0),
        collections: Number(row.collections || 0),
        collectionAmount: Number(row.collection_amount || 0),
        commission: Number(row.collection_amount || 0) * 0.01, // 1% commission
      })),

      // Transaction type breakdown
      typeBreakdown: typeStats.map((row: any) => ({
        type: row.transaction_type,
        count: Number(row.count || 0),
        amount: Number(row.total_amount || 0),
      })),
    };

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching Jumia statistics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Jumia statistics" },
      { status: 500 }
    );
  }
}
