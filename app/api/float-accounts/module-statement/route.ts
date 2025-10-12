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
    const module = searchParams.get("module");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!floatAccountId) {
      return NextResponse.json(
        { error: "Float account ID is required" },
        { status: 400 }
      );
    }

    if (!module) {
      return NextResponse.json(
        { error: "Module is required" },
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

    // Validate module
    const validModules = [
      "manual",
      "agency_banking",
      "momo",
      "power",
      "e_zwich",
    ];
    if (!validModules.includes(module)) {
      return NextResponse.json(
        { error: "Invalid module specified" },
        { status: 400 }
      );
    }

    // Get module-specific float statement
    const query = `
      SELECT * FROM get_module_float_statement($1, $2, $3, $4)
    `;

    const params = [floatAccountId, module, startDate || null, endDate || null];

    const result = await sql.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      module: module,
    });
  } catch (error) {
    console.error("Error fetching module float statement:", error);
    return NextResponse.json(
      { error: "Failed to fetch module float statement" },
      { status: 500 }
    );
  }
}
