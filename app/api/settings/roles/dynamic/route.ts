import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Get all roles with their permissions
    const roles = await sql`
      SELECT 
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.color,
        r.is_default,
        r.is_system,
        r.priority,
        r.created_at,
        r.updated_at,
        COALESCE(
          JSON_AGG(
            CASE WHEN p.id IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'display_name', p.display_name,
                'category', p.category,
                'granted', rp.granted
              )
            END
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) as permissions,
        COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
      GROUP BY r.id, r.name, r.display_name, r.description, r.color, r.is_default, r.is_system, r.priority, r.created_at, r.updated_at
      ORDER BY r.priority DESC, r.name
    `

    return NextResponse.json({
      success: true,
      data: roles,
    })
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch roles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name, display_name, description, color, permissions, created_by } = await request.json()

    // Validate required fields
    if (!name || !display_name) {
      return NextResponse.json({ success: false, error: "Name and display name are required" }, { status: 400 })
    }

    // Create the role
    const newRole = await sql`
      INSERT INTO roles (name, display_name, description, color, created_by)
      VALUES (${name}, ${display_name}, ${description || null}, ${color || "default"}, ${created_by || null})
      RETURNING id, name, display_name, description, color, created_at
    `

    const roleId = newRole[0].id

    // Assign permissions if provided
    if (permissions && Array.isArray(permissions)) {
      for (const permissionId of permissions) {
        await sql`
          INSERT INTO role_permissions (role_id, permission_id, granted, created_by)
          VALUES (${roleId}, ${permissionId}, true, ${created_by || null})
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `
      }
    }

    // Log the creation
    await sql`
      INSERT INTO audit_logs (user_id, username, action_type, entity_type, entity_id, description, severity, status)
      VALUES (${created_by || null}, 'admin', 'CREATE', 'role', ${roleId}, ${`Created role: ${name}`}, 'medium', 'success')
    `

    return NextResponse.json({
      success: true,
      message: "Role created successfully",
      data: newRole[0],
    })
  } catch (error) {
    console.error("Error creating role:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create role",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
