import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id } = params
    const body = await request.json()
    const {
      bankName,
      accountNumber,
      accountName,
      contactPerson,
      contactPhone,
      contactEmail,
      settlementTime,
      isActive,
      currentBalance,
      minThreshold,
      maxThreshold,
    } = body

    if (!bankName || !accountNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: bankName, accountNumber",
        },
        { status: 400 },
      )
    }

    // Update the float account
    const updatedAccount = await sql`
      UPDATE float_accounts 
      SET 
        provider = ${bankName},
        account_number = ${accountNumber},
        current_balance = ${currentBalance || 0},
        min_threshold = ${minThreshold || 1000},
        max_threshold = ${maxThreshold || 100000},
        is_active = ${isActive !== false},
        updated_at = NOW()
      WHERE id = ${id} 
      AND isEzwichPartner = true
      RETURNING *
    `

    if (updatedAccount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "E-Zwich partner account not found",
        },
        { status: 404 },
      )
    }

    const formattedAccount = {
      id: updatedAccount[0].id,
      branch_id: updatedAccount[0].branch_id,
      bank_name: updatedAccount[0].provider,
      account_number: updatedAccount[0].account_number,
      account_name: accountName || `${bankName} E-Zwich Account`,
      contact_person: contactPerson || "Branch Manager",
      contact_phone: contactPhone || "+233 24 000 0000",
      contact_email: contactEmail,
      settlement_time: settlementTime || "17:00",
      current_balance: Number.parseFloat(updatedAccount[0].current_balance),
      is_active: updatedAccount[0].is_active,
      created_at: updatedAccount[0].created_at,
      updated_at: updatedAccount[0].updated_at,
    }

    return NextResponse.json({
      success: true,
      account: formattedAccount,
      message: "E-Zwich partner account updated successfully",
    })
  } catch (error) {
    console.error("Error updating E-Zwich partner account:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update partner account",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id } = params

    // Check if there are any related transactions
    const transactionCount = await sql`
      SELECT COUNT(*) as count
      FROM e_zwich_withdrawals 
      WHERE ezwich_settlement_account_id = ${id}
    `

    const hasTransactions = Number.parseInt(transactionCount[0].count) > 0

    if (hasTransactions) {
      // Soft delete by marking as inactive
      await sql`
        UPDATE float_accounts 
        SET is_active = false, updated_at = NOW()
        WHERE id = ${id} AND isEzwichPartner = true
      `

      return NextResponse.json({
        success: true,
        message: "E-Zwich partner account deactivated (has related transactions)",
      })
    } else {
      // Hard delete if no transactions
      const result = await sql`
        DELETE FROM float_accounts 
        WHERE id = ${id} AND isEzwichPartner = true
        RETURNING id
      `

      if (result.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "E-Zwich partner account not found",
          },
          { status: 404 },
        )
      }

      return NextResponse.json({
        success: true,
        message: "E-Zwich partner account deleted successfully",
      })
    }
  } catch (error) {
    console.error("Error deleting E-Zwich partner account:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete partner account",
      },
      { status: 500 },
    )
  }
}
