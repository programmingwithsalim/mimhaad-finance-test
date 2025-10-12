import { NextResponse } from "next/server"
import { getAllExpenseHeads, createExpenseHead } from "@/lib/expense-head-service"

export async function GET() {
  try {
    console.log("GET /api/expense-heads - Fetching expense heads...")
    const expenseHeads = await getAllExpenseHeads()

    console.log(`Returning ${expenseHeads.length} expense heads`)
    return NextResponse.json({
      success: true,
      expense_heads: expenseHeads,
      count: expenseHeads.length,
    })
  } catch (error) {
    console.error("Error in GET /api/expense-heads:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch expense heads",
        expense_heads: [],
        count: 0,
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    console.log("POST /api/expense-heads - Creating expense head...")
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.category) {
      return NextResponse.json(
        {
          success: false,
          error: "Name and category are required",
        },
        { status: 400 },
      )
    }

    const expenseHead = await createExpenseHead(data)

    if (!expenseHead) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create expense head",
        },
        { status: 500 },
      )
    }

    console.log("Created expense head:", expenseHead.name)
    return NextResponse.json(
      {
        success: true,
        expense_head: expenseHead,
        message: "Expense head created successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error in POST /api/expense-heads:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create expense head",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
