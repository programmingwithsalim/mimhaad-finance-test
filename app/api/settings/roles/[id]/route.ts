import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const body = await request.json()
    const { name, description, permissions, userId } = body
    const { id: roleId } = await params

    // Check if role is system role
    const roleCheck = await sql.query(`SELECT is_system FROM roles WHERE id = $1`, [roleId])

    if (roleCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 })
    }

    if (roleCheck.rows[0].is_system) {
      return NextResponse.json({ success: false, error: "Cannot modify system roles" }, { status: 403 })
    }

    const result = await sql.query(
      `UPDATE roles 
       SET name = $1, description = $2, permissions = $3, 
           updated_at = CURRENT_TIMESTAMP, updated_by = $4
       WHERE id = $5
       RETURNING id, name, description, permissions, is_default, is_system, updated_at`,
      [name, description, permissions, userId, roleId],
    )

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: "Role updated successfully",
    })
  } catch (error) {
    console.error("Error updating role:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update role",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: roleId } = await params

    // Check if role is system role or has users assigned
    const roleCheck = await sql.query(
      `SELECT r.is_system, COUNT(ur.user_id) as user_count
       FROM roles r
       LEFT JOIN user_roles ur ON r.id = ur.role_id
       WHERE r.id = $1
       GROUP BY r.id, r.is_system`,
      [roleId],
    )

    if (roleCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 })
    }

    const role = roleCheck.rows[0]

    if (role.is_system) {
      return NextResponse.json({ success: false, error: "Cannot delete system roles" }, { status: 403 })
    }

    if (Number.parseInt(role.user_count) > 0) {
      return NextResponse.json({ success: false, error: "Cannot delete role with assigned users" }, { status: 400 })
    }

    await sql.query(`DELETE FROM roles WHERE id = $1`, [roleId])

    return NextResponse.json({
      success: true,
      message: "Role deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting role:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete role",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
