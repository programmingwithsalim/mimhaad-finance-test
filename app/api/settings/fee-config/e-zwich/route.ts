import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionType = searchParams.get("transactionType") || "withdrawal"

    console.log("🔍 [FEE-CONFIG] Loading E-Zwich fee config for:", transactionType)

    // Ensure fee_config table exists
    await sql`
      CREATE TABLE IF NOT EXISTS fee_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_type VARCHAR(50) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('fixed', 'percentage', 'tiered')),
        fee_value DECIMAL(10,4) NOT NULL,
        minimum_fee DECIMAL(10,2),
        maximum_fee DECIMAL(10,2),
        tier_config JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Try to get existing config
    let config = await sql`
      SELECT * FROM fee_config 
      WHERE service_type = 'e-zwich' 
        AND transaction_type = ${transactionType}
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `

    // If no config exists, create default ones
    if (config.length === 0) {
      console.log("📝 [FEE-CONFIG] Creating default E-Zwich fee configs")

      // Create default configs
      await sql`
        INSERT INTO fee_config (service_type, transaction_type, fee_type, fee_value, minimum_fee, maximum_fee)
        VALUES 
          ('e-zwich', 'withdrawal', 'percentage', 1.0, 5.00, 20.00),
          ('e-zwich', 'card_issuance', 'fixed', 15.00, 15.00, 15.00)
        ON CONFLICT DO NOTHING
      `

      // Fetch the config again
      config = await sql`
        SELECT * FROM fee_config 
        WHERE service_type = 'e-zwich' 
          AND transaction_type = ${transactionType}
          AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `
    }

    if (config.length === 0) {
      // Return default fallback config
      const defaultConfig = {
        service_type: "e-zwich",
        transaction_type: transactionType,
        fee_type: transactionType === "withdrawal" ? "percentage" : "fixed",
        fee_value: transactionType === "withdrawal" ? 1.0 : 15.0,
        minimum_fee: transactionType === "withdrawal" ? 5.0 : 15.0,
        maximum_fee: transactionType === "withdrawal" ? 20.0 : 15.0,
        is_active: true,
      }

      console.log("⚠️ [FEE-CONFIG] Using default config:", defaultConfig)

      return NextResponse.json({
        success: true,
        config: defaultConfig,
        source: "default",
      })
    }

    const feeConfig = config[0]

    console.log("✅ [FEE-CONFIG] Loaded config:", {
      service_type: feeConfig.service_type,
      transaction_type: feeConfig.transaction_type,
      fee_type: feeConfig.fee_type,
      fee_value: feeConfig.fee_value,
    })

    return NextResponse.json({
      success: true,
      config: {
        id: feeConfig.id,
        service_type: feeConfig.service_type,
        transaction_type: feeConfig.transaction_type,
        fee_type: feeConfig.fee_type,
        fee_value: Number(feeConfig.fee_value),
        minimum_fee: feeConfig.minimum_fee ? Number(feeConfig.minimum_fee) : null,
        maximum_fee: feeConfig.maximum_fee ? Number(feeConfig.maximum_fee) : null,
        tier_config: feeConfig.tier_config,
        is_active: feeConfig.is_active,
        created_at: feeConfig.created_at,
        updated_at: feeConfig.updated_at,
      },
      source: "database",
    })
  } catch (error) {
    console.error("❌ [FEE-CONFIG] Error loading fee config:", error)

    // Return fallback config on error
    const fallbackConfig = {
      service_type: "e-zwich",
      transaction_type: "withdrawal",
      fee_type: "percentage",
      fee_value: 1.0,
      minimum_fee: 5.0,
      maximum_fee: 20.0,
      is_active: true,
    }

    return NextResponse.json({
      success: true,
      config: fallbackConfig,
      source: "fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction_type, fee_type, fee_value, minimum_fee, maximum_fee, tier_config } = body

    console.log("📝 [FEE-CONFIG] Creating/updating E-Zwich fee config:", body)

    // Validate required fields
    if (!transaction_type || !fee_type || fee_value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: transaction_type, fee_type, fee_value",
        },
        { status: 400 },
      )
    }

    // Validate fee_type
    if (!["fixed", "percentage", "tiered"].includes(fee_type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid fee_type. Must be 'fixed', 'percentage', or 'tiered'",
        },
        { status: 400 },
      )
    }

    // Deactivate existing configs for this service and transaction type
    await sql`
      UPDATE fee_config 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE service_type = 'e-zwich' AND transaction_type = ${transaction_type}
    `

    // Create new config
    const result = await sql`
      INSERT INTO fee_config (
        service_type,
        transaction_type,
        fee_type,
        fee_value,
        minimum_fee,
        maximum_fee,
        tier_config
      ) VALUES (
        'e-zwich',
        ${transaction_type},
        ${fee_type},
        ${fee_value},
        ${minimum_fee || null},
        ${maximum_fee || null},
        ${tier_config ? JSON.stringify(tier_config) : null}
      )
      RETURNING *
    `

    console.log("✅ [FEE-CONFIG] Created new fee config:", result[0].id)

    return NextResponse.json({
      success: true,
      config: result[0],
      message: "Fee configuration updated successfully",
    })
  } catch (error) {
    console.error("❌ [FEE-CONFIG] Error creating fee config:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create fee configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
