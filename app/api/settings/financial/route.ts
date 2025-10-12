import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// GET - Retrieve financial settings
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !["Admin", "Finance", "Manager"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Create system_settings table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) UNIQUE NOT NULL,
        value DECIMAL(15,2) DEFAULT 0,
        description TEXT,
        updated_by VARCHAR(255),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Get all financial settings
    const settings = await sql`
      SELECT key, value, description, updated_at
      FROM system_settings
      WHERE key IN ('shareholders_equity', 'retained_earnings', 'bank_loan')
      ORDER BY key
    `;

    // Ensure all keys exist
    const settingsMap = new Map(settings.map((s) => [s.key, s]));

    const defaultSettings = [
      {
        key: "shareholders_equity",
        value: 0,
        description:
          "Initial capital and additional investments by shareholders",
      },
      {
        key: "retained_earnings",
        value: 0,
        description: "Accumulated retained earnings from previous periods",
      },
      {
        key: "bank_loan",
        value: 0,
        description: "Outstanding bank loans and long-term liabilities",
      },
    ];

    // Insert missing settings
    for (const setting of defaultSettings) {
      if (!settingsMap.has(setting.key)) {
        await sql`
          INSERT INTO system_settings (key, value, description)
          VALUES (${setting.key}, ${setting.value}, ${setting.description})
          ON CONFLICT (key) DO NOTHING
        `;
      }
    }

    // Fetch updated settings
    const finalSettings = await sql`
      SELECT key, value, description, updated_by, updated_at
      FROM system_settings
      WHERE key IN ('shareholders_equity', 'retained_earnings', 'bank_loan')
      ORDER BY key
    `;

    return NextResponse.json({
      success: true,
      data: finalSettings.reduce((acc, s) => {
        acc[s.key] = {
          value: Number(s.value) || 0,
          description: s.description,
          updatedBy: s.updated_by,
          updatedAt: s.updated_at,
        };
        return acc;
      }, {} as any),
    });
  } catch (error) {
    console.error("Error fetching financial settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch financial settings" },
      { status: 500 }
    );
  }
}

// PUT - Update financial settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !["Admin", "Finance", "Manager"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: "Key and value are required" },
        { status: 400 }
      );
    }

    const validKeys = ["shareholders_equity", "retained_earnings", "bank_loan"];
    if (!validKeys.includes(key)) {
      return NextResponse.json(
        { success: false, error: "Invalid setting key" },
        { status: 400 }
      );
    }

    // Update the setting
    const result = await sql`
      INSERT INTO system_settings (key, value, description, updated_by, updated_at)
      VALUES (${key}, ${Number(value)}, ${description || null}, ${
      user.email
    }, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = ${Number(value)},
        description = COALESCE(${description}, system_settings.description),
        updated_by = ${user.email},
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: {
        key: result[0].key,
        value: Number(result[0].value),
        description: result[0].description,
        updatedBy: result[0].updated_by,
        updatedAt: result[0].updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating financial setting:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update financial setting" },
      { status: 500 }
    );
  }
}
