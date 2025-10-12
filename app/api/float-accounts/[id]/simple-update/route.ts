import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: accountId } = await params
    const { amount, description } = await request.json()

    // Get database connection
    const sql = neon(process.env.DATABASE_URL!)

    // First, get the current account to verify it exists
    const accounts = await sql`
      SELECT * FROM float_accounts
      WHERE id = ${accountId}
      AND is_active = true
    `

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "Float account not found" }, { status: 404 })
    }

    // Update the account balance
    const updatedAccounts = await sql`
      UPDATE float_accounts
      SET 
        current_balance = current_balance + ${amount},
        updated_at = NOW()
      WHERE id = ${accountId}
      RETURNING *
    `

    if (!updatedAccounts || updatedAccounts.length === 0) {
      return NextResponse.json({ error: "Failed to update account balance" }, { status: 500 })
    }

    const updatedAccount = updatedAccounts[0]

    // Convert numeric values and return
    return NextResponse.json({
      ...updatedAccount,
      current_balance: Number(updatedAccount.current_balance),
      min_threshold: Number(updatedAccount.min_threshold),
      max_threshold: Number(updatedAccount.max_threshold),
    })
  } catch (error) {
    console.error("Error updating float account balance:", error)
    return NextResponse.json({ error: "Failed to update account balance" }, { status: 500 })
  }
}
