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

    console.log("Fetching E-Zwich partner accounts for branch:", branchId)

    // Get E-Zwich partner accounts
    const accounts = await sql`
      SELECT 
        id,
        provider,
        account_number,
        current_balance,
        min_threshold,
        max_threshold,
        account_type,
        is_active,
        isezwichpartner,
        created_at,
        updated_at
      FROM float_accounts 
      WHERE branch_id = ${branchId}
      AND is_active = true
      AND (
        isezwichpartner = true 
        OR account_type = 'e-zwich'
        OR LOWER(provider) LIKE '%e-zwich%'
        OR LOWER(provider) LIKE '%ezwich%'
      )
      ORDER BY provider
    `

    console.log(`Found ${accounts.length} E-Zwich partner accounts`)

    return NextResponse.json({
      success: true,
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        account_number: account.account_number,
        current_balance: Number.parseFloat(account.current_balance || 0),
        min_threshold: Number.parseFloat(account.min_threshold || 0),
        max_threshold: Number.parseFloat(account.max_threshold || 0),
        account_type: account.account_type,
        is_active: account.is_active,
        isezwichpartner: account.isezwichpartner,
        created_at: account.created_at,
        updated_at: account.updated_at,
      })),
    })
  } catch (error) {
    console.error("Error fetching E-Zwich partner accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch E-Zwich partner accounts",
        accounts: [],
      },
      { status: 500 },
    )
  }
}
