import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// In-memory storage as fallback
const transactions: any[] = []

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")
    const serviceModule = searchParams.get("serviceModule")

    console.log("Fetching cash transactions with params:", { branchId, serviceModule })

    let filteredTransactions: any[] = []

    // Try database first
    try {
      const query = sql`SELECT * FROM cash_transactions ORDER BY timestamp DESC`

      const dbTransactions = await query
      filteredTransactions = dbTransactions.map((t) => ({
        id: t.id,
        branchId: t.branch_id,
        serviceModule: t.service_module,
        amount: Number(t.amount),
        type: t.type,
        description: t.description,
        timestamp: t.timestamp,
        performedBy: t.performed_by,
        previousBalance: Number(t.previous_balance),
        newBalance: Number(t.new_balance),
      }))

      // Apply filters
      if (branchId) {
        filteredTransactions = filteredTransactions.filter((tx) => tx.branchId === branchId)
      }
      if (serviceModule) {
        filteredTransactions = filteredTransactions.filter((tx) => tx.serviceModule === serviceModule)
      }
    } catch (dbError) {
      console.log("Database not available, using in-memory data")
      filteredTransactions = transactions

      // Apply filters to in-memory data
      if (branchId) {
        filteredTransactions = filteredTransactions.filter((tx) => tx.branchId === branchId)
      }
      if (serviceModule) {
        filteredTransactions = filteredTransactions.filter((tx) => tx.serviceModule === serviceModule)
      }
    }

    return NextResponse.json({ transactions: filteredTransactions })
  } catch (error) {
    console.error("Error in GET /api/cash-transactions:", error)
    return NextResponse.json({ error: "Failed to fetch cash transactions", transactions: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (!data.branchId || !data.serviceModule || data.amount === undefined) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 })
    }

    // Create transaction record
    const transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      branchId: data.branchId,
      serviceModule: data.serviceModule,
      amount: data.amount,
      type: data.transactionType || "manual",
      description: data.notes || "Cash transaction",
      timestamp: new Date().toISOString(),
      performedBy: data.performedBy || "system",
      previousBalance: 0, // Would get from cash till
      newBalance: data.amount, // Simplified
    }

    // Try to save to database
    try {
      await sql`
        INSERT INTO cash_transactions (
          id, branch_id, service_module, amount, type, description, 
          timestamp, performed_by, previous_balance, new_balance
        ) VALUES (
          ${transaction.id}, ${transaction.branchId}, ${transaction.serviceModule},
          ${transaction.amount}, ${transaction.type}, ${transaction.description},
          ${transaction.timestamp}, ${transaction.performedBy}, 
          ${transaction.previousBalance}, ${transaction.newBalance}
        )
      `
    } catch (dbError) {
      console.log("Database not available, using in-memory storage")
      transactions.unshift(transaction)
    }

    return NextResponse.json({
      success: true,
      message: "Cash transaction processed successfully",
      transaction,
      newBalance: transaction.newBalance,
    })
  } catch (error) {
    console.error("Error in POST /api/cash-transactions:", error)
    return NextResponse.json(
      { success: false, message: "Failed to process cash transaction", error: String(error) },
      { status: 500 },
    )
  }
}
