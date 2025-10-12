import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }
    // Query transactions
    const transactions = await sql`
      SELECT * FROM agency_banking_transactions
      WHERE branch_id = ${branchId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    // Get total count
    const countResult = await sql`
      SELECT COUNT(*)::int as count FROM agency_banking_transactions WHERE branch_id = ${branchId}
    `;
    const total = countResult[0]?.count || 0;
    return NextResponse.json({ success: true, transactions, total });
  } catch (error) {
    console.error("Error fetching agency banking transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transactions",
        transactions: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}
