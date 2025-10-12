import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function getExistingAccountTypesForBranch(branchId: string) {
  try {
    const accounts = await sql`
      SELECT DISTINCT 
        account_type,
        provider
      FROM float_accounts
      WHERE branch_id = ${branchId}
        AND is_active = true
      ORDER BY account_type, provider
    `;

    return {
      success: true,
      accountTypes: accounts
    };
  } catch (error) {
    console.error("Error fetching existing account types for branch:", error);
    return {
      success: false,
      accountTypes: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
} 