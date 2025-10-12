import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Get recent audit logs as activity
    const recentActivity = await sql`
      SELECT 
        id,
        action_type as type,
        description,
        username as user,
        created_at as timestamp,
        status
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `.catch(() => [])

    // Transform the data
    const activities = recentActivity.map((activity: any) => ({
      id: activity.id,
      type: activity.type || "system",
      description: activity.description || "System activity",
      user: activity.user || "System",
      timestamp: activity.timestamp || new Date().toISOString(),
      status: activity.status || "success",
    }))

    return NextResponse.json({
      success: true,
      data: activities,
    })
  } catch (error) {
    console.error("Error fetching recent activity:", error)

    // Return empty activity list on error
    return NextResponse.json({
      success: true,
      data: [],
    })
  }
}
