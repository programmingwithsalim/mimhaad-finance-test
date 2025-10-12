"use server"

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logger, LogCategory } from "@/lib/logger"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: branchId } = await params
    const { amount, reason, userId } = await request.json()

    await logger.info(LogCategory.TRANSACTION, "Cash till withdrawal request", {
      branchId,
      amount,
      reason,
      userId,
    })

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(branchId)) {
      await logger.error(LogCategory.API, "Invalid branch ID format", undefined, { branchId })
      return NextResponse.json({ success: false, error: "Invalid branch ID format" }, { status: 400 })
    }

    if (!amount || isNaN(Number(amount))) {
      await logger.error(LogCategory.API, "Invalid amount provided", undefined, { amount })
      return NextResponse.json({ success: false, error: "Valid amount is required" }, { status: 400 })
    }

    const numericAmount = Number(amount)
    if (numericAmount <= 0) {
      await logger.error(LogCategory.API, "Amount must be greater than 0", undefined, { amount: numericAmount })
      return NextResponse.json({ success: false, error: "Amount must be greater than 0" }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      await logger.error(LogCategory.API, "Reason is required for withdrawal", undefined, { reason })
      return NextResponse.json({ success: false, error: "Reason is required for withdrawal" }, { status: 400 })
    }

    // Get cash in till account
    const cashTill = await sql`
      SELECT * FROM float_accounts 
      WHERE branch_id = ${branchId} 
      AND account_type = 'cash-in-till' 
      AND is_active = true
      LIMIT 1
    `

    if (cashTill.length === 0) {
      await logger.error(LogCategory.API, "Cash in till account not found", undefined, { branchId })
      return NextResponse.json({ success: false, error: "Cash in till account not found" }, { status: 404 })
    }

    const currentBalance = Number(cashTill[0].current_balance) || 0
    
    if (numericAmount > currentBalance) {
      await logger.error(LogCategory.API, "Insufficient balance for withdrawal", undefined, {
        requestedAmount: numericAmount,
        currentBalance,
        branchId,
      })
      return NextResponse.json({ 
        success: false, 
        error: `Insufficient balance. Available: GHS ${currentBalance.toLocaleString()}` 
      }, { status: 400 })
    }

    const newBalance = currentBalance - numericAmount

    await logger.info(LogCategory.TRANSACTION, "Processing cash till withdrawal", {
      accountId: cashTill[0].id,
      currentBalance,
      withdrawalAmount: numericAmount,
      newBalance,
      reason,
    })

    // Update cash in till balance
    const [updatedCashTill] = await sql`
      UPDATE float_accounts 
      SET 
        current_balance = ${newBalance},
        updated_at = NOW()
      WHERE id = ${cashTill[0].id}
      RETURNING *
    `

    // Log the withdrawal transaction
    const transactionDescription = `Withdrawal: ${reason.trim()}`
    
    await sql`
      INSERT INTO float_transactions (
        id,
        float_account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        description,
        processed_by,
        created_at
      ) VALUES (
        gen_random_uuid(),
        ${cashTill[0].id},
        'withdrawal',
        ${numericAmount},
        ${currentBalance},
        ${newBalance},
        ${transactionDescription},
        ${userId || 'system'},
        NOW()
      )
    `

    await logger.info(LogCategory.TRANSACTION, "Cash till withdrawal transaction logged", {
      accountId: cashTill[0].id,
      transactionType: 'withdrawal',
      amount: numericAmount,
      newBalance,
      reason,
    })

    // Also log in cash_till table for backward compatibility
    try {
      const today = new Date().toISOString().split("T")[0]
      
      await sql`
        INSERT INTO cash_till (branch_id, date, amount, description)
        VALUES (${branchId}::uuid, ${today}, -${numericAmount}, ${transactionDescription})
        ON CONFLICT (branch_id, date)
        DO UPDATE SET 
          amount = cash_till.amount - ${numericAmount},
          updated_at = NOW()
      `
    } catch (cashTillError) {
      await logger.warn(LogCategory.SYSTEM, "Failed to update cash_till table", cashTillError as Error, {
        branchId,
        amount: -numericAmount,
      })
      // Don't fail the entire operation if cash_till table update fails
    }

    await logger.info(LogCategory.TRANSACTION, "Cash till withdrawal completed successfully", {
      branchId,
      amount: numericAmount,
      newBalance,
      reason,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully withdrew GHS ${numericAmount.toLocaleString()} from cash till`,
      cashTill: {
        ...updatedCashTill,
        current_balance: newBalance,
      },
    })
  } catch (error) {
    await logger.error(LogCategory.API, "Cash till withdrawal failed", error as Error, {
      branchId,
      amount,
      reason,
    })
    return NextResponse.json(
      { success: false, error: "Failed to withdraw from cash till" },
      { status: 500 }
    )
  }
} 