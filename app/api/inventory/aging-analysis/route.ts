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

    console.log("📊 [INVENTORY] Generating aging analysis...");

    // Get all active batches with aging data
    const batches = await sql`
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
        b.branch_id,
        b.branch_name,
        br.name as branch_display_name,
        b.partner_bank_name,
        b.created_at,
        b.expiry_date,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - b.created_at)) as days_in_stock,
        CASE 
          WHEN b.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN b.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          WHEN b.expiry_date < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_later'
          ELSE 'active'
        END as expiry_status
      FROM ezwich_card_batches b
      LEFT JOIN branches br ON b.branch_id = br.id
      WHERE b.quantity_available > 0
        ${branchFilter}
        ${typeFilter}
      ORDER BY b.created_at ASC
    `;

    // Define age brackets
    const ageBrackets = {
      fresh: {
        min: 0,
        max: 30,
        label: "0-30 days (Fresh)",
        items: [] as any[],
      },
      recent: {
        min: 31,
        max: 60,
        label: "31-60 days (Recent)",
        items: [] as any[],
      },
      aging: {
        min: 61,
        max: 90,
        label: "61-90 days (Aging)",
        items: [] as any[],
      },
      old: {
        min: 91,
        max: 180,
        label: "91-180 days (Old)",
        items: [] as any[],
      },
      veryOld: {
        min: 181,
        max: Infinity,
        label: "180+ days (Very Old)",
        items: [] as any[],
      },
    };

    // Categorize batches by age
    const categorizedBatches: any[] = [];
    const slowMovingItems: any[] = [];
    const fastMovingItems: any[] = [];
    const expiringItems: any[] = [];

    for (const batch of batches) {
      const daysInStock = Math.floor(Number(batch.days_in_stock));
      const utilizationRate =
        (batch.quantity_issued / batch.quantity_received) * 100;
      const turnoverSpeed =
        daysInStock > 0 ? batch.quantity_issued / daysInStock : 0;

      const item = {
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
        branchId: batch.branch_id,
        branchName: batch.branch_display_name || batch.branch_name,
        partnerBankName: batch.partner_bank_name,
        createdAt: batch.created_at,
        expiryDate: batch.expiry_date,
        expiryStatus: batch.expiry_status,
        daysInStock,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        turnoverSpeed: Math.round(turnoverSpeed * 100) / 100,
      };

      // Categorize by age bracket
      let bracketKey: keyof typeof ageBrackets = "fresh";
      if (daysInStock >= 181) bracketKey = "veryOld";
      else if (daysInStock >= 91) bracketKey = "old";
      else if (daysInStock >= 61) bracketKey = "aging";
      else if (daysInStock >= 31) bracketKey = "recent";
      else bracketKey = "fresh";

      ageBrackets[bracketKey].items.push(item);
      categorizedBatches.push({ ...item, ageBracket: bracketKey });

      // Identify slow-moving (< 20% utilized after 30+ days)
      if (daysInStock >= 30 && utilizationRate < 20) {
        slowMovingItems.push({
          ...item,
          reason: "Low utilization rate",
          recommendation: "Consider promotion or reallocation",
        });
      }

      // Identify fast-moving (> 50% utilized in < 30 days)
      if (daysInStock < 30 && utilizationRate > 50) {
        fastMovingItems.push({
          ...item,
          reason: "High utilization rate",
          recommendation: "Consider increasing stock levels",
        });
      }

      // Track expiring items
      if (
        batch.expiry_status === "expired" ||
        batch.expiry_status === "expiring_soon"
      ) {
        expiringItems.push({
          ...item,
          urgency: batch.expiry_status === "expired" ? "critical" : "high",
          recommendation:
            batch.expiry_status === "expired"
              ? "Remove from stock immediately"
              : "Prioritize issuance",
        });
      }
    }

    // Calculate summary metrics by age bracket
    const agingSummary = Object.entries(ageBrackets).map(([key, bracket]) => ({
      bracket: key,
      label: bracket.label,
      count: bracket.items.length,
      totalQuantity: bracket.items.reduce(
        (sum, item) => sum + item.quantityAvailable,
        0
      ),
      totalValue: bracket.items.reduce(
        (sum, item) => sum + item.currentValue,
        0
      ),
      avgDaysInStock:
        bracket.items.length > 0
          ? Math.round(
              bracket.items.reduce((sum, item) => sum + item.daysInStock, 0) /
                bracket.items.length
            )
          : 0,
      avgUtilization:
        bracket.items.length > 0
          ? Math.round(
              (bracket.items.reduce(
                (sum, item) => sum + item.utilizationRate,
                0
              ) /
                bracket.items.length) *
                100
            ) / 100
          : 0,
    }));

    // Calculate reorder points based on turnover
    const reorderSuggestions = fastMovingItems.map((item) => ({
      batchCode: item.batchCode,
      inventoryType: item.inventoryType,
      currentStock: item.quantityAvailable,
      dailyTurnover: item.turnoverSpeed,
      suggestedReorderPoint: Math.ceil(item.turnoverSpeed * 30), // 30 days supply
      suggestedReorderQuantity: Math.ceil(item.turnoverSpeed * 60), // 60 days supply
      reason: "Fast-moving item - ensure adequate stock levels",
    }));

    const summary = {
      totalBatches: batches.length,
      totalValue: categorizedBatches.reduce(
        (sum, item) => sum + item.currentValue,
        0
      ),
      avgDaysInStock:
        categorizedBatches.length > 0
          ? Math.round(
              categorizedBatches.reduce(
                (sum, item) => sum + item.daysInStock,
                0
              ) / categorizedBatches.length
            )
          : 0,
      avgUtilizationRate:
        categorizedBatches.length > 0
          ? Math.round(
              (categorizedBatches.reduce(
                (sum, item) => sum + item.utilizationRate,
                0
              ) /
                categorizedBatches.length) *
                100
            ) / 100
          : 0,
      slowMovingCount: slowMovingItems.length,
      fastMovingCount: fastMovingItems.length,
      expiringCount: expiringItems.length,
      healthScore:
        Math.round(
          ((fastMovingItems.length / (batches.length || 1)) * 50 +
            (1 - slowMovingItems.length / (batches.length || 1)) * 30 +
            (1 - expiringItems.length / (batches.length || 1)) * 20) *
            100
        ) / 100,
    };

    console.log(`✅ [INVENTORY] Aging analysis complete:`, {
      batches: batches.length,
      slowMoving: slowMovingItems.length,
      fastMoving: fastMovingItems.length,
    });

    return NextResponse.json({
      success: true,
      summary,
      agingSummary,
      categorizedBatches,
      slowMovingItems,
      fastMovingItems,
      expiringItems,
      reorderSuggestions,
    });
  } catch (error) {
    console.error("❌ [INVENTORY] Error generating aging analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate aging analysis",
      },
      { status: 500 }
    );
  }
}
