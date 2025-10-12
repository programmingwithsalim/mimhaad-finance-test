import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth-service"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// GET - List all active sessions (admin only)
export async function GET() {
  try {
    const session = await getSession()

    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await sql`
      SELECT 
        s.id,
        s.user_id as "userId",
        s.session_token as "sessionToken",
        s.expires_at as "expiresAt",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        s.ip_address as "ipAddress",
        s.user_agent as "userAgent",
        s.is_active as "isActive",
        u.email as "userEmail",
        u.first_name as "userFirstName",
        u.last_name as "userLastName",
        u.role as "userRole"
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > NOW() AND s.is_active = true
      ORDER BY s.updated_at DESC
    `

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error("Error fetching sessions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
