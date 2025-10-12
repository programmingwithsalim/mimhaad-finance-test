import { type NextRequest, NextResponse } from "next/server"
import { GLDatabase } from "@/lib/gl-database"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status") as "pending" | "posted" | "reversed" | undefined
    const sourceModule = searchParams.get("sourceModule") || undefined
    const sourceTransactionType = searchParams.get("sourceTransactionType") || undefined
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const createdBy = searchParams.get("createdBy") || undefined

    // Get transactions with filters
    const transactions = await GLDatabase.getGLTransactions({
      status,
      sourceModule,
      sourceTransactionType,
      startDate,
      endDate,
      createdBy,
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error("Error in GET /api/gl/transactions:", error)
    return NextResponse.json({ error: "Failed to fetch GL transactions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      date,
      sourceModule,
      sourceTransactionId,
      sourceTransactionType,
      description,
      entries,
      createdBy,
      metadata,
    } = body

    // Validate required fields
    if (
      !date ||
      !sourceModule ||
      !sourceTransactionId ||
      !sourceTransactionType ||
      !description ||
      !entries ||
      !createdBy
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate entries
    if (!Array.isArray(entries) || entries.length < 2) {
      return NextResponse.json({ error: "At least two transaction entries are required" }, { status: 400 })
    }

    // Create the GL transaction
    const transaction = await GLDatabase.createGLTransaction({
      date,
      sourceModule,
      sourceTransactionId,
      sourceTransactionType,
      description,
      entries,
      createdBy,
      metadata,
    })

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error("Error in POST /api/gl/transactions:", error)
    return NextResponse.json({ error: "Failed to create GL transaction" }, { status: 500 })
  }
}
