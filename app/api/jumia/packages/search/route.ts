import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// GET - Search packages by tracking number
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingId = searchParams.get("trackingId");
    const branchId = searchParams.get("branchId");

    if (!trackingId) {
      return NextResponse.json(
        { success: false, error: "Missing tracking ID" },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const isAdmin = user.role === "Admin" || user.role === "admin";
    const userBranchId = user.branchId;
    const searchBranchId = branchId || userBranchId;

    // Search for package by tracking ID
    const packages = await sql`
      SELECT 
        id,
        tracking_id,
        customer_name,
        customer_phone,
        status,
        received_at,
        delivered_at,
        settled_at,
        notes
      FROM jumia_packages 
      WHERE tracking_id = ${trackingId} 
      AND branch_id = ${searchBranchId}
      ORDER BY created_at DESC
    `;

    if (packages.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Package not found",
      });
    }

    return NextResponse.json({
      success: true,
      data: packages[0], // Return the most recent package with this tracking ID
    });
  } catch (error) {
    console.error("Error searching Jumia package:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search package",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
