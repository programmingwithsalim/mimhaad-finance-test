import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;

    const feeConfig = await sql`
      SELECT * FROM fee_config 
      WHERE id = ${id}
    `;

    if (feeConfig.length === 0) {
      return NextResponse.json(
        { success: false, error: "Fee configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: feeConfig[0],
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;
    const feeData = await request.json();
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
      return NextResponse.json(
        {
          success: false,
          error: "Invalid fee_type. Must be 'percentage', 'fixed', or 'tiered'",
        },
        { status: 400 }
      );
    }

    // Update the fee configuration
    const result = await sql`
      UPDATE fee_config SET
        service_type = ${service_type},
        transaction_type = ${transaction_type},
        fee_type = ${fee_type},
        fee_value = ${fee_value},
        minimum_fee = ${minimum_fee || 0},
        maximum_fee = ${maximum_fee || null},
        currency = ${currency},
        is_active = ${is_active},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Fee configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Fee configuration updated successfully",
      data: result[0],
    });
  } catch (error) {
    console.error("Error updating fee config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update fee configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;

    const result = await sql`
      DELETE FROM fee_config 
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Fee configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Fee configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting fee config:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete fee configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
