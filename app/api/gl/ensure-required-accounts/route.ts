import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST() {
  try {
    // Check if GL accounts table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gl_accounts'
      )
    `

    if (!tableExists[0].exists) {
      return NextResponse.json({
        success: false,
        error: "GL accounts table does not exist. Please initialize the GL system first.",
      })
    }

    // Required accounts for MoMo transactions
    const requiredAccounts = [
      { code: "1001", name: "Cash in Bank - Operations", type: "Asset" },
      { code: "2001", name: "Accounts Payable - Customer Liability", type: "Liability" },
      { code: "4003", name: "Transaction Fee Income", type: "Revenue" },
    ]

    const results = []

    for (const account of requiredAccounts) {
      // Check if account exists
      const existing = await sql`
        SELECT id, code, name FROM gl_accounts 
        WHERE code = ${account.code}
      `

      if (existing.length === 0) {
        // Create the account
        const newAccount = await sql`
          INSERT INTO gl_accounts (code, name, type, balance, is_active)
          VALUES (${account.code}, ${account.name}, ${account.type}, 0, true)
          RETURNING id, code, name, type
        `
        results.push({ action: "created", account: newAccount[0] })
      } else {
        results.push({ action: "exists", account: existing[0] })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Required GL accounts ensured",
      results,
    })
  } catch (error) {
    console.error("Error ensuring GL accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to ensure GL accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    // Check status of required accounts
    const requiredCodes = ["1001", "2001", "4003"]

    const accounts = await sql`
      SELECT id, code, name, type, balance, is_active
      FROM gl_accounts 
      WHERE code = ANY(${requiredCodes})
      ORDER BY code
    `

    const missing = requiredCodes.filter((code) => !accounts.find((acc) => acc.code === code))

    return NextResponse.json({
      success: true,
      accounts,
      missing,
      allPresent: missing.length === 0,
    })
  } catch (error) {
    console.error("Error checking GL accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check GL accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
