import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    // Get current user for authentication
    let user;
    try {
      user = await getCurrentUser(request);
      if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch (authError) {
      console.warn("Authentication failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get("groupBy");
    const floatAccountId = searchParams.get("floatAccountId");
    const transactionType = searchParams.get("transactionType");
    const mappingType = searchParams.get("mappingType");

    console.log("[GL MAPPINGS] Fetching mappings:", {
      groupBy,
      floatAccountId,
      transactionType,
      mappingType,
      userRole: user.role,
    });

    let query;
    let params = [];

    if (groupBy === "transaction_type") {
      // Group by transaction type
      query = sql`
        SELECT 
          gm.transaction_type,
          COUNT(*) as mapping_count,
          ARRAY_AGG(DISTINCT gm.mapping_type) as mapping_types,
          ARRAY_AGG(DISTINCT gm.float_account_id) FILTER (WHERE gm.float_account_id IS NOT NULL) as float_account_ids
        FROM gl_mappings gm
        WHERE gm.is_active = true
        GROUP BY gm.transaction_type
        ORDER BY gm.transaction_type
      `;
    } else if (groupBy === "float_account_id") {
      // Group by float account ID
      query = sql`
        SELECT 
          gm.float_account_id,
          COUNT(*) as mapping_count,
          ARRAY_AGG(DISTINCT gm.mapping_type) as mapping_types,
          ARRAY_AGG(DISTINCT gm.transaction_type) as transaction_types
        FROM gl_mappings gm
        WHERE gm.is_active = true
          AND gm.float_account_id IS NOT NULL
        GROUP BY gm.float_account_id
        ORDER BY gm.float_account_id
      `;
    } else {
      // Get all mappings with details
      let whereConditions = sql`WHERE gm.is_active = true`;

      if (floatAccountId) {
        whereConditions = sql`${whereConditions} AND gm.float_account_id = ${floatAccountId}`;
      }

      if (transactionType) {
        whereConditions = sql`${whereConditions} AND gm.transaction_type = ${transactionType}`;
      }

      if (mappingType) {
        whereConditions = sql`${whereConditions} AND gm.mapping_type = ${mappingType}`;
      }

      query = sql`
        SELECT 
          gm.id,
          gm.transaction_type,
          gm.gl_account_id,
          gm.float_account_id,
          gm.mapping_type,
          gm.branch_id,
          gm.is_active,
          gm.created_at,
          gm.updated_at,
          ga.code as account_code,
          ga.name as account_name,
          ga.type as account_type,
          fa.account_type as float_account_type,
          fa.provider as float_provider,
          b.name as branch_name
        FROM gl_mappings gm
        LEFT JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        LEFT JOIN float_accounts fa ON gm.float_account_id = fa.id
        LEFT JOIN branches b ON gm.branch_id = b.id
        ${whereConditions}
        ORDER BY gm.created_at DESC
      `;
    }

    const mappings = await query;

    console.log(`[GL MAPPINGS] Found ${mappings.length} mappings`);

    return NextResponse.json({
      success: true,
      data: mappings,
      count: mappings.length,
    });
  } catch (error) {
    console.error("Error fetching GL mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch GL mappings" },
      { status: 500 }
    );
  }
}
