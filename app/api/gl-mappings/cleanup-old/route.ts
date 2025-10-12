import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = getCurrentUser(request);

    // Only allow admin users to perform cleanup
    if (user.role !== "Admin" && user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    console.log("🔍 Analyzing GL mappings for provider naming...");

    // Find GL accounts that use the old "DEVMTN" naming convention
    const oldAccounts = await sql`
      SELECT id, code, name 
      FROM gl_accounts 
      WHERE code LIKE '%DEVMTN%'
      ORDER BY code
    `;

    console.log(
      `📋 Found ${oldAccounts.length} GL accounts with old "DEVMTN" naming`
    );

    // Find GL mappings that reference these old accounts
    const oldMappings = await sql`
      SELECT gm.id, gm.transaction_type, gm.mapping_type, gm.branch_id, ga.code as account_code
      FROM gl_mappings gm
      JOIN gl_accounts ga ON gm.gl_account_id = ga.id
      WHERE ga.code LIKE '%DEVMTN%'
      ORDER BY gm.transaction_type, gm.mapping_type
    `;

    console.log(
      `📋 Found ${oldMappings.length} GL mappings using old accounts`
    );

    // Find all GL mappings to show the current state
    const allMappings = await sql`
      SELECT gm.transaction_type, gm.mapping_type, gm.branch_id, ga.code as account_code, ga.name as account_name
      FROM gl_mappings gm
      JOIN gl_accounts ga ON gm.gl_account_id = ga.id
      WHERE gm.is_active = true
      ORDER BY gm.transaction_type, gm.mapping_type, ga.code
    `;

    console.log("📊 Analysis completed successfully!");

    return NextResponse.json({
      success: true,
      message:
        "GL mappings analysis completed. The system will automatically create provider-specific mappings when needed.",
      analysis: {
        oldAccounts: oldAccounts.length,
        oldMappings: oldMappings.length,
        totalMappings: allMappings.length,
        details: {
          oldAccounts: oldAccounts.map((a) => ({ code: a.code, name: a.name })),
          oldMappings: oldMappings.map((m) => ({
            transactionType: m.transaction_type,
            mappingType: m.mapping_type,
            accountCode: m.account_code,
          })),
          allMappings: allMappings.map((m) => ({
            transactionType: m.transaction_type,
            mappingType: m.mapping_type,
            accountCode: m.account_code,
            accountName: m.account_name,
          })),
        },
      },
      recommendation:
        "Keep existing mappings for backward compatibility. New provider-specific mappings will be created automatically when transactions are processed with different providers.",
    });
  } catch (error) {
    console.error("❌ Error during analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
