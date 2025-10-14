import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const inventoryType = searchParams.get("type");
    const branchId = searchParams.get("branchId");

    // Build filters
    const typeFilter = inventoryType
      ? sql`AND ii.inventory_type = ${inventoryType}`
      : sql``;

    const effectiveBranchId =
      user.role === "Admin" && branchId ? branchId : user.branchId;
    const branchFilter = effectiveBranchId
      ? sql`AND ii.branch_id = ${effectiveBranchId}`
      : sql``;

    // Fetch issued inventory items
    const items = await sql`
      SELECT 
        ii.*,
        b.batch_code,
        b.inventory_type as batch_inventory_type,
        b.card_type,
        br.name as branch_name,
        u.first_name || ' ' || u.last_name as issued_by_name
      FROM inventory_issued ii
      LEFT JOIN ezwich_card_batches b ON ii.batch_id = b.id
      LEFT JOIN branches br ON ii.branch_id = br.id
      LEFT JOIN users u ON ii.user_id = u.id
      WHERE 1=1
      ${typeFilter}
      ${branchFilter}
      ORDER BY ii.issued_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    console.error("Error fetching issued inventory:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch issued inventory",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
