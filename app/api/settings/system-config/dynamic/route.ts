import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    let query = `
      SELECT 
        id,
        category,
        setting_key,
        setting_value,
        data_type,
        display_name,
        description,
        is_encrypted,
        is_public,
        validation_rules,
        default_value,
        updated_at
      FROM system_settings
    `

    const params: any[] = []
    if (category) {
      query += ` WHERE category = $1`
      params.push(category)
    }

    query += ` ORDER BY category, setting_key`

    const settings = await sql.unsafe(query, params)

    // Group by category
    const groupedSettings = settings.reduce((acc: any, setting: any) => {
      if (!acc[setting.category]) {
        acc[setting.category] = []
      }
      acc[setting.category].push(setting)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: settings,
      grouped: groupedSettings,
    })
  } catch (error) {
    console.error("Error fetching system settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch system settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { settings, updated_by } = await request.json()

    if (!Array.isArray(settings)) {
      return NextResponse.json({ success: false, error: "Settings must be an array" }, { status: 400 })
    }

    // Update each setting
    for (const setting of settings) {
      const { id, setting_value } = setting

      await sql`
        UPDATE system_settings 
        SET 
          setting_value = ${setting_value},
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ${updated_by || null}
        WHERE id = ${id}
      `
    }

    // Log the changes
    await sql`
      INSERT INTO audit_logs (user_id, username, action_type, entity_type, description, severity, status)
      VALUES (${updated_by || null}, 'admin', 'UPDATE', 'system_settings', ${`Updated ${settings.length} system setting(s)`}, 'medium', 'success')
    `

    return NextResponse.json({
      success: true,
      message: "System settings updated successfully",
    })
  } catch (error) {
    console.error("Error updating system settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update system settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { category, setting_key, setting_value, data_type, display_name, description, created_by } =
      await request.json()

    if (!category || !setting_key || !display_name) {
      return NextResponse.json(
        { success: false, error: "Category, setting key, and display name are required" },
        { status: 400 },
      )
    }

    const newSetting = await sql`
      INSERT INTO system_settings (
        category, setting_key, setting_value, data_type, display_name, description, updated_by
      )
      VALUES (
        ${category}, ${setting_key}, ${setting_value || null}, ${data_type || "string"}, 
        ${display_name}, ${description || null}, ${created_by || null}
      )
      RETURNING id, category, setting_key, setting_value, data_type, display_name, description, created_at
    `

    return NextResponse.json({
      success: true,
      message: "System setting created successfully",
      data: newSetting[0],
    })
  } catch (error) {
    console.error("Error creating system setting:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create system setting",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
