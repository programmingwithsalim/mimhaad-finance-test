import { type NextRequest, NextResponse } from "next/server"
import { addComment } from "@/lib/commission-database-service"
import { getCurrentUser } from "@/lib/auth-utils"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const body = await request.json()
    const user = getCurrentUser(request) || { id: "system", name: "System" }

    if (!body.text) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 })
    }

    const commission = await addComment((await params).id, user.id, user.name, body.text)

    if (!commission) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 })
    }

    return NextResponse.json(commission)
  } catch (error) {
    console.error("Error adding comment:", error)
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }
}
