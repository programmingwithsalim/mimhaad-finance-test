import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")

    if (!branchId) {
      return NextResponse.json({ success: false, error: "Branch ID is required" }, { status: 400 })
    }

    console.log("🔍 [E-ZWICH] Loading settlement accounts for branch:", branchId)

    // Get E-Zwich settlement accounts (account_type = 'e-zwich')
    const accounts = await sql`
      SELECT 
        id,
        account_type,
        provider,
        account_number,
        current_balance,
        min_threshold,
        max_threshold,
        is_active,
        created_at,
        updated_at
      FROM float_accounts 
      WHERE branch_id = ${branchId} 
        AND account_type = 'e-zwich' 
        AND is_active = true
      ORDER BY created_at DESC
    `

    console.log("✅ [E-ZWICH] Found settlement accounts:", accounts.length)

    return NextResponse.json({
      success: true,
      accounts: accounts.map((account) => ({
        id: account.id,
        account_type: account.account_type,
        provider: account.provider || "E-Zwich Settlement",
        account_number: account.account_number || "Settlement Account",
        current_balance: Number(account.current_balance),
        min_threshold: Number(account.min_threshold),
        max_threshold: Number(account.max_threshold),
        is_active: account.is_active,
        created_at: account.created_at,
        updated_at: account.updated_at,
      })),
    })
  } catch (error) {
    console.error("❌ [E-ZWICH] Error loading settlement accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load E-Zwich settlement accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
