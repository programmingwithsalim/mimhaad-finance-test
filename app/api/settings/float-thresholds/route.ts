import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    console.log("Fetching float threshold settings...")

    // Ensure system_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Get float threshold settings
    const settings = await sql`
      SELECT key, value, data_type, description
      FROM system_settings 
      WHERE category = 'float_thresholds' OR key LIKE '%float%threshold%'
      ORDER BY key
    `

    // If no settings exist, create default ones
    if (settings.length === 0) {
      console.log("No float threshold settings found, creating defaults...")

      const defaultSettings = [
        {
          key: "float_min_threshold_momo",
          value: "10000",
          category: "float_thresholds",
          description: "Minimum threshold for Mobile Money float accounts",
          data_type: "number",
        },
        {
          key: "float_max_threshold_momo",
          value: "100000",
          category: "float_thresholds",
          description: "Maximum threshold for Mobile Money float accounts",
          data_type: "number",
        },
        {
          key: "float_min_threshold_agency_banking",
          value: "20000",
          category: "float_thresholds",
          description: "Minimum threshold for Agency Banking float accounts",
          data_type: "number",
        },
        {
          key: "float_max_threshold_agency_banking",
          value: "150000",
          category: "float_thresholds",
          description: "Maximum threshold for Agency Banking float accounts",
          data_type: "number",
        },
        {
          key: "float_min_threshold_e_zwich",
          value: "5000",
          category: "float_thresholds",
          description: "Minimum threshold for E-Zwich float accounts",
          data_type: "number",
        },
        {
          key: "float_max_threshold_e_zwich",
          value: "80000",
          category: "float_thresholds",
          description: "Maximum threshold for E-Zwich float accounts",
          data_type: "number",
        },
        {
          key: "float_min_threshold_power",
          value: "5000",
          category: "float_thresholds",
          description: "Minimum threshold for Power float accounts",
          data_type: "number",
        },
        {
          key: "float_max_threshold_power",
          value: "60000",
          category: "float_thresholds",
          description: "Maximum threshold for Power float accounts",
          data_type: "number",
        },
        {
          key: "float_critical_threshold_percentage",
          value: "80",
          category: "float_thresholds",
          description: "Percentage below minimum threshold to consider critical",
          data_type: "number",
        },
        {
          key: "float_low_threshold_percentage",
          value: "150",
          category: "float_thresholds",
          description: "Percentage of minimum threshold to consider low",
          data_type: "number",
        },
      ]

      // Insert default settings
      for (const setting of defaultSettings) {
        await sql`
          INSERT INTO system_settings (key, value, category, description, data_type, is_public)
          VALUES (${setting.key}, ${setting.value}, ${setting.category}, 
                  ${setting.description}, ${setting.data_type}, false)
          ON CONFLICT (key) DO NOTHING
        `
      }

      // Fetch the newly created settings
      const newSettings = await sql`
        SELECT key, value, data_type, description
        FROM system_settings 
        WHERE category = 'float_thresholds'
        ORDER BY key
      `

      return NextResponse.json({
        success: true,
        settings: formatSettings(newSettings),
      })
    }

    return NextResponse.json({
      success: true,
      settings: formatSettings(settings),
    })
  } catch (error) {
    console.error("Error fetching float threshold settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch float threshold settings: ${error.message}`,
        settings: getDefaultThresholds(),
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings } = body

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid settings format",
        },
        { status: 400 },
      )
    }

    console.log("Updating float threshold settings:", settings)

    // Update each setting
    for (const setting of settings) {
      await sql`
        UPDATE system_settings 
        SET value = ${setting.value}, updated_at = CURRENT_TIMESTAMP
        WHERE key = ${setting.key}
      `
    }

    return NextResponse.json({
      success: true,
      message: "Float threshold settings updated successfully",
    })
  } catch (error) {
    console.error("Error updating float threshold settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to update float threshold settings: ${error.message}`,
      },
      { status: 500 },
    )
  }
}

function formatSettings(settings: any[]) {
  const formatted = {}
  settings.forEach((setting) => {
    const value = setting.data_type === "number" ? Number(setting.value) : setting.value
    formatted[setting.key] = {
      value,
      description: setting.description,
      data_type: setting.data_type,
    }
  })
  return formatted
}

function getDefaultThresholds() {
  return {
    float_min_threshold_momo: {
      value: 10000,
      description: "Minimum threshold for Mobile Money float accounts",
      data_type: "number",
    },
    float_max_threshold_momo: {
      value: 100000,
      description: "Maximum threshold for Mobile Money float accounts",
      data_type: "number",
    },
    float_min_threshold_agency_banking: {
      value: 20000,
      description: "Minimum threshold for Agency Banking float accounts",
      data_type: "number",
    },
    float_max_threshold_agency_banking: {
      value: 150000,
      description: "Maximum threshold for Agency Banking float accounts",
      data_type: "number",
    },
    float_min_threshold_e_zwich: {
      value: 5000,
      description: "Minimum threshold for E-Zwich float accounts",
      data_type: "number",
    },
    float_max_threshold_e_zwich: {
      value: 80000,
      description: "Maximum threshold for E-Zwich float accounts",
      data_type: "number",
    },
    float_min_threshold_power: {
      value: 5000,
      description: "Minimum threshold for Power float accounts",
      data_type: "number",
    },
    float_max_threshold_power: {
      value: 60000,
      description: "Maximum threshold for Power float accounts",
      data_type: "number",
    },
    float_critical_threshold_percentage: {
      value: 80,
      description: "Percentage below minimum threshold to consider critical",
      data_type: "number",
    },
    float_low_threshold_percentage: {
      value: 150,
      description: "Percentage of minimum threshold to consider low",
      data_type: "number",
    },
  }
}
