import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const packageId = params.id;

    // Get current user for authentication
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if package exists and belongs to user's branch
    const existingPackage = await sql`
      SELECT * FROM jumia_packages 
      WHERE id = ${packageId} AND branch_id = ${user.branchId}
    `;

    if (existingPackage.length === 0) {
      return NextResponse.json(
        { success: false, error: "Package not found or access denied" },
        { status: 404 }
      );
    }

    // Delete the package
    await sql`
      DELETE FROM jumia_packages 
      WHERE id = ${packageId} AND branch_id = ${user.branchId}
    `;

    return NextResponse.json({
      success: true,
      message: "Package deleted successfully",
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