import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logger, LogCategory } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")
    const serviceType = searchParams.get("serviceType")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 })
    }

    await logger.info(LogCategory.API, "Real-time transactions request", {
      branchId,
      serviceType,
      status,
      limit,
    })

    let transactions: any[] = []

    // Fetch transactions based on service type
    if (!serviceType || serviceType === 'momo') {
      const momoQuery = status 
        ? sql`SELECT id, type, 'momo' as service_type, amount, fee, status, customer_name, phone_number, reference, date as created_at, date as updated_at, branch_id, processed_by, provider FROM momo_transactions WHERE branch_id = ${branchId} AND status = ${status} ORDER BY date DESC LIMIT ${limit}`
        : sql`SELECT id, type, 'momo' as service_type, amount, fee, status, customer_name, phone_number, reference, date as created_at, date as updated_at, branch_id, processed_by, provider FROM momo_transactions WHERE branch_id = ${branchId} ORDER BY date DESC LIMIT ${limit}`
      
      const momoTransactions = await momoQuery
      transactions.push(...momoTransactions)
    }

    if (!serviceType || serviceType === 'agency_banking') {
      const agencyQuery = status 
        ? sql`SELECT id, type, 'agency_banking' as service_type, amount, fee, status, customer_name, account_number as phone_number, reference, date as created_at, date as updated_at, branch_id, user_id as processed_by, partner_bank as provider FROM agency_banking_transactions WHERE branch_id = ${branchId} AND status = ${status} ORDER BY date DESC LIMIT ${limit}`
        : sql`SELECT id, type, 'agency_banking' as service_type, amount, fee, status, customer_name, account_number as phone_number, reference, date as created_at, date as updated_at, branch_id, user_id as processed_by, partner_bank as provider FROM agency_banking_transactions WHERE branch_id = ${branchId} ORDER BY date DESC LIMIT ${limit}`
      
      const agencyTransactions = await agencyQuery
      transactions.push(...agencyTransactions)
    }

    if (!serviceType || serviceType === 'e_zwich') {
      const ezwichQuery = status 
        ? sql`SELECT id, 'withdrawal' as type, 'e_zwich' as service_type, amount, fee, status, customer_name, card_number as phone_number, reference, transaction_date as created_at, transaction_date as updated_at, branch_id, processed_by, partner_bank as provider FROM e_zwich_withdrawals WHERE branch_id = ${branchId} AND status = ${status} ORDER BY transaction_date DESC LIMIT ${limit}`
        : sql`SELECT id, 'withdrawal' as type, 'e_zwich' as service_type, amount, fee, status, customer_name, card_number as phone_number, reference, transaction_date as created_at, transaction_date as updated_at, branch_id, processed_by, partner_bank as provider FROM e_zwich_withdrawals WHERE branch_id = ${branchId} ORDER BY transaction_date DESC LIMIT ${limit}`
      
      const ezwichTransactions = await ezwichQuery
      transactions.push(...ezwichTransactions)
    }

    if (!serviceType || serviceType === 'power') {
      const powerQuery = status 
        ? sql`SELECT id, type, 'power' as service_type, amount, fee, status, customer_name, meter_number as phone_number, reference, date as created_at, date as updated_at, branch_id, processed_by, provider FROM power_transactions WHERE branch_id = ${branchId} AND status = ${status} ORDER BY date DESC LIMIT ${limit}`
        : sql`SELECT id, type, 'power' as service_type, amount, fee, status, customer_name, meter_number as phone_number, reference, date as created_at, date as updated_at, branch_id, processed_by, provider FROM power_transactions WHERE branch_id = ${branchId} ORDER BY date DESC LIMIT ${limit}`
      
      const powerTransactions = await powerQuery
      transactions.push(...powerTransactions)
    }

    // Sort all transactions by created_at descending
    transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Limit the total results
    transactions = transactions.slice(0, limit)

    await logger.info(LogCategory.API, "Real-time transactions fetched successfully", {
      branchId,
      count: transactions.length,
    })

    return NextResponse.json({
      success: true,
      transactions,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    await logger.error(LogCategory.API, "Real-time transactions fetch failed", error as Error)
    console.error("Real-time transactions error:", error)
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    )
  }
} 