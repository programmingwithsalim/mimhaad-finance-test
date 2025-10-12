import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Check if users table exists and has data
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role = 'admin'
    `

    const hasAdminUser = Number.parseInt(result[0].count) > 0

    return NextResponse.json({
      hasUsers: hasAdminUser,
      needsSetup: !hasAdminUser,
    })
  } catch (error) {
    // If table doesn't exist or other error, assume setup is needed
    return NextResponse.json({
      hasUsers: false,
      needsSetup: true,
    })
  }
}
