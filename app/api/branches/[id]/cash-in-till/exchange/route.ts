"use server"

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logger, LogCategory } from "@/lib/logger"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: branchId } = await params
    const { amount, floatAccountId, description, userId } = await request.json()

    await logger.info(LogCategory.TRANSACTION, "Cash till exchange request", {
      branchId,
      amount,
      floatAccountId,
      description,
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

    if (!floatAccountId) {
      await logger.error(LogCategory.API, "Float account ID is required", undefined, { floatAccountId })
      return NextResponse.json({ success: false, error: "Float account ID is required" }, { status: 400 })
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

    // Get float account
    const floatAccount = await sql`
      SELECT * FROM float_accounts 
      WHERE id = ${floatAccountId}
      AND is_active = true
      LIMIT 1
    `

    if (floatAccount.length === 0) {
      await logger.error(LogCategory.API, "Float account not found", undefined, { floatAccountId })
      return NextResponse.json({ success: false, error: "Float account not found" }, { status: 404 })
    }

    const currentFloatBalance = Number(floatAccount[0].current_balance) || 0
    
    if (numericAmount > currentFloatBalance) {
      await logger.error(LogCategory.API, "Insufficient float balance for exchange", undefined, {
        requestedAmount: numericAmount,
        currentFloatBalance,
        floatAccountId,
      })
      return NextResponse.json({ 
        success: false, 
        error: `Insufficient float balance. Available: GHS ${currentFloatBalance.toLocaleString()}` 
      }, { status: 400 })
    }

    const currentCashBalance = Number(cashTill[0].current_balance) || 0
    const newFloatBalance = currentFloatBalance - numericAmount
    const newCashBalance = currentCashBalance + numericAmount

    await logger.info(LogCategory.TRANSACTION, "Processing cash till exchange", {
      cashAccountId: cashTill[0].id,
      floatAccountId: floatAccount[0].id,
      currentFloatBalance,
      currentCashBalance,
      exchangeAmount: numericAmount,
      newFloatBalance,
      newCashBalance,
      description,
    })

    // Update cash in till balance
    const [updatedCashTill] = await sql`
      UPDATE float_accounts 
      SET 
        current_balance = ${newCashBalance},
        updated_at = NOW()
      WHERE id = ${cashTill[0].id}
      RETURNING *
    `

    // Update float account balance
    const [updatedFloatAccount] = await sql`
      UPDATE float_accounts 
      SET 
        current_balance = ${newFloatBalance},
        updated_at = NOW()
      WHERE id = ${floatAccount[0].id}
      RETURNING *
    `

    // Log the exchange transaction for cash till
    const cashTransactionDescription = `Exchange from ${floatAccount[0].account_name}: ${description || "Float to cash exchange"}`
    
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
        'exchange_in',
        ${numericAmount},
        ${currentCashBalance},
        ${newCashBalance},
        ${cashTransactionDescription},
        ${userId || 'system'},
        NOW()
      )
    `

    // Log the exchange transaction for float account
    const floatTransactionDescription = `Exchange to cash till: ${description || "Float to cash exchange"}`
    
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
        ${floatAccount[0].id},
        'exchange_out',
        ${numericAmount},
        ${currentFloatBalance},
        ${newFloatBalance},
        ${floatTransactionDescription},
        ${userId || 'system'},
        NOW()
      )
    `

    await logger.info(LogCategory.TRANSACTION, "Cash till exchange transactions logged", {
      cashAccountId: cashTill[0].id,
      floatAccountId: floatAccount[0].id,
      exchangeAmount: numericAmount,
      newCashBalance,
      newFloatBalance,
      description,
    })

    // Also log in cash_till table for backward compatibility
    try {
      const today = new Date().toISOString().split("T")[0]
      
      await sql`
        INSERT INTO cash_till (branch_id, date, amount, description)
        VALUES (${branchId}::uuid, ${today}, ${numericAmount}, ${cashTransactionDescription})
        ON CONFLICT (branch_id, date)
        DO UPDATE SET 
          amount = cash_till.amount + ${numericAmount},
          updated_at = NOW()
      `
    } catch (cashTillError) {
      await logger.warn(LogCategory.SYSTEM, "Failed to update cash_till table", cashTillError as Error, {
        branchId,
        amount: numericAmount,
      })
      // Don't fail the entire operation if cash_till table update fails
    }

    await logger.info(LogCategory.TRANSACTION, "Cash till exchange completed successfully", {
      branchId,
      amount: numericAmount,
      newCashBalance,
      newFloatBalance,
      description,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully exchanged GHS ${numericAmount.toLocaleString()} from ${floatAccount[0].account_name} to cash till`,
      cashTill: {
        ...updatedCashTill,
        current_balance: newCashBalance,
      },
      floatAccount: {
        ...updatedFloatAccount,
        current_balance: newFloatBalance,
      },
    })
  } catch (error) {
    await logger.error(LogCategory.API, "Cash till exchange failed", error as Error, {
      branchId,
      amount,
      floatAccountId,
      description,
    })
    return NextResponse.json(
      { success: false, error: "Failed to exchange float for cash" },
      { status: 500 }
    )
  }
} 