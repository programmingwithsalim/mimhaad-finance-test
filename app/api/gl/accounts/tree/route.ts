import { NextResponse } from "next/server"
import { GLDatabase } from "@/lib/gl-database"

export async function GET() {
  try {
    const tree = await GLDatabase.getGLAccountTree()
    return NextResponse.json({ tree })
  } catch (error) {
    console.error("Error in GET /api/gl/accounts/tree:", error)
    return NextResponse.json({ error: "Failed to fetch GL account tree" }, { status: 500 })
  }
}
