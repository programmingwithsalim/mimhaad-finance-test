import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { permissions, updated_by } = await request.json()
    const { id: roleId } = await params

    // First, remove all existing permissions for this role
    await sql`
      DELETE FROM role_permissions 
      WHERE role_id = ${roleId}
    `

    // Then add the new permissions
    if (permissions && Array.isArray(permissions)) {
      for (const permissionId of permissions) {
        await sql`
          INSERT INTO role_permissions (role_id, permission_id, granted, created_by)
          VALUES (${roleId}, ${permissionId}, true, ${updated_by || null})
        `
      }
    }

    // Log the update
    await sql`
      INSERT INTO audit_logs (user_id, username, action_type, entity_type, entity_id, description, severity, status)
      VALUES (${updated_by || null}, 'admin', 'UPDATE', 'role', ${roleId}, 'Updated role permissions', 'medium', 'success')
    `

    return NextResponse.json({
      success: true,
      message: "Role permissions updated successfully",
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: roleId } = await params

    // Check if role is system role
    const role = await sql`
      SELECT is_system FROM roles WHERE id = ${roleId}
    `

    if (role.length === 0) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 })
    }

    if (role[0].is_system) {
      return NextResponse.json({ success: false, error: "Cannot delete system roles" }, { status: 400 })
    }

    // Delete role permissions first
    await sql`
      DELETE FROM role_permissions WHERE role_id = ${roleId}
    `

    // Delete user role assignments
    await sql`
      DELETE FROM user_roles WHERE role_id = ${roleId}
    `

    // Delete the role
    await sql`
      DELETE FROM roles WHERE id = ${roleId}
    `

    // Log the deletion
    await sql`
      INSERT INTO audit_logs (username, action_type, entity_type, entity_id, description, severity, status)
      VALUES ('admin', 'DELETE', 'role', ${roleId}, 'Deleted role', 'high', 'success')
    `

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
