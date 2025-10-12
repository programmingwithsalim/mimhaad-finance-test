import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // First, let's check what columns exist in the float_accounts table
    const tableInfo = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'float_accounts'
      ORDER BY ordinal_position
    `

    console.log("Float accounts table structure:", tableInfo)

    // Fetch float accounts data with the correct column names
    const floatAccounts = await sql`
      SELECT *
      FROM float_accounts
      ORDER BY created_at DESC
    `

    console.log("Sample float account:", floatAccounts[0])

    // Transform the data to match our expected format
    const transformedAccounts = floatAccounts.map((account) => ({
      id: account.id,
      account_name: account.name || account.account_name || account.provider || `${account.account_type} Account`,
      account_type: account.account_type || account.type || "Unknown",
      provider: account.provider || "N/A",
      current_balance: Number(account.current_balance || account.balance || 0),
      available_balance: Number(account.available_balance || account.current_balance || account.balance || 0),
      is_active: account.is_active !== false, // Default to true if not specified
      created_at: account.created_at,
      updated_at: account.updated_at,
      branch_id: account.branch_id,
    }))

    // Calculate summary statistics
    const totalAccounts = transformedAccounts.length
    const activeAccounts = transformedAccounts.filter((account) => account.is_active).length
    const totalBalance = transformedAccounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0)
    const accountTypes = new Set(transformedAccounts.map((account) => account.account_type)).size

    const summary = {
      totalAccounts,
      activeAccounts,
      totalBalance,
      accountTypes,
    }

    return NextResponse.json({
      accounts: transformedAccounts,
      summary,
      tableStructure: tableInfo, // Include for debugging
    })
  } catch (error) {
    console.error("Error fetching account balances:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch account balances",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}
