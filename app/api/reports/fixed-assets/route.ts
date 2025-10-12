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
    const effectiveBranchId = user.role === "admin" ? branch : user.branchId;

    // Get fixed assets data
    const assetsResult = await sql`
      SELECT 
        id,
        name,
        description,
        category,
        purchase_date,
        purchase_cost,
        salvage_value,
        useful_life,
        depreciation_method,
        current_value,
        accumulated_depreciation,
        branch_name,
        status,
        location,
        serial_number,
        supplier,
        warranty_expiry,
        last_maintenance,
        next_maintenance,
        created_at
      FROM fixed_assets
      WHERE 1=1 ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND fixed_assets.branch_id = ${effectiveBranchId}`
          : sql``
      }
      ORDER BY category, name
    `;

    // Calculate summary statistics
    const summaryResult = await sql`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_assets,
        COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed_assets,
        COUNT(CASE WHEN status = 'under-maintenance' THEN 1 END) as maintenance_assets,
        COALESCE(SUM(purchase_cost), 0) as total_purchase_cost,
        COALESCE(SUM(current_value), 0) as total_current_value,
        COALESCE(SUM(accumulated_depreciation), 0) as total_depreciation,
        COALESCE(SUM(purchase_cost - current_value), 0) as total_depreciation_calc
      FROM fixed_assets
      WHERE 1=1 ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND fixed_assets.branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;

    // Get assets by category
    const categoryBreakdown = await sql`
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(purchase_cost), 0) as total_cost,
        COALESCE(SUM(current_value), 0) as total_value,
        COALESCE(SUM(accumulated_depreciation), 0) as total_depreciation
      FROM fixed_assets
      WHERE 1=1 ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND fixed_assets.branch_id = ${effectiveBranchId}`
          : sql``
      }
      GROUP BY category
      ORDER BY total_cost DESC
    `;

    // Get depreciation schedule for current year
    const currentYear = new Date().getFullYear();
    const depreciationSchedule = await sql`
      SELECT 
        id,
        name,
        category,
        purchase_cost,
        current_value,
        accumulated_depreciation,
        useful_life,
        depreciation_method,
        CASE 
          WHEN depreciation_method = 'straight-line' THEN 
            (purchase_cost - salvage_value) / useful_life
          ELSE 
            (purchase_cost - salvage_value) / useful_life
        END as annual_depreciation
      FROM fixed_assets
      WHERE status = 'active' 
        AND purchase_date <= CURRENT_DATE
        AND current_value > salvage_value
        ${
          effectiveBranchId && effectiveBranchId !== "all"
            ? sql`AND fixed_assets.branch_id = ${effectiveBranchId}`
            : sql``
        }
      ORDER BY annual_depreciation DESC
    `;

    const summary = summaryResult[0];
    const netBookValue = Number(summary.total_current_value) || 0;
    const totalPurchaseCost = Number(summary.total_purchase_cost) || 0;
    const totalDepreciation = Number(summary.total_depreciation) || 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAssets: Number(summary.total_assets) || 0,
          activeAssets: Number(summary.active_assets) || 0,
          disposedAssets: Number(summary.disposed_assets) || 0,
          maintenanceAssets: Number(summary.maintenance_assets) || 0,
          totalPurchaseCost,
          totalCurrentValue: netBookValue,
          totalDepreciation,
          netBookValue,
          depreciationRate:
            totalPurchaseCost > 0
              ? (totalDepreciation / totalPurchaseCost) * 100
              : 0,
        },
        assets: assetsResult,
        categoryBreakdown: categoryBreakdown,
        depreciationSchedule: depreciationSchedule,
        reportDate: new Date().toISOString(),
        generatedBy: user.name || user.email,
      },
    });
  } catch (error) {
    devLog.error("Error generating fixed assets report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate fixed assets report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
