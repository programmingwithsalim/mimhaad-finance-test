import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    // Get current user for authentication
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      console.warn("Authentication failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const floatAccountId = searchParams.get("floatAccountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!floatAccountId) {
      return NextResponse.json(
        { error: "Float account ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(floatAccountId)) {
      return NextResponse.json(
        { error: "Invalid float account ID format" },
        { status: 400 }
      );
    }

    // Build the query with optional date filters
    let query = `
      SELECT * FROM get_comprehensive_float_statement($1, $2, $3)
      ORDER BY transaction_date DESC
    `;

    const params = [floatAccountId, startDate || null, endDate || null];

    const result = await sql.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching comprehensive float statement:", error);
    return NextResponse.json(
      { error: "Failed to fetch float statement" },
      { status: 500 }
    );
  }
}
