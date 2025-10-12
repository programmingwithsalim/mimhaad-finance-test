import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string  }> }) {
  try {
    const { accountId } = params
    const body = await request.json()
    const { amount, reference, branchId, userId, processedBy } = body

    if (!amount || !branchId || !userId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Verify partner account exists and is active
    const partnerAccount = await sql`
      SELECT * FROM e_zwich_partner_accounts 
      WHERE id = ${accountId} AND branch_id = ${branchId} AND is_active = true
    `

    if (partnerAccount.length === 0) {
      return NextResponse.json({ success: false, error: "Partner account not found or inactive" }, { status: 404 })
    }

    // Get pending withdrawals for this branch
    const pendingWithdrawals = await sql`
      SELECT * FROM e_zwich_transactions 
      WHERE branch_id = ${branchId} 
      AND type = 'withdrawal' 
      AND status = 'completed'
      AND settlement_status IS NULL OR settlement_status = 'pending'
      ORDER BY created_at ASC
    `

    if (pendingWithdrawals.length === 0) {
      return NextResponse.json(
        { success: false, error: "No pending withdrawals found for settlement" },
        { status: 400 },
      )
    }

    // Start transaction
    const settlementId = `SETT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create settlement record
    const settlement = await sql`
      INSERT INTO e_zwich_settlements (
        id,
        partner_account_id,
        branch_id,
        amount,
        reference,
        processed_by,
        user_id,
        status,
        settlement_date
      ) VALUES (
        ${settlementId},
        ${accountId},
        ${branchId},
        ${amount},
        ${reference || `Settlement ${new Date().toISOString().split("T")[0]}`},
        ${processedBy},
        ${userId},
        'completed',
        NOW()
      )
      RETURNING *
    `

    // Update withdrawal transactions to mark as settled
    const withdrawalIds = pendingWithdrawals.map((w) => w.id)

    if (withdrawalIds.length > 0) {
      await sql`
        UPDATE e_zwich_transactions 
        SET 
          settlement_status = 'settled',
          settlement_id = ${settlementId},
          settlement_date = NOW()
        WHERE id = ANY(${withdrawalIds})
      `
    }

    // Get updated settlement with partner account details
    const settlementWithDetails = await sql`
      SELECT 
        s.*,
        pa.bank_name,
        pa.account_number,
        pa.account_name
      FROM e_zwich_settlements s
      JOIN e_zwich_partner_accounts pa ON s.partner_account_id = pa.id
      WHERE s.id = ${settlementId}
    `

    return NextResponse.json({
      success: true,
      settlement: settlementWithDetails[0],
      withdrawalsSettled: withdrawalIds.length,
      message: "Settlement processed successfully",
    })
  } catch (error) {
    console.error("Error processing E-Zwich settlement:", error)
    return NextResponse.json({ success: false, error: "Failed to process settlement" }, { status: 500 })
  }
}
