import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    console.log("Testing GL mappings for commissions...");

    // Test the specific commission type and branch from the error
    const commissionType = "e_zwich_float";
    const branchId = "635844ab-029a-43f8-8523-d7882915266a";
    const floatAccountId = "3c395f28-623a-48c7-ba29-724a2d9ced9d";

    console.log(
      `Testing mappings for: ${commissionType}, branch: ${branchId}, float: ${floatAccountId}`
    );

    // Test without float account filter first
    const mappingsWithoutFilter = await sql`
      SELECT mapping_type, gl_account_id, float_account_id
      FROM gl_mappings
      WHERE transaction_type = ${commissionType}
        AND branch_id = ${branchId}
        AND is_active = true
    `;

    console.log(
      `Found ${mappingsWithoutFilter.length} mappings without float filter:`,
      mappingsWithoutFilter
    );

    // Test with float account filter
    const mappingsWithFilter = await sql`
      SELECT mapping_type, gl_account_id, float_account_id
      FROM gl_mappings
      WHERE transaction_type = ${commissionType}
        AND branch_id = ${branchId}
        AND float_account_id = ${floatAccountId}
        AND is_active = true
    `;

    console.log(
      `Found ${mappingsWithFilter.length} mappings with float filter:`,
      mappingsWithFilter
    );

    // Check if GL accounts exist
    const glAccountIds = mappingsWithFilter
      .map((m) => m.gl_account_id)
      .filter((id) => id);
    console.log("GL account IDs:", glAccountIds);

    if (glAccountIds.length > 0) {
      const glAccounts = await sql`
        SELECT id, code, name, type
        FROM gl_accounts
        WHERE id = ANY(${glAccountIds})
      `;
      console.log("GL accounts found:", glAccounts);
    }

    return NextResponse.json({
      success: true,
      commissionType,
      branchId,
      floatAccountId,
      mappingsWithoutFilter,
      mappingsWithFilter,
      glAccountIds,
    });
  } catch (error) {
    console.error("Error testing GL mappings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
