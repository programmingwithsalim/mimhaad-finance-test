import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    console.log("[COMMISSION ANALYTICS] Fetching commission analytics data");

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "6");

    console.log("[COMMISSION ANALYTICS] Requested months:", months);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    console.log("[COMMISSION ANALYTICS] Date range:", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Check user permissions
    const canViewAllBranches = user.role === "admin" || user.role === "finance";

    // Fetch monthly commission data by provider
    console.log(
      "[COMMISSION ANALYTICS] Building query for branch access:",
      canViewAllBranches
    );

    let monthlyResults;
    if (canViewAllBranches) {
      // Admin/Finance can see all branches
      monthlyResults = await sql`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          source_name,
          SUM(amount) as total_amount
        FROM commissions 
        WHERE created_at >= ${startDate.toISOString()} AND created_at <= ${endDate.toISOString()}
        GROUP BY DATE_TRUNC('month', created_at), source_name
        ORDER BY month, source_name
      `;
    } else {
      // Regular users see only their branch
      monthlyResults = await sql`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          source_name,
          SUM(amount) as total_amount
        FROM commissions 
        WHERE created_at >= ${startDate.toISOString()} 
          AND created_at <= ${endDate.toISOString()}
          AND branch_id = ${user.branchId}
        GROUP BY DATE_TRUNC('month', created_at), source_name
        ORDER BY month, source_name
      `;
    }

    console.log(
      "[COMMISSION ANALYTICS] Raw monthly results:",
      monthlyResults.length
    );

    // Transform data for chart
    const monthlyData: { [key: string]: any } = {};
    const providers = new Set<string>();

    monthlyResults.forEach((row: any) => {
      const monthKey = new Date(row.month).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      const provider = row.source_name;
      const amount = parseFloat(row.total_amount);

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey };
      }

      monthlyData[monthKey][provider] = amount;
      providers.add(provider);
    });

    // Convert to array and fill missing months with zeros
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    const chartData = sortedMonths.map((month) => {
      const dataPoint = { month };
      providers.forEach((provider) => {
        dataPoint[provider] = monthlyData[month][provider] || 0;
      });
      return dataPoint;
    });

    // Calculate provider totals
    const providerTotals = Array.from(providers)
      .map((provider) => {
        const total = chartData.reduce((sum, month) => {
          return sum + (month[provider] || 0);
        }, 0);

        return {
          provider,
          total,
        };
      })
      .sort((a, b) => b.total - a.total);

    console.log("[COMMISSION ANALYTICS] Final data:", {
      chartDataLength: chartData.length,
      providerTotalsLength: providerTotals.length,
      providers: Array.from(providers),
    });

    return NextResponse.json({
      success: true,
      data: {
        monthlyData: chartData,
        providerTotals,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          months,
        },
      },
    });
  } catch (error) {
    console.error("[COMMISSION ANALYTICS] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch commission analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
