import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    // Get user context
    const user = await getCurrentUser(request);
    if (!user || user.id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse pagination params
    const url = request.nextUrl;
    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    // Parse branchId from query or use user's branchId
    let branchId = searchParams.get("branchId");
    if (!branchId && user.role !== "Admin") {
      branchId = user.branchId;
    }

    // Use user's branch ID if no branch specified and user is not admin
    const effectiveBranchId = branchId || user.branchId;

    // Fetch float accounts for the effective branch
    const floatAccounts = await sql`
      SELECT 
        fa.id,
        fa.provider,
        fa.account_type,
        fa.current_balance,
        fa.branch_id,
        fa.account_number,
        COALESCE(b.name, 'Unknown Branch') as branch_name
      FROM float_accounts fa
      LEFT JOIN branches b ON fa.branch_id = b.id
      WHERE fa.branch_id = ${effectiveBranchId}
      ORDER BY fa.provider, fa.account_type
    `;

    // Fetch GL accounts (filtered by effective branch)
    const glAccounts = await sql`
      SELECT 
        id,
        code as account_code,
        name as account_name,
        type as account_type,
        is_active
      FROM gl_accounts 
      WHERE is_active = true AND branch_id = ${effectiveBranchId}
      ORDER BY code
    `;

    // Fetch existing mappings with pagination - using correct column names
    const mappings = await sql`
      SELECT 
        gm.id,
        gm.transaction_type,
        gm.gl_account_id,
        gm.float_account_id,
        gm.mapping_type,
        gm.is_active,
        gm.created_at,
        gm.updated_at
      FROM gl_mappings gm
      WHERE gm.branch_id = ${effectiveBranchId}
        AND gm.float_account_id IS NOT NULL
      ORDER BY gm.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // Get total count for pagination
    const totalResult = await sql`
      SELECT COUNT(*) as total 
      FROM gl_mappings 
      WHERE branch_id = ${effectiveBranchId}
        AND float_account_id IS NOT NULL
    `;
    const totalMappings = Number(totalResult[0]?.total || 0);

    // Enhance mappings with account details
    const enhancedMappings = mappings.map((mapping) => {
      const floatAccount = floatAccounts.find(
        (fa) => fa.id === mapping.float_account_id
      );
      const glAccount = glAccounts.find(
        (ga) => ga.id === mapping.gl_account_id
      );

      return {
        ...mapping,
        float_account: floatAccount || null,
        gl_account: glAccount || null,
      };
    });

    return NextResponse.json({
      success: true,
      floatAccounts,
      glAccounts,
      mappings: enhancedMappings,
      totalMappings,
      page,
      pageSize,
      totalPages: Math.ceil(totalMappings / pageSize),
    });
  } catch (error) {
    console.error("Error in GET /api/float-gl-mapping/manual:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch float GL mappings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user context
    const user = await getCurrentUser(request);
    if (!user || user.id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { float_account_id, gl_account_id, mapping_type, branch_id } = body;

    // Validate required fields
    if (!float_account_id || !gl_account_id || !mapping_type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Determine effective branch ID
    const effectiveBranchId = (user.role === "Admin" || user.role === "admin") 
      ? (branch_id || user.branchId) 
      : user.branchId;

    // Check if mapping already exists
    const existingMapping = await sql`
      SELECT id FROM gl_mappings 
      WHERE float_account_id = ${float_account_id} 
      AND mapping_type = ${mapping_type}
      AND branch_id = ${effectiveBranchId}
    `;

    if (existingMapping.length > 0) {
      return NextResponse.json(
        { error: "Mapping already exists for this float account and type" },
        { status: 409 }
      );
    }

    // Determine transaction_type based on float account
    const floatAccount = await sql`
      SELECT provider, account_type FROM float_accounts 
      WHERE id = ${float_account_id}
    `;

    if (floatAccount.length === 0) {
      return NextResponse.json(
        { error: "Float account not found" },
        { status: 404 }
      );
    }

    const transactionType =
      `${floatAccount[0].provider}_${floatAccount[0].account_type}`.toLowerCase();

    // Create new mapping in gl_mappings table
    const newMapping = await sql`
      INSERT INTO gl_mappings (
        transaction_type,
        gl_account_id,
        float_account_id,
        mapping_type,
        branch_id,
        is_active
      ) VALUES (
        ${transactionType},
        ${gl_account_id},
        ${float_account_id},
        ${mapping_type},
        ${effectiveBranchId},
        true
      ) RETURNING *
    `;

    return NextResponse.json({
      success: true,
      mapping: newMapping[0],
    });
  } catch (error) {
    console.error("Error in POST /api/float-gl-mapping/manual:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create float GL mapping",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get user context
    const user = getCurrentUser(request);
    if (!user || user.id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl;
    const searchParams = url.searchParams;
    const mappingId = searchParams.get("id");

    if (!mappingId) {
      return NextResponse.json(
        { error: "Mapping ID is required" },
        { status: 400 }
      );
    }

    const userBranchId = user.branchId;

    // Delete mapping (ensure it belongs to user's branch)
    const result = await sql`
      DELETE FROM gl_mappings 
      WHERE id = ${mappingId} AND branch_id = ${userBranchId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Mapping not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Mapping deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/float-gl-mapping/manual:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete float GL mapping",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
