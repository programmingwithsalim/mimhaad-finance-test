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

    // Get enhanced summary with module breakdown
    const query = `
      SELECT * FROM get_enhanced_float_statement_summary($1, $2, $3)
    `;

    const params = [floatAccountId, startDate || null, endDate || null];

    const result = await sql.query(query, params);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          opening_balance: 0,
          closing_balance: 0,
          total_deposits: 0,
          total_withdrawals: 0,
          total_fees: 0,
          transaction_count: 0,
          net_change: 0,
          module_breakdown: {},
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching enhanced float summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch float summary" },
      { status: 500 }
    );
  }
}
