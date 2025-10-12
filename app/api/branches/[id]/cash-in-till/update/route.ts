"use server"

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logger, LogCategory } from "@/lib/logger"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: branchId } = await params
    const { amount, description, userId } = await request.json()

    await logger.info(LogCategory.TRANSACTION, "Cash till update request", {
      branchId,
      amount,
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

    // Get or create cash in till account
    let cashTill = await sql`
      SELECT * FROM float_accounts 
      WHERE branch_id = ${branchId} 
      AND account_type = 'cash-in-till' 
      AND is_active = true
      LIMIT 1
    `

    let newBalance = numericAmount
    let isNewAccount = false

    if (cashTill.length === 0) {
      // Create cash in till account
      await logger.info(LogCategory.SYSTEM, "Creating new cash in till account", {
        branchId,
        initialAmount: numericAmount,
      })

      const [newCashTill] = await sql`
        INSERT INTO float_accounts (
          branch_id,
          account_name,
          account_type,
          provider,
          current_balance,
          min_threshold,
          max_threshold,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          ${branchId},
          'Cash in Till',
          'cash-in-till',
          'Cash',
          ${numericAmount},
          1000,
          50000,
          true,
          NOW(),
          NOW()
        )
        RETURNING *
      `

      cashTill = [newCashTill]
      isNewAccount = true

      await logger.info(LogCategory.SYSTEM, "Cash in till account created successfully", {
        accountId: newCashTill.id,
        initialBalance: numericAmount,
      })
    } else {
      // Update existing cash in till
      const currentBalance = Number(cashTill[0].current_balance) || 0
      newBalance = currentBalance + numericAmount

      await logger.info(LogCategory.TRANSACTION, "Updating existing cash in till", {
        accountId: cashTill[0].id,
        currentBalance,
        depositAmount: numericAmount,
        newBalance,
      })

      const [updatedCashTill] = await sql`
        UPDATE float_accounts 
        SET 
          current_balance = ${newBalance},
          updated_at = NOW()
        WHERE id = ${cashTill[0].id}
        RETURNING *
      `

      cashTill = [updatedCashTill]
    }

    // Log the transaction in float_transactions table
    const transactionDescription = description || `Cash deposit of GHS ${numericAmount.toLocaleString()}`
    
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
        'deposit',
        ${numericAmount},
        ${isNewAccount ? 0 : Number(cashTill[0].current_balance) - numericAmount},
        ${newBalance},
        ${transactionDescription},
        ${userId || 'system'},
        NOW()
      )
    `

    await logger.info(LogCategory.TRANSACTION, "Cash till transaction logged", {
      accountId: cashTill[0].id,
      transactionType: 'deposit',
      amount: numericAmount,
      newBalance,
    })

    // Also log in cash_till table for backward compatibility
    try {
      const today = new Date().toISOString().split("T")[0]
      
      await sql`
        INSERT INTO cash_till (branch_id, date, amount, description)
        VALUES (${branchId}::uuid, ${today}, ${numericAmount}, ${transactionDescription})
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

    await logger.info(LogCategory.TRANSACTION, "Cash till update completed successfully", {
      branchId,
      amount: numericAmount,
      newBalance,
      isNewAccount,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully added GHS ${numericAmount.toLocaleString()} to cash till`,
      cashTill: {
        ...cashTill[0],
        current_balance: newBalance,
      },
    })
  } catch (error) {
    await logger.error(LogCategory.API, "Cash till update failed", error as Error, {
      branchId,
      amount,
    })
    return NextResponse.json(
      { success: false, error: "Failed to update cash till" },
      { status: 500 }
    )
  }
}
