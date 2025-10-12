import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const permissions = await sql`
      SELECT 
        id,
        name,
        display_name,
        description,
        category,
        is_system,
        created_at
      FROM permissions 
      ORDER BY category, display_name
    `

    // Group permissions by category
    const groupedPermissions = permissions.reduce((acc: any, permission: any) => {
      if (!acc[permission.category]) {
        acc[permission.category] = []
      }
      acc[permission.category].push(permission)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: permissions,
      grouped: groupedPermissions,
    })
  } catch (error) {
    console.error("Error fetching permissions:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch permissions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name, display_name, description, category, created_by } = await request.json()

    if (!name || !display_name || !category) {
      return NextResponse.json(
        { success: false, error: "Name, display name, and category are required" },
        { status: 400 },
      )
    }

    const newPermission = await sql`
      INSERT INTO permissions (name, display_name, description, category)
      VALUES (${name}, ${display_name}, ${description || null}, ${category})
      RETURNING id, name, display_name, description, category, created_at
    `

    // Log the creation
    await sql`
      INSERT INTO audit_logs (user_id, username, action_type, entity_type, entity_id, description, severity, status)
      VALUES (${created_by || null}, 'admin', 'CREATE', 'permission', ${newPermission[0].id}, ${`Created permission: ${name}`}, 'medium', 'success')
    `

    return NextResponse.json({
      success: true,
      message: "Permission created successfully",
      data: newPermission[0],
    })
  } catch (error) {
    console.error("Error creating permission:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create permission",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
