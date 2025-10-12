import { type NextRequest, NextResponse } from "next/server"
import { getExpenseHeadById, updateExpenseHead, deleteExpenseHead } from "@/lib/expense-head-service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: id } = await params
    const expenseHead = await getExpenseHeadById(id)

    if (!expenseHead) {
      return NextResponse.json({ error: "Expense head not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      expense_head: expenseHead,
    })
  } catch (error) {
    console.error(`Error in GET /api/expense-heads/${(await params).id}:`, error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch expense head",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: id } = await params
    const data = await request.json()

    console.log(`Updating expense head ${id} with data:`, data)

    // Check if expense head exists
    const existingExpenseHead = await getExpenseHeadById(id)
    if (!existingExpenseHead) {
      return NextResponse.json(
        {
          success: false,
          error: "Expense head not found",
        },
        { status: 404 },
      )
    }

    // Update the expense head
    const updatedExpenseHead = await updateExpenseHead(id, data)

    if (!updatedExpenseHead) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update expense head",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      expense_head: updatedExpenseHead,
      message: "Expense head updated successfully",
    })
  } catch (error) {
    console.error(`Error in PUT /api/expense-heads/${(await params).id}:`, error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to update expense head: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: id } = await params

    console.log(`Deleting expense head ${id}`)

    // Check if expense head exists
    const existingExpenseHead = await getExpenseHeadById(id)
    if (!existingExpenseHead) {
      return NextResponse.json(
        {
          success: false,
          error: "Expense head not found",
        },
        { status: 404 },
      )
    }

    // Delete the expense head
    await deleteExpenseHead(id)

    return NextResponse.json({
      success: true,
      message: "Expense head deleted successfully",
    })
  } catch (error) {
    console.error(`Error in DELETE /api/expense-heads/${(await params).id}:`, error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to delete expense head: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
