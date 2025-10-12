import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { NotificationService } from "@/lib/services/notification-service";
import { CustomerNotificationService } from "@/lib/services/customer-notification-service";

const sql = neon(process.env.DATABASE_URL!);

export interface JumiaPackage {
  id: string;
  tracking_id: string;
  customer_name: string;
  customer_phone?: string;
  branch_id: string;
  user_id: string;
  status: "received" | "delivered" | "settled";
  received_at: string;
  delivered_at?: string;
  settled_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// GET - Get packages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Simple query to get all packages for the branch
    const packages = await sql`
      SELECT * FROM jumia_packages 
      WHERE branch_id = ${branchId || user.branchId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: packages,
      total: packages.length,
    });
  } catch (error) {
    console.error("Error getting Jumia packages:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get packages",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST - Create package
export async function POST(request: NextRequest) {
  try {
    const packageData = await request.json();

    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!packageData.tracking_id || !packageData.customer_name) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: tracking_id, customer_name",
        },
        { status: 400 }
      );
    }

    // Check if package with this tracking ID already exists
    const existingPackage = await sql`
      SELECT id FROM jumia_packages 
      WHERE tracking_id = ${packageData.tracking_id} 
      AND branch_id = ${user.branchId}
    `;

    if (existingPackage.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Package with this tracking ID already exists",
        },
        { status: 400 }
      );
    }

    // Create the package
    const newPackage = await sql`
      INSERT INTO jumia_packages (
        id,
        tracking_id,
        customer_name,
        customer_phone,
        branch_id,
        user_id,
        status,
        received_at,
        notes,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        ${packageData.tracking_id},
        ${packageData.customer_name},
        ${packageData.customer_phone || null},
        ${user.branchId},
        ${user.id},
        'received',
        NOW(),
        ${packageData.notes || null},
        NOW(),
        NOW()
      ) RETURNING *
    `;

    // Create notification for package ready for pickup
    await sql`
      INSERT INTO notifications (
        user_id,
        branch_id,
        type,
        title,
        message,
        metadata,
        priority,
        status,
        created_at
      ) VALUES (
        ${user.id},
        ${user.branchId},
        'package_received',
        'Package Ready for Pickup',
        ${`Package with tracking ID ${packageData.tracking_id} has been received from Jumia and is ready for pickup. Customer: ${packageData.customer_name}`},
        ${JSON.stringify({
          package_id: newPackage[0].id,
          tracking_id: packageData.tracking_id,
          customer_name: packageData.customer_name,
          customer_phone: packageData.customer_phone,
        })},
        'medium',
        'unread',
        NOW()
      )
    `;

    // Send SMS notification to CUSTOMER (not staff)
    if (packageData.customer_phone) {
      try {
        await CustomerNotificationService.sendCustomerNotification({
          type: "service_alert",
          title: "Package Ready for Pickup",
          message: `Your Jumia package (Tracking: ${
            packageData.tracking_id
          }) has been received and is ready for pickup at our ${
            user.branchName || "branch"
          }. Please bring a valid ID.`,
          customerPhone: packageData.customer_phone,
          customerName: packageData.customer_name,
          metadata: {
            packageId: newPackage[0].id,
            trackingId: packageData.tracking_id,
            status: "received",
          },
        });
      } catch (notificationError) {
        console.error(
          "Failed to send customer SMS notification:",
          notificationError
        );
        // Continue with package creation even if notification fails
      }
    }

    // Send in-app notification to STAFF
    await NotificationService.sendNotification({
      type: "transaction",
      title: "Package Received",
      message: `Package registered for ${packageData.customer_name}. Tracking: ${packageData.tracking_id}.`,
      userId: user.id,
      metadata: {
        packageId: newPackage[0].id,
        trackingId: packageData.tracking_id,
        customerName: packageData.customer_name,
      },
      priority: "medium",
    });

    return NextResponse.json({
      success: true,
      data: newPackage[0],
    });
  } catch (error) {
    console.error("Error creating Jumia package:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create package",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT - Update package
export async function PUT(request: NextRequest) {
  try {
    const { id, updateData } = await request.json();

    if (!id || !updateData) {
      return NextResponse.json(
        { success: false, error: "Missing id or updateData" },
        { status: 400 }
      );
    }

    const updatedPackage = await sql`
      UPDATE jumia_packages 
      SET 
        customer_name = COALESCE(${updateData.customer_name}, customer_name),
        customer_phone = COALESCE(${updateData.customer_phone}, customer_phone),
        status = COALESCE(${updateData.status}, status),
        notes = COALESCE(${updateData.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (updatedPackage.length === 0) {
      return NextResponse.json(
        { success: false, error: "Package not found" },
        { status: 404 }
      );
    }

    // Send SMS notification to CUSTOMER for package delivery
    if (updateData.status === "delivered" && updatedPackage[0].customer_phone) {
      try {
        await CustomerNotificationService.sendCustomerNotification({
          type: "service_alert",
          title: "Package Delivered",
          message: `Your Jumia package (Tracking: ${updatedPackage[0].tracking_id}) has been delivered successfully. Thank you for choosing our service!`,
          customerPhone: updatedPackage[0].customer_phone,
          customerName: updatedPackage[0].customer_name,
          metadata: {
            packageId: updatedPackage[0].id,
            trackingId: updatedPackage[0].tracking_id,
            status: "delivered",
          },
        });
      } catch (notificationError) {
        console.error(
          "Failed to send customer SMS notification:",
          notificationError
        );
        // Continue with package update even if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedPackage[0],
    });
  } catch (error) {
    console.error("Error updating Jumia package:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update package",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete package
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing package id" },
        { status: 400 }
      );
    }

    const deletedPackage = await sql`
      DELETE FROM jumia_packages 
      WHERE id = ${id}
      RETURNING *
    `;

    if (deletedPackage.length === 0) {
      return NextResponse.json(
        { success: false, error: "Package not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deletedPackage[0],
    });
  } catch (error) {
    console.error("Error deleting Jumia package:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete package",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
