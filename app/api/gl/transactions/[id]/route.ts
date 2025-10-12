import { type NextRequest, NextResponse } from "next/server"
import { GLDatabase } from "@/lib/gl-database"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const transaction = await GLDatabase.getGLTransactionById((await params).id)

    if (!transaction) {
      return NextResponse.json({ error: `Transaction with ID ${(await params).id} not found` }, { status: 404 })
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error(`Error in GET /api/gl/transactions/${(await params).id}:`, error)
    return NextResponse.json({ error: "Failed to fetch GL transaction" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Post the transaction
    const transaction = await GLDatabase.postGLTransaction((await params).id, userId)

    if (!transaction) {
      return NextResponse.json(
        { error: `Transaction with ID ${(await params).id} not found or could not be posted` },
        { status: 404 },
      )
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error(`Error in POST /api/gl/transactions/${(await params).id}:`, error)
    return NextResponse.json({ error: "Failed to post GL transaction" }, { status: 500 })
  }
}
