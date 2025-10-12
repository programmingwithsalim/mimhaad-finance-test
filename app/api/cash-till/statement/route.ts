import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 })
    }

    // Mock data for development
    const mockTransactions = [
      {
        id: "ct-001",
        date: new Date().toISOString(),
        description: "MoMo Cash-In Transaction",
        transaction_type: "credit",
        service_type: "momo",
        amount: 100,
        balance_before: 5000,
        balance_after: 5100,
        reference: "MOMO12345",
        processed_by: "Admin User",
        customer_name: "John Doe",
      },
      {
        id: "ct-002",
        date: new Date(Date.now() - 3600000).toISOString(),
        description: "Agency Banking Withdrawal",
        transaction_type: "debit",
        service_type: "agency-banking",
        amount: 200,
        balance_before: 5100,
        balance_after: 4900,
        reference: "AB67890",
        processed_by: "Admin User",
        customer_name: "Jane Smith",
      },
    ]

    return NextResponse.json({
      success: true,
      transactions: mockTransactions,
      currentBalance: 4900,
    })
  } catch (error) {
    console.error("Error fetching cash till statement:", error)
    return NextResponse.json({ error: "Failed to fetch cash till statement" }, { status: 500 })
  }
}
