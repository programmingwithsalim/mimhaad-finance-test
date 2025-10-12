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

    // Parse query parameters
    const url = request.nextUrl;
    const searchParams = url.searchParams;
    const branchId = searchParams.get("branchId");
    const search = searchParams.get("search");
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    // Determine which branch to show mappings for
    let targetBranchId = branchId;
    if (!targetBranchId) {
      if (user.role === "Admin") {
        // Admin can see all branches if no specific branch selected
        targetBranchId = null;
      } else {
        // Non-admin users can only see their branch
        targetBranchId = user.branchId;
      }
    }

    // Build the base query with joins
    let query = sql`
      SELECT 
        gm.id,
        gm.transaction_type,
        gm.mapping_type,
        gm.gl_account_id,
        gm.float_account_id,
        gm.branch_id,
        gm.is_active,
        gm.created_at,
        gm.updated_at,
        ga.code as gl_account_code,
        ga.name as gl_account_name,
        ga.type as gl_account_type,
        COALESCE(gab.current_balance, 0) as gl_account_balance,
        b.name as branch_name,
        fa.account_type as float_account_type,
        fa.provider as float_account_provider,
        fa.account_number as float_account_number,
        fa.current_balance as float_account_balance
      FROM gl_mappings gm
      LEFT JOIN gl_accounts ga ON gm.gl_account_id = ga.id
      LEFT JOIN gl_account_balances gab ON ga.id = gab.account_id::uuid
      LEFT JOIN branches b ON gm.branch_id = b.id
      LEFT JOIN float_accounts fa ON gm.float_account_id = fa.id
      WHERE gm.is_active = true
    `;

    // Add branch filter
    if (targetBranchId) {
      query = sql`${query} AND gm.branch_id = ${targetBranchId}`;
    }

    // Add search filter
    if (search) {
      query = sql`${query} AND (
        gm.transaction_type ILIKE ${`%${search}%`} OR
        gm.mapping_type ILIKE ${`%${search}%`} OR
        ga.code ILIKE ${`%${search}%`} OR
        ga.name ILIKE ${`%${search}%`} OR
        b.name ILIKE ${`%${search}%`} OR
        fa.account_type ILIKE ${`%${search}%`} OR
        fa.provider ILIKE ${`%${search}%`}
      )`;
    }

    // Add type filter
    if (type && type !== "all") {
      query = sql`${query} AND gm.transaction_type ILIKE ${`%${type}%`}`;
    }

    // Add status filter
    if (status && status !== "all") {
      if (status === "active") {
        query = sql`${query} AND gm.is_active = true`;
      } else if (status === "inactive") {
        query = sql`${query} AND gm.is_active = false`;
      }
    }

    // Add ordering
    query = sql`${query} ORDER BY b.name, gm.transaction_type, gm.mapping_type`;

    const mappings = await query;

    // Transform the data to match the expected format
    const transformedMappings = mappings.map((mapping) => ({
      id: mapping.id,
      transaction_type: mapping.transaction_type,
      mapping_type: mapping.mapping_type,
      gl_account_id: mapping.gl_account_id,
      float_account_id: mapping.float_account_id,
      branch_id: mapping.branch_id,
      is_active: mapping.is_active,
      created_at: mapping.created_at,
      updated_at: mapping.updated_at,
      gl_account: mapping.gl_account_code
        ? {
            code: mapping.gl_account_code,
            name: mapping.gl_account_name,
            type: mapping.gl_account_type,
            balance: Number(mapping.gl_account_balance || 0),
          }
        : null,
      float_account: mapping.float_account_type
        ? {
            account_type: mapping.float_account_type,
            provider: mapping.float_account_provider,
            account_number: mapping.float_account_number,
            current_balance: Number(mapping.float_account_balance || 0),
          }
        : null,
      branch_name: mapping.branch_name,
    }));

    return NextResponse.json({
      success: true,
      mappings: transformedMappings,
      total: transformedMappings.length,
    });
  } catch (error) {
    console.error("Error fetching GL mappings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch GL mappings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
