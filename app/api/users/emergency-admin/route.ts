import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 })
    }

    // Update the user's role to admin
    const result = await sql`
      UPDATE users 
      SET role = 'admin', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING id, first_name, last_name, email, role
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Log the emergency admin action
    await sql`
      INSERT INTO audit_logs (user_id, username, action_type, entity_type, entity_id, description, severity, status)
      VALUES (
        ${userId}, 
        'system', 
        'EMERGENCY', 
        'user_role', 
        ${userId}, 
        ${`Emergency admin access granted to ${result[0].first_name} ${result[0].last_name}`},
        'high', 
        'success'
      )
    `

    return NextResponse.json({
      success: true,
      data: result[0],
      message: "Emergency admin access granted successfully",
    })
  } catch (error) {
    console.error("Error granting emergency admin access:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to grant emergency admin access",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
