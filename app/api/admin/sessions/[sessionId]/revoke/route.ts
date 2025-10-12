import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth-service"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// POST - Revoke a specific session (admin only)
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string  }> }) {
  try {
    const session = await getSession()

    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await sql`
      UPDATE user_sessions 
      SET is_active = false, updated_at = NOW()
      WHERE id = ${params.sessionId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error revoking session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
