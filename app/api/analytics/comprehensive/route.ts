"use server";

import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const timeRange = searchParams.get("timeRange") || "7d";
    const userRole = searchParams.get("userRole");
    const userBranchId = searchParams.get("userBranchId");
    const branch = searchParams.get("branch");
    const forceSeed = searchParams.get("forceSeed") === "true";

    // Calculate date range based on timeRange
    const endDate = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case "1d":
        startDate.setDate(endDate.getDate() - 1);
        break;
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Role-based access control
    const isAdmin = userRole === "Admin";
    const effectiveBranchId = isAdmin ? branch : userBranchId;

    // Build branch filter for SQL queries
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? `AND branch_id = '${effectiveBranchId}'`
        : "";

    // First, check if we have any data at all
    const dataCheckQuery = `
      SELECT 
        (SELECT COUNT(*) FROM momo_transactions) as momo_count,
        (SELECT COUNT(*) FROM agency_banking_transactions) as agency_count,
        (SELECT COUNT(*) FROM power_transactions) as power_count,
        (SELECT COUNT(*) FROM e_zwich_withdrawals) as ezwich_count,
        (SELECT COUNT(*) FROM jumia_transactions) as jumia_count,
        (SELECT COUNT(*) FROM branches) as branch_count,
        (SELECT COUNT(*) FROM float_accounts) as float_count
    `;

    const dataCheck = await sql.unsafe(dataCheckQuery);
    console.log("Data check result:", dataCheck);
    console.log("Data check first row:", (dataCheck as any)[0]);

    // Also check individual tables for debugging
    const momoCount =
      await sql`SELECT COUNT(*) as count FROM momo_transactions`;
    const agencyCount =
      await sql`SELECT COUNT(*) as count FROM agency_banking_transactions`;
    const powerCount =
      await sql`SELECT COUNT(*) as count FROM power_transactions`;
    const branchCount = await sql`SELECT COUNT(*) as count FROM branches`;
    const floatCount = await sql`SELECT COUNT(*) as count FROM float_accounts`;

    console.log("Individual counts:", {
      momo: momoCount[0]?.count,
      agency: agencyCount[0]?.count,
      power: powerCount[0]?.count,
      branches: branchCount[0]?.count,
      float: floatCount[0]?.count,
    });

    // Check if tables exist
    try {
      const tableCheck = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('momo_transactions', 'agency_banking_transactions', 'power_transactions', 'branches', 'float_accounts')
      `;
      console.log(
        "Available tables:",
        tableCheck.map((t: any) => t.table_name)
      );
  } catch (error) {
      console.log("Error checking tables:", error);
    }

    // Get comprehensive transaction metrics - simplified queries
    const transactionMetricsQuery = sql`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_fees,
        COALESCE(AVG(amount), 0) as avg_transaction_value,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT branch_id) as active_branches
      FROM (
        SELECT amount, COALESCE(fee, 0) as fee, user_id::text, branch_id::text FROM agency_banking_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT amount, COALESCE(fee, 0) as fee, user_id::text, branch_id::text FROM momo_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT amount, COALESCE(fee, 0) as fee, user_id::text, branch_id::text FROM e_zwich_withdrawals 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT amount, COALESCE(fee, 0) as fee, user_id::text, branch_id::text FROM power_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT amount, COALESCE(fee, 0) as fee, user_id::text, branch_id::text FROM jumia_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
      ) as all_transactions
    `;

    // Get revenue metrics - simplified
    const revenueMetricsQuery = sql`
      SELECT 
        COALESCE(SUM(commission_amount), 0) as total_commission_revenue,
        COALESCE(SUM(expense_amount), 0) as total_expenses,
        COALESCE(SUM(fee_revenue), 0) as total_fee_revenue
      FROM (
        SELECT 
          COALESCE(SUM(amount), 0) as commission_amount,
          0 as expense_amount,
          0 as fee_revenue
        FROM commissions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT 
          0 as commission_amount,
          COALESCE(SUM(amount), 0) as expense_amount,
          0 as fee_revenue
        FROM expenses 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
      ) as revenue_data
    `;

    // Get service performance breakdown - simplified
    const servicePerformanceQuery = sql`
      SELECT 
        service_type,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(fee), 0) as total_fees,
        COALESCE(AVG(amount), 0) as avg_transaction_value
      FROM (
        SELECT 'agency_banking' as service_type, amount, COALESCE(fee, 0) as fee FROM agency_banking_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT 'momo' as service_type, amount, COALESCE(fee, 0) as fee FROM momo_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT 'e_zwich' as service_type, amount, COALESCE(fee, 0) as fee FROM e_zwich_withdrawals 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT 'power' as service_type, amount, COALESCE(fee, 0) as fee FROM power_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT 'jumia' as service_type, amount, COALESCE(fee, 0) as fee FROM jumia_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
      ) as service_data
      GROUP BY service_type
      ORDER BY total_volume DESC
    `;

    // Get branch performance - simplified
    const branchPerformanceQuery = sql`
      SELECT 
        b.id,
        b.name,
        b.location,
        COUNT(t.transaction_id) as total_transactions,
        COALESCE(SUM(t.amount), 0) as total_volume,
        COALESCE(SUM(t.fee), 0) as total_fees
      FROM branches b
      LEFT JOIN (
        SELECT branch_id::text, id as transaction_id, amount, COALESCE(fee, 0) as fee FROM agency_banking_transactions 
        WHERE created_at >= ${startDate.toISOString()}
        UNION ALL
        SELECT branch_id::text, id as transaction_id, amount, COALESCE(fee, 0) as fee FROM momo_transactions 
        WHERE created_at >= ${startDate.toISOString()}
        UNION ALL
        SELECT branch_id::text, id as transaction_id, amount, COALESCE(fee, 0) as fee FROM e_zwich_withdrawals 
        WHERE created_at >= ${startDate.toISOString()}
        UNION ALL
        SELECT branch_id::text, id as transaction_id, amount, COALESCE(fee, 0) as fee FROM power_transactions 
        WHERE created_at >= ${startDate.toISOString()}
        UNION ALL
        SELECT branch_id::text, id as transaction_id, amount, COALESCE(fee, 0) as fee FROM jumia_transactions 
        WHERE created_at >= ${startDate.toISOString()}
      ) t ON b.id::text = t.branch_id
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`WHERE b.id = ${effectiveBranchId}`
          : sql``
      }
      GROUP BY b.id, b.name, b.location
      ORDER BY total_volume DESC
    `;

    // Get time series data - simplified
    const timeSeriesQuery = sql`
        SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as volume,
          COALESCE(SUM(fee), 0) as fees
      FROM (
        SELECT created_at, amount, COALESCE(fee, 0) as fee FROM agency_banking_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT created_at, amount, COALESCE(fee, 0) as fee FROM momo_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT created_at, amount, COALESCE(fee, 0) as fee FROM e_zwich_withdrawals 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT created_at, amount, COALESCE(fee, 0) as fee FROM power_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        UNION ALL
        SELECT created_at, amount, COALESCE(fee, 0) as fee FROM jumia_transactions 
        WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
      ) as all_transactions
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Get customer metrics - simplified
    const customerMetricsQuery = sql`
      SELECT 
        COUNT(DISTINCT customer_name) as unique_customers,
        COUNT(*) as total_transactions,
        COUNT(DISTINCT CASE WHEN transaction_count > 1 THEN customer_name END) as repeat_customers
      FROM (
        SELECT 
          customer_name,
          COUNT(*) as transaction_count
        FROM (
          SELECT customer_name FROM agency_banking_transactions 
          WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
          UNION ALL
          SELECT customer_name FROM momo_transactions 
          WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
          UNION ALL
          SELECT customer_name FROM e_zwich_withdrawals 
          WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
          UNION ALL
          SELECT customer_name FROM power_transactions 
          WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
          UNION ALL
          SELECT customer_name FROM jumia_transactions 
          WHERE created_at >= ${startDate.toISOString()} ${
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``
    }
        ) as all_customers
        GROUP BY customer_name
      ) as customer_stats
    `;

    // Get float metrics - simplified
    const floatMetricsQuery = sql`
      SELECT 
        COUNT(*) as total_accounts,
        COALESCE(SUM(current_balance), 0) as total_balance,
        COALESCE(AVG(current_balance), 0) as average_balance,
        COUNT(CASE WHEN current_balance < min_threshold THEN 1 END) as low_balance_accounts,
        COALESCE(MIN(current_balance), 0) as min_balance,
        COALESCE(MAX(current_balance), 0) as max_balance
      FROM float_accounts 
      WHERE is_active = true ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;

    // Execute all queries in parallel
    const [
      transactionMetricsResult,
      revenueMetricsResult,
      servicePerformanceResult,
      branchPerformanceResult,
      timeSeriesResult,
      customerMetricsResult,
      floatMetricsResult,
    ] = await Promise.all([
      transactionMetricsQuery,
      revenueMetricsQuery,
      servicePerformanceQuery,
      branchPerformanceQuery,
      timeSeriesQuery,
      customerMetricsQuery,
      floatMetricsQuery,
    ]);

    // Process results
    const transactionMetrics = {
      totalCount: Number(
        (transactionMetricsResult as any)[0]?.total_count || 0
      ),
      totalVolume: Number(
        (transactionMetricsResult as any)[0]?.total_volume || 0
      ),
      totalFees: Number((transactionMetricsResult as any)[0]?.total_fees || 0),
      averageTransactionValue: Number(
        (transactionMetricsResult as any)[0]?.avg_transaction_value || 0
      ),
      uniqueUsers: Number(
        (transactionMetricsResult as any)[0]?.unique_users || 0
      ),
      activeBranches: Number(
        (transactionMetricsResult as any)[0]?.active_branches || 0
      ),
    };

    const revenueMetrics = {
      totalRevenue: Number(transactionMetrics.totalFees),
      commissionRevenue: Number(
        (revenueMetricsResult as any)[0]?.total_commission_revenue || 0
      ),
      feeRevenue: Number(
        (revenueMetricsResult as any)[0]?.total_fee_revenue || 0
      ),
      totalExpenses: Number(
        (revenueMetricsResult as any)[0]?.total_expenses || 0
      ),
      netRevenue:
        Number(transactionMetrics.totalFees) -
        Number((revenueMetricsResult as any)[0]?.total_expenses || 0),
      profitMargin:
        Number(transactionMetrics.totalFees) > 0
          ? ((Number(transactionMetrics.totalFees) -
              Number((revenueMetricsResult as any)[0]?.total_expenses || 0)) /
              Number(transactionMetrics.totalFees)) *
            100
          : 0,
    };

    const servicePerformance = Array.isArray(servicePerformanceResult)
      ? servicePerformanceResult.map((service: any) => ({
          service: service.service_type.replace("_", " ").toUpperCase(),
          transactionCount: Number(service.transaction_count || 0),
          totalVolume: Number(service.total_volume || 0),
          totalFees: Number(service.total_fees || 0),
          avgTransactionValue: Number(service.avg_transaction_value || 0),
        }))
      : [];

    const branchPerformance = Array.isArray(branchPerformanceResult)
      ? branchPerformanceResult.map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          location: branch.location,
          total_transactions: Number(branch.total_transactions || 0),
          total_volume: Number(branch.total_volume || 0),
          total_fees: Number(branch.total_fees || 0),
        }))
      : [];

    const timeSeriesData = Array.isArray(timeSeriesResult)
      ? timeSeriesResult.map((row: any) => ({
          date: row.date,
          transactionCount: Number(row.transaction_count || 0),
          volume: Number(row.volume || 0),
          fees: Number(row.fees || 0),
        }))
      : [];

    const customerMetrics = {
      uniqueCustomers: Number(
        (customerMetricsResult as any)[0]?.unique_customers || 0
      ),
      totalCustomers: Number(
        (customerMetricsResult as any)[0]?.unique_customers || 0
      ),
      repeatCustomers: Number(
        (customerMetricsResult as any)[0]?.repeat_customers || 0
      ),
      repeatCustomerRate:
        Number((customerMetricsResult as any)[0]?.unique_customers || 0) > 0
          ? (Number((customerMetricsResult as any)[0]?.repeat_customers || 0) /
              Number(
                (customerMetricsResult as any)[0]?.unique_customers || 0
              )) *
            100
          : 0,
      newCustomers:
        Number((customerMetricsResult as any)[0]?.unique_customers || 0) -
        Number((customerMetricsResult as any)[0]?.repeat_customers || 0),
    };

    const floatMetrics = {
      totalAccounts: Number(
        (floatMetricsResult as any)[0]?.total_accounts || 0
      ),
      totalBalance: Number((floatMetricsResult as any)[0]?.total_balance || 0),
      averageBalance: Number(
        (floatMetricsResult as any)[0]?.average_balance || 0
      ),
      lowBalanceAccounts: Number(
        (floatMetricsResult as any)[0]?.low_balance_accounts || 0
      ),
      minBalance: Number((floatMetricsResult as any)[0]?.min_balance || 0),
      maxBalance: Number((floatMetricsResult as any)[0]?.max_balance || 0),
      utilizationRate:
        Number((floatMetricsResult as any)[0]?.total_balance || 0) > 0
          ? (Number((floatMetricsResult as any)[0]?.total_balance || 0) /
              (Number((floatMetricsResult as any)[0]?.max_balance || 0) *
                Number((floatMetricsResult as any)[0]?.total_accounts || 0))) *
            100
          : 0,
    };

    const summary = {
      totalTransactions: transactionMetrics.totalCount,
      totalRevenue: revenueMetrics.totalRevenue,
      averageTransactionValue: transactionMetrics.averageTransactionValue,
      topPerformingService:
        servicePerformance.length > 0 ? servicePerformance[0].service : "N/A",
      growthRate:
        timeSeriesData.length > 1
          ? ((timeSeriesData[timeSeriesData.length - 1].volume -
              timeSeriesData[0].volume) /
              timeSeriesData[0].volume) *
            100
          : 0,
    };

    const transactionStats = {
      totalTransactions: transactionMetrics.totalCount,
      totalVolume: transactionMetrics.totalVolume,
      averageTransaction: transactionMetrics.averageTransactionValue,
      successRate: 98.5, // This would need to be calculated from actual success/failure data
      dailyTrends: timeSeriesData.map((item) => ({
        date: item.date,
        transactions: item.transactionCount,
        volume: item.volume,
      })),
    };

    const revenueBreakdown = {
      totalRevenue: revenueMetrics.totalRevenue,
      byService: servicePerformance.reduce((acc, service) => {
        acc[service.service.toLowerCase()] = service.totalFees;
        return acc;
      }, {} as Record<string, number>),
      monthlyTrends: timeSeriesData.reduce((acc, item) => {
        const month = new Date(item.date).toLocaleString("default", {
          month: "short",
        });
        const existing = acc.find((m: any) => m.month === month);
        if (existing) {
          existing.revenue += item.fees;
        } else {
          acc.push({ month, revenue: item.fees });
        }
        return acc;
      }, [] as Array<{ month: string; revenue: number }>),
    };

    const userActivity = {
      activeUsers: transactionMetrics.uniqueUsers,
      topPerformers: [], // This would need a separate query for user performance
      branchActivity: branchPerformance.map((branch) => ({
        branch: branch.name,
        transactions: branch.total_transactions,
        volume: branch.total_volume,
      })),
    };

    return NextResponse.json({
      success: true,
      data: {
        transactionMetrics,
        revenueMetrics,
        servicePerformance,
        branchPerformance,
        timeSeriesData,
        customerMetrics,
        floatMetrics,
        summary,
        transactionStats,
        revenueBreakdown,
        userActivity,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
