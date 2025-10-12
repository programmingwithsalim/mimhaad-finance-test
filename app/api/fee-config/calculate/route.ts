import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { serviceType, transactionType, amount } = await request.json();

    if (!serviceType || !transactionType || !amount) {
      return NextResponse.json(
        { success: false, error: "Service type, transaction type, and amount are required" },
        { status: 400 }
      );
    }

    // Get fee configuration from fee_config table
    const feeConfig = await sql`
      SELECT * FROM fee_config 
      WHERE service_type = ${serviceType}
      AND transaction_type = ${transactionType}
      AND is_active = true
      LIMIT 1
    `;

    if (feeConfig.length === 0) {
      return NextResponse.json({
        success: true,
        fee: 0,
        total: amount,
        feeConfig: null,
        message: "No fee configuration found for this transaction type"
      });
    }

    const config = feeConfig[0];
    let calculatedFee = 0;

    // Calculate fee based on type
    if (config.fee_type === "percentage") {
      calculatedFee = (amount * config.fee_value) / 100;
    } else {
      calculatedFee = config.fee_value;
    }

    // Apply minimum and maximum limits
    if (config.minimum_fee > 0 && calculatedFee < config.minimum_fee) {
      calculatedFee = config.minimum_fee;
    }
    if (config.maximum_fee > 0 && calculatedFee > config.maximum_fee) {
      calculatedFee = config.maximum_fee;
    }

    const finalFee = Math.round(calculatedFee * 100) / 100; // Round to 2 decimal places
    const total = Math.round((amount + finalFee) * 100) / 100;

    return NextResponse.json({
      success: true,
      fee: finalFee,
      total: total,
      feeConfig: {
        id: config.id,
        service_type: config.service_type,
        transaction_type: config.transaction_type,
        fee_type: config.fee_type,
        fee_value: config.fee_value,
        minimum_fee: config.minimum_fee,
        maximum_fee: config.maximum_fee,
        currency: config.currency
      },
      message: "Fee calculated successfully"
    });

  } catch (error) {
    console.error("Error calculating fee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate fee" },
      { status: 500 }
    );
  }
} 