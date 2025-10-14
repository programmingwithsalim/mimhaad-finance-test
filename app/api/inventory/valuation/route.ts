import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const inventoryType = searchParams.get("inventoryType");

    // Get current user for role-based access
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
        ? sql`AND b.branch_id = ${effectiveBranchId}`
        : sql``;

    // Build inventory type filter
    const typeFilter = inventoryType
      ? sql`AND b.inventory_type = ${inventoryType}`
      : sql``;

    console.log("[INVENTORY] Generating valuation report...");

    // Get detailed valuation by inventory type
    const valuationByType = await sql`
      SELECT 
        b.inventory_type,
        COUNT(DISTINCT b.id) as batch_count,
        SUM(b.quantity_received) as total_received,
        SUM(b.quantity_issued) as total_issued,
        SUM(b.quantity_available) as total_available,
        ROUND(AVG(b.unit_cost)::numeric, 2) as avg_unit_cost,
        SUM(b.total_cost) as total_cost,
        SUM(b.quantity_available * b.unit_cost) as current_value,
        SUM(b.quantity_issued * b.unit_cost) as issued_value
      FROM ezwich_card_batches b
      WHERE 1=1
        ${branchFilter}
        ${typeFilter}
      GROUP BY b.inventory_type
      ORDER BY current_value DESC
    `;

    // Get detailed batch listing
    const detailedBatches = await sql`
      SELECT 
        b.id,
        b.batch_code,
        b.inventory_type,
        b.card_type,
        b.quantity_received,
        b.quantity_issued,
        b.quantity_available,
        b.unit_cost,
        b.total_cost,
        (b.quantity_available * b.unit_cost) as current_value,
        (b.quantity_issued * b.unit_cost) as issued_value,
        b.branch_id,
        b.branch_name,
        br.name as branch_display_name,
        b.partner_bank_name,
        b.created_at,
        b.expiry_date,
        CASE 
          WHEN b.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN b.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'active'
        END as expiry_status
      FROM ezwich_card_batches b
      LEFT JOIN branches br ON b.branch_id = br.id
      WHERE 1=1
        ${branchFilter}
        ${typeFilter}
      ORDER BY b.created_at DESC
    `;

    // Calculate summary metrics
    const totalReceived = valuationByType.reduce(
      (sum, item) => sum + Number(item.total_received),
      0
    );
    const totalIssued = valuationByType.reduce(
      (sum, item) => sum + Number(item.total_issued),
      0
    );
    const totalAvailable = valuationByType.reduce(
      (sum, item) => sum + Number(item.total_available),
      0
    );
    const totalCurrentValue = valuationByType.reduce(
      (sum, item) => sum + Number(item.current_value),
      0
    );
    const totalIssuedValue = valuationByType.reduce(
      (sum, item) => sum + Number(item.issued_value),
      0
    );
    const totalInvestedValue = valuationByType.reduce(
      (sum, item) => sum + Number(item.total_cost),
      0
    );

    // Get valuation by branch (for Admin)
    let valuationByBranch = [];
    if (user.role === "Admin") {
      valuationByBranch = await sql`
        SELECT 
          b.branch_id,
          b.branch_name,
          br.name as branch_display_name,
          COUNT(DISTINCT b.id) as batch_count,
          SUM(b.quantity_available) as total_available,
          SUM(b.quantity_available * b.unit_cost) as current_value
        FROM ezwich_card_batches b
        LEFT JOIN branches br ON b.branch_id = br.id
        WHERE 1=1
          ${typeFilter}
        GROUP BY b.branch_id, b.branch_name, br.name
        ORDER BY current_value DESC
      `;
    }

    // Calculate inventory turnover metrics
    const turnoverRate =
      totalReceived > 0 ? (totalIssued / totalReceived) * 100 : 0;
    const utilizationRate =
      totalReceived > 0 ? (totalIssued / totalReceived) * 100 : 0;

    const summary = {
      totalBatches: detailedBatches.length,
      totalReceived,
      totalIssued,
      totalAvailable,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
      totalIssuedValue: Math.round(totalIssuedValue * 100) / 100,
      totalInvestedValue: Math.round(totalInvestedValue * 100) / 100,
      shrinkage:
        Math.round(
          (totalInvestedValue - (totalCurrentValue + totalIssuedValue)) * 100
        ) / 100,
    };

    console.log(`[INVENTORY] Valuation report generated:`, {
      batches: detailedBatches.length,
      value: totalCurrentValue,
    });

    return NextResponse.json({
      success: true,
      summary,
      byType: valuationByType.map((item) => ({
        inventoryType: item.inventory_type,
        batchCount: Number(item.batch_count),
        totalReceived: Number(item.total_received),
        totalIssued: Number(item.total_issued),
        totalAvailable: Number(item.total_available),
        avgUnitCost: Number(item.avg_unit_cost),
        totalCost: Number(item.total_cost),
        currentValue: Number(item.current_value),
        issuedValue: Number(item.issued_value),
      })),
      byBranch: valuationByBranch.map((item) => ({
        branchId: item.branch_id,
        branchName: item.branch_display_name || item.branch_name,
        batchCount: Number(item.batch_count),
        totalAvailable: Number(item.total_available),
        currentValue: Number(item.current_value),
      })),
      detailedBatches: detailedBatches.map((batch) => ({
        id: batch.id,
        batchCode: batch.batch_code,
        inventoryType: batch.inventory_type,
        cardType: batch.card_type,
        quantityReceived: batch.quantity_received,
        quantityIssued: batch.quantity_issued,
        quantityAvailable: batch.quantity_available,
        unitCost: Number(batch.unit_cost),
        totalCost: Number(batch.total_cost),
        currentValue: Number(batch.current_value),
        issuedValue: Number(batch.issued_value),
        branchId: batch.branch_id,
        branchName: batch.branch_display_name || batch.branch_name,
        partnerBankName: batch.partner_bank_name,
        createdAt: batch.created_at,
        expiryDate: batch.expiry_date,
        expiryStatus: batch.expiry_status,
        daysInStock: Math.floor(
          (Date.now() - new Date(batch.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      })),
    });
  } catch (error) {
    console.error("[INVENTORY] Error generating valuation report:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate valuation report",
      },
      { status: 500 }
    );
  }
}
