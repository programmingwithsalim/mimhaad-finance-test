import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const users = await sql`
      SELECT 
        u.id,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.role,
        u.status,
        u.avatar,
        b.name as "primaryBranchName"
      FROM users u
      LEFT JOIN branches b ON u.primary_branch_id = b.id
      WHERE u.status = 'active'
      ORDER BY u.first_name, u.last_name
    `

    return NextResponse.json({
      success: true,
      data: users,
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
