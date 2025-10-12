import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;

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

    // Get the asset
    const result = await sql`
      SELECT 
        id,
        name,
        description,
        category,
        purchase_date as "purchaseDate",
        purchase_cost as "purchaseCost",
        salvage_value as "salvageValue",
        useful_life as "usefulLife",
        depreciation_method as "depreciationMethod",
        current_value as "currentValue",
        accumulated_depreciation as "accumulatedDepreciation",
        branch_id as "branchId",
        branch_name as "branchName",
        status,
        location,
        serial_number as "serialNumber",
        supplier,
        warranty_expiry as "warrantyExpiry",
        last_maintenance as "lastMaintenance",
        next_maintenance as "nextMaintenance",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM fixed_assets
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    const asset = result[0];

    // Check if user has access to this asset
    if (user.role !== "admin" && asset.branch_id !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Format the response
    const formattedAsset = {
      id: asset.id,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      purchaseDate: asset.purchase_date,
      purchaseCost: Number(asset.purchase_cost),
      salvageValue: Number(asset.salvage_value),
      usefulLife: Number(asset.useful_life),
      depreciationMethod: asset.depreciation_method,
      currentValue: Number(asset.current_value),
      accumulatedDepreciation: Number(asset.accumulated_depreciation),
      branchId: asset.branch_id,
      branchName: asset.branch_name,
      status: asset.status,
      location: asset.location,
      serialNumber: asset.serial_number,
      supplier: asset.supplier,
      warrantyExpiry: asset.warranty_expiry,
      lastMaintenance: asset.last_maintenance,
      nextMaintenance: asset.next_maintenance,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
    };

    return NextResponse.json({
      success: true,
      asset: formattedAsset,
    });
  } catch (error) {
    console.error("Error fetching fixed asset:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch fixed asset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      name,
      description,
      category,
      purchaseDate,
      purchaseCost,
      salvageValue,
      usefulLife,
      depreciationMethod,
      location,
      serialNumber,
      supplier,
      warrantyExpiry,
      status,
    } = body;

    // Validate required fields
    if (!name || !category || !purchaseDate || !purchaseCost || !usefulLife) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get user context
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

    // Check if asset exists and user has access
    const existingAsset = await sql`
      SELECT branch_id FROM fixed_assets WHERE id = ${id}
    `;

    if (existingAsset.length === 0) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    if (user.role !== "admin" && existingAsset[0].branch_id !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Calculate updated values
    const cost = Number(purchaseCost);
    const salvage = Number(salvageValue || 0);
    const life = Number(usefulLife);

    // Recalculate depreciation if needed
    const purchaseDateObj = new Date(purchaseDate);
    const currentDate = new Date();
    const yearsSincePurchase =
      (currentDate.getTime() - purchaseDateObj.getTime()) /
      (1000 * 60 * 60 * 24 * 365.25);

    let accumulatedDepreciation = 0;
    let currentValue = cost;

    if (depreciationMethod === "straight-line" && yearsSincePurchase > 0) {
      const annualDepreciation = (cost - salvage) / life;
      accumulatedDepreciation = Math.min(
        annualDepreciation * yearsSincePurchase,
        cost - salvage
      );
      currentValue = cost - accumulatedDepreciation;
    }

    // Update the asset
    const result = await sql`
      UPDATE fixed_assets SET
        name = ${name},
        description = ${description || ""},
        category = ${category},
        purchase_date = ${purchaseDate},
        purchase_cost = ${cost},
        salvage_value = ${salvage},
        useful_life = ${life},
        depreciation_method = ${depreciationMethod || "straight-line"},
        current_value = ${currentValue},
        accumulated_depreciation = ${accumulatedDepreciation},
        status = ${status || "active"},
        location = ${location || ""},
        serial_number = ${serialNumber || null},
        supplier = ${supplier || null},
        warranty_expiry = ${warrantyExpiry || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    const asset = result[0];

    // Format the response
    const formattedAsset = {
      id: asset.id,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      purchaseDate: asset.purchase_date,
      purchaseCost: Number(asset.purchase_cost),
      salvageValue: Number(asset.salvage_value),
      usefulLife: Number(asset.useful_life),
      depreciationMethod: asset.depreciation_method,
      currentValue: Number(asset.current_value),
      accumulatedDepreciation: Number(asset.accumulated_depreciation),
      branchId: asset.branch_id,
      branchName: asset.branch_name,
      status: asset.status,
      location: asset.location,
      serialNumber: asset.serial_number,
      supplier: asset.supplier,
      warrantyExpiry: asset.warranty_expiry,
      lastMaintenance: asset.last_maintenance,
      nextMaintenance: asset.next_maintenance,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
    };

    return NextResponse.json({
      success: true,
      asset: formattedAsset,
      message: "Fixed asset updated successfully",
    });
  } catch (error) {
    console.error("Error updating fixed asset:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update fixed asset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;

    // Get user context
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

    // Check if asset exists and user has access
    const existingAsset = await sql`
      SELECT branch_id FROM fixed_assets WHERE id = ${id}
    `;

    if (existingAsset.length === 0) {
      return NextResponse.json(
        { success: false, error: "Asset not found" },
        { status: 404 }
      );
    }

    if (user.role !== "admin" && existingAsset[0].branch_id !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Delete the asset
    await sql`DELETE FROM fixed_assets WHERE id = ${id}`;

    return NextResponse.json({
      success: true,
      message: "Fixed asset deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting fixed asset:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete fixed asset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
