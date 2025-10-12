import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification-service";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 [INVENTORY] Checking for low stock items...");

    // Get system-wide low stock threshold (default 10%)
    const thresholdResult = await sql`
      SELECT COALESCE(value, '10') as threshold 
      FROM system_settings 
      WHERE key = 'low_stock_threshold_percentage'
      LIMIT 1
    `;
    const lowStockThreshold = Number(thresholdResult[0]?.threshold || 10) / 100;

    // Get all active batches with stock levels
    const batches = await sql`
      SELECT 
        b.id,
        b.batch_code,
        b.inventory_type,
        b.quantity_received,
        b.quantity_issued,
        b.quantity_available,
        b.unit_cost,
        b.branch_id,
        b.branch_name,
        b.card_type,
        b.created_at,
        br.name as branch_display_name
      FROM ezwich_card_batches b
      LEFT JOIN branches br ON b.branch_id = br.id
      WHERE b.quantity_available > 0
      ORDER BY b.quantity_available ASC, b.created_at DESC
    `;

    // Analyze stock levels
    const lowStockItems = [];
    const outOfStockItems = [];
    const warningItems = [];

    for (const batch of batches) {
      const utilization =
        (batch.quantity_received - batch.quantity_available) /
        batch.quantity_received;
      const availablePercentage = 1 - utilization;

      const item = {
        id: batch.id,
        batchCode: batch.batch_code,
        inventoryType: batch.inventory_type,
        quantityReceived: batch.quantity_received,
        quantityIssued: batch.quantity_issued,
        quantityAvailable: batch.quantity_available,
        availablePercentage: Math.round(availablePercentage * 100),
        utilization: Math.round(utilization * 100),
        unitCost: Number(batch.unit_cost),
        totalValue: batch.quantity_available * Number(batch.unit_cost),
        branchId: batch.branch_id,
        branchName: batch.branch_display_name || batch.branch_name,
        cardType: batch.card_type,
        daysInStock: Math.floor(
          (Date.now() - new Date(batch.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      };

      // Categorize by stock level
      if (availablePercentage <= 0.05) {
        // 5% or less - CRITICAL
        outOfStockItems.push({ ...item, alertLevel: "critical" });
      } else if (availablePercentage <= lowStockThreshold) {
        // Below threshold - LOW
        lowStockItems.push({ ...item, alertLevel: "low" });
      } else if (availablePercentage <= lowStockThreshold + 0.05) {
        // Within 5% of threshold - WARNING
        warningItems.push({ ...item, alertLevel: "warning" });
      }
    }

    const summary = {
      totalBatches: batches.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      warningCount: warningItems.length,
      healthyCount:
        batches.length -
        lowStockItems.length -
        outOfStockItems.length -
        warningItems.length,
      lowStockThresholdPercentage: lowStockThreshold * 100,
    };

    console.log(`✅ [INVENTORY] Stock check complete:`, {
      critical: outOfStockItems.length,
      low: lowStockItems.length,
      warning: warningItems.length,
    });

    return NextResponse.json({
      success: true,
      summary,
      alerts: {
        critical: outOfStockItems,
        low: lowStockItems,
        warning: warningItems,
      },
    });
  } catch (error) {
    console.error("❌ [INVENTORY] Error checking low stock:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check stock levels",
      },
      { status: 500 }
    );
  }
}

// POST endpoint to send low stock alerts
export async function POST(request: NextRequest) {
  try {
    const { sendNotifications, alertLevel } = await request.json();

    console.log("📢 [INVENTORY] Sending low stock alerts...");

    // Get low stock items
    const checkResponse = await fetch(
      `${request.nextUrl.origin}/api/inventory/low-stock-check`
    );
    const checkData = await checkResponse.json();

    if (!checkData.success) {
      throw new Error("Failed to check stock levels");
    }

    const { critical, low, warning } = checkData.alerts;

    // Filter based on alert level
    let itemsToAlert = [];
    if (alertLevel === "all") {
      itemsToAlert = [...critical, ...low, ...warning];
    } else if (alertLevel === "critical") {
      itemsToAlert = critical;
    } else if (alertLevel === "low") {
      itemsToAlert = [...critical, ...low];
    }

    if (itemsToAlert.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No low stock items to alert",
        alertsSent: 0,
      });
    }

    // Get Admin and Manager users to notify
    const usersToNotify = await sql`
      SELECT DISTINCT id, first_name, last_name, email, role, branch_id
      FROM users
      WHERE role IN ('Admin', 'Manager', 'Finance')
        AND is_active = true
    `;

    let alertsSent = 0;

    // Send notifications to users
    for (const user of usersToNotify) {
      // Filter items relevant to this user's branch (unless Admin)
      const relevantItems =
        user.role === "Admin"
          ? itemsToAlert
          : itemsToAlert.filter((item) => item.branchId === user.branch_id);

      if (relevantItems.length === 0) continue;

      // Create notification message
      const criticalCount = relevantItems.filter(
        (i) => i.alertLevel === "critical"
      ).length;
      const lowCount = relevantItems.filter(
        (i) => i.alertLevel === "low"
      ).length;
      const warningCount = relevantItems.filter(
        (i) => i.alertLevel === "warning"
      ).length;

      let message = "Inventory Alert: ";
      if (criticalCount > 0)
        message += `${criticalCount} critical stock items, `;
      if (lowCount > 0) message += `${lowCount} low stock items, `;
      if (warningCount > 0) message += `${warningCount} items need attention`;
      message = message.replace(/, $/, ""); // Remove trailing comma

      try {
        // Send in-app notification
        await sql`
          INSERT INTO notifications (
            user_id, 
            type, 
            title, 
            message, 
            metadata, 
            priority, 
            status
          )
          VALUES (
            ${user.id},
            'inventory_alert',
            'Low Inventory Stock Alert',
            ${message},
            ${JSON.stringify({ items: relevantItems, timestamp: new Date() })},
            ${criticalCount > 0 ? "high" : lowCount > 0 ? "medium" : "low"},
            'unread'
          )
        `;

        alertsSent++;
        console.log(
          `✅ [INVENTORY] Alert sent to ${user.first_name} ${user.last_name}`
        );
      } catch (error) {
        console.error(
          `❌ [INVENTORY] Failed to send alert to user ${user.id}:`,
          error
        );
      }
    }

    console.log(`✅ [INVENTORY] Sent ${alertsSent} low stock alerts`);

    return NextResponse.json({
      success: true,
      message: `Sent ${alertsSent} low stock alerts`,
      alertsSent,
      itemsChecked: itemsToAlert.length,
    });
  } catch (error) {
    console.error("❌ [INVENTORY] Error sending low stock alerts:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send alerts",
      },
      { status: 500 }
    );
  }
}
