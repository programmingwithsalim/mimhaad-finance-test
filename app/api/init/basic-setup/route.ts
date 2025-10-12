import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST(request: Request) {
  try {
    const { branchId } = await request.json()

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 })
    }

    // Get database connection
    const sql = neon(process.env.DATABASE_URL!)

    const results = {
      branch: null,
      cashTillAccount: null,
      errors: [],
    }

    try {
      // 1. Ensure branch exists
      const existingBranch = await sql`
        SELECT * FROM branches WHERE id = ${branchId} LIMIT 1
      `

      if (!existingBranch || existingBranch.length === 0) {
        const branchResult = await sql`
          INSERT INTO branches (
            id, name, code, address, phone, email, manager_name, is_active, created_at, updated_at
          )
          VALUES (
            ${branchId},
            'Main Branch',
            ${branchId.slice(-6).toUpperCase()},
            'Main Branch Address',
            '0000000000',
            'main@branch.com',
            'Branch Manager',
            true,
            NOW(),
            NOW()
          )
          RETURNING *
        `
        results.branch = branchResult[0]
      } else {
        results.branch = existingBranch[0]
      }

      // 2. Ensure cash-in-till account exists
      const existingCashTill = await sql`
        SELECT * FROM float_accounts 
        WHERE branch_id = ${branchId} AND account_type = 'cash-in-till' 
        LIMIT 1
      `

      if (!existingCashTill || existingCashTill.length === 0) {
        const cashTillResult = await sql`
          INSERT INTO float_accounts (
            branch_id, account_type, provider, account_number, 
            current_balance, min_threshold, max_threshold, is_active, created_at, updated_at
          )
          VALUES (
            ${branchId}, 'cash-in-till', 'Internal Cash', ${`CASH-${branchId.slice(-8)}`},
            10000, 1000, 50000, true, NOW(), NOW()
          )
          RETURNING *
        `
        results.cashTillAccount = cashTillResult[0]
      } else {
        results.cashTillAccount = existingCashTill[0]
      }
    } catch (error) {
      console.error("Error in basic setup:", error)
      results.errors.push(error instanceof Error ? error.message : "Unknown error")
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      results,
      message: results.errors.length === 0 ? "Basic setup completed successfully" : "Setup completed with some errors",
    })
  } catch (error) {
    console.error("Error in basic setup:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete basic setup" },
      { status: 500 },
    )
  }
}
