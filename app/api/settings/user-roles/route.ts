import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
  try {
    const { userId, roleId, assignedBy } = await request.json()

    if (!userId || !roleId) {
      return NextResponse.json({ success: false, error: "User ID and Role ID are required" }, { status: 400 })
    }

    // First, get the role name
    const roleResult = await sql`
      SELECT name FROM roles WHERE id = ${roleId}
    `

    if (roleResult.length === 0) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 })
    }

    const roleName = roleResult[0].name

    // Update the user's role in the users table
    const result = await sql`
      UPDATE users 
      SET role = ${roleName}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING id, first_name, last_name, email, role
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Log the role assignment in audit trail
    await sql`
      INSERT INTO audit_logs (user_id, username, action_type, entity_type, entity_id, description, severity, status)
      VALUES (
        ${assignedBy || null}, 
        'admin', 
        'UPDATE', 
        'user_role', 
        ${userId}, 
        ${`Assigned role "${roleName}" to user ${result[0].first_name} ${result[0].last_name}`},
        'medium', 
        'success'
      )
    `

    return NextResponse.json({
      success: true,
      data: result[0],
      message: `Role "${roleName}" assigned successfully`,
    })
  } catch (error) {
    console.error("Error assigning role:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to assign role",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    // Get users with their current roles
    const users = await sql`
      SELECT 
        u.id,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.role,
        u.status,
        b.name as "primaryBranchName",
        r.id as "roleId",
        r.name as "roleName",
        r.description as "roleDescription"
      FROM users u
      LEFT JOIN branches b ON u.primary_branch_id = b.id
      LEFT JOIN roles r ON u.role = r.name
      WHERE u.status = 'active'
      ORDER BY u.first_name, u.last_name
    `

    return NextResponse.json({
      success: true,
      data: users,
    })
  } catch (error) {
    console.error("Error fetching user roles:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user roles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
