import { NextResponse } from "next/server"
import { getExpenseStatistics } from "@/lib/expense-database-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse filters from query parameters
    const filters = {
      branch_id: searchParams.get("branch_id") || undefined,
      expense_head_id: searchParams.get("expense_head_id") || undefined,
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      payment_source: searchParams.get("payment_source") || undefined,
      start_date: searchParams.get("start_date") || undefined,
      end_date: searchParams.get("end_date") || undefined,
      min_amount: searchParams.get("min_amount") ? Number.parseFloat(searchParams.get("min_amount")!) : undefined,
      max_amount: searchParams.get("max_amount") ? Number.parseFloat(searchParams.get("max_amount")!) : undefined,
      created_by: searchParams.get("created_by") || undefined,
    }

    // Remove undefined values
    const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([_, value]) => value !== undefined))

    console.log("Fetching expense statistics with filters:", cleanFilters)

    const statistics = await getExpenseStatistics(cleanFilters)

    console.log("Expense statistics:", statistics)

    return NextResponse.json({
      success: true,
      statistics,
    })
  } catch (error) {
    console.error("Error in GET /api/expenses-statistics:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch expense statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
