import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Check if fee_config table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'fee_config'
      ) as exists
    `;

    if (!tableExists[0]?.exists) {
      console.log("Creating fee_config table...");

      // Create fee_config table
      await sql`
        CREATE TABLE fee_config (
          id SERIAL PRIMARY KEY,
          service_type VARCHAR(50) NOT NULL,
          transaction_type VARCHAR(50) NOT NULL,
          fee_type VARCHAR(20) DEFAULT 'percentage' CHECK (fee_type IN ('percentage', 'fixed')),
          fee_value DECIMAL(10,4) NOT NULL,
          minimum_fee DECIMAL(10,2) DEFAULT 0,
          maximum_fee DECIMAL(10,2),
          currency VARCHAR(3) DEFAULT 'GHS',
          tier_min_amount DECIMAL(15,2) DEFAULT 0,
          tier_max_amount DECIMAL(15,2),
          is_active BOOLEAN DEFAULT TRUE,
          effective_date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255),
          updated_by VARCHAR(255),
          UNIQUE(service_type, transaction_type)
        )
      `;

      // Insert default fee configurations only if table was just created
      await sql`
        INSERT INTO fee_config (service_type, transaction_type, fee_type, fee_value, minimum_fee, maximum_fee, currency, is_active) VALUES
        ('momo', 'deposit', 'percentage', 1.5, 1.00, 50.00, 'GHS', true),
        ('momo', 'withdrawal', 'percentage', 2.0, 2.00, 100.00, 'GHS', true),
        ('agency_banking', 'deposit', 'fixed', 5.0, 0, 0, 'GHS', true),
        ('agency_banking', 'withdrawal', 'fixed', 10.0, 0, 0, 'GHS', true),
        ('agency_banking', 'interbank_transfer', 'fixed', 15.0, 0, 0, 'GHS', true),
        ('e_zwich', 'card_issuance', 'fixed', 15.0, 0, 0, 'GHS', true),
        ('e_zwich', 'withdrawal', 'percentage', 1.5, 1.50, 50.00, 'GHS', true),
        ('power', 'transaction', 'percentage', 2.0, 1.00, 25.00, 'GHS', true),
        ('jumia', 'transaction', 'percentage', 1.0, 0.50, 20.00, 'GHS', true),
        ('interbank', 'transfer', 'fixed', 20.0, 0, 0, 'GHS', true),
        ('interbank', 'inquiry', 'fixed', 2.0, 0, 0, 'GHS', true)
        ON CONFLICT (service_type, transaction_type) DO NOTHING
      `;
    }

    const fees = await sql`
      SELECT * FROM fee_config 
      WHERE is_active = true
      ORDER BY service_type, transaction_type
    `;

    return NextResponse.json({
      success: true,
      data: fees,
    });
  } catch (error) {
    console.error("Error fetching fee config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch fee configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const feeData = await request.json();
    console.log("📝 [FEE-CONFIG] Received fee data:", feeData);

    const {
      service_type,
      transaction_type,
      fee_type,
      fee_value,
      minimum_fee,
      maximum_fee,
      currency = "GHS",
      is_active = true,
    } = feeData;

    // Validate required fields
    if (
      !service_type ||
      !transaction_type ||
      !fee_type ||
      fee_value === undefined
    ) {
      console.log(
        "❌ [FEE-CONFIG] Validation failed - missing required fields"
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: service_type, transaction_type, fee_type, fee_value",
        },
        { status: 400 }
      );
    }

    // Validate fee_type
    if (!["percentage", "fixed", "tiered"].includes(fee_type)) {
      console.log(
        "❌ [FEE-CONFIG] Validation failed - invalid fee_type:",
        fee_type
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid fee_type. Must be 'percentage', 'fixed', or 'tiered'",
        },
        { status: 400 }
      );
    }

    console.log("🔍 [FEE-CONFIG] Checking for existing configuration...");

    // Check if configuration already exists
    const existingConfig = await sql`
      SELECT id FROM fee_config 
      WHERE service_type = ${service_type} 
      AND transaction_type = ${transaction_type}
    `;

    console.log(
      "🔍 [FEE-CONFIG] Existing configs found:",
      existingConfig.length
    );

    if (existingConfig.length > 0) {
      // Update existing configuration
      console.log("🔄 [FEE-CONFIG] Updating existing configuration...");
      const result = await sql`
        UPDATE fee_config SET
          fee_type = ${fee_type},
          fee_value = ${fee_value},
          minimum_fee = ${minimum_fee || 0},
          maximum_fee = ${maximum_fee || null},
          currency = ${currency},
          is_active = ${is_active},
          updated_at = NOW()
        WHERE service_type = ${service_type} 
        AND transaction_type = ${transaction_type}
        RETURNING *
      `;

      console.log("✅ [FEE-CONFIG] Updated configuration:", result[0]);

      return NextResponse.json({
        success: true,
        message: "Fee configuration updated successfully",
        data: result[0],
      });
    } else {
      // Create new configuration
      console.log("🆕 [FEE-CONFIG] Creating new configuration...");
      const result = await sql`
        INSERT INTO fee_config (
          service_type, 
          transaction_type, 
          fee_type, 
          fee_value, 
          minimum_fee, 
          maximum_fee, 
          currency, 
          is_active,
          effective_date,
          created_at,
          updated_at
        ) VALUES (
          ${service_type}, 
          ${transaction_type}, 
          ${fee_type}, 
          ${fee_value}, 
          ${minimum_fee || 0}, 
          ${maximum_fee || null}, 
          ${currency}, 
          ${is_active},
          CURRENT_DATE,
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      console.log("✅ [FEE-CONFIG] Created new configuration:", result[0]);

      return NextResponse.json({
        success: true,
        message: "Fee configuration created successfully",
        data: result[0],
      });
    }
  } catch (error) {
    console.error("❌ [FEE-CONFIG] Error creating/updating fee config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create/update fee configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
