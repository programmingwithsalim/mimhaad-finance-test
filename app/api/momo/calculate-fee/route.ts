import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { amount, provider, transaction_type, service_type } =
      await request.json();

    console.log("🧮 [FEE] Calculating fee for:", {
      amount,
      provider,
      transaction_type,
      service_type,
    });

    // Validate inputs
    if (!amount || !provider || !transaction_type) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const transactionAmount = Number(amount);
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Query fee configuration
    const feeConfig = await sql`
      SELECT 
        fee_type,
        fee_value,
        minimum_fee,
        maximum_fee,
        tier_min_amount,
        tier_max_amount
      FROM fee_config 
      WHERE service_type = ${service_type || "momo"}
      AND transaction_type = ${transaction_type}
      AND is_active = true
      AND (tier_min_amount IS NULL OR ${transactionAmount} >= tier_min_amount)
      AND (tier_max_amount IS NULL OR ${transactionAmount} <= tier_max_amount)
      ORDER BY tier_min_amount DESC
      LIMIT 1
    `;

    let calculatedFee = 0;

    if (feeConfig.length > 0) {
      const config = feeConfig[0];

      if (config.fee_type === "percentage") {
        calculatedFee = (transactionAmount * Number(config.fee_value)) / 100;
      } else if (config.fee_type === "fixed") {
        calculatedFee = Number(config.fee_value);
      }

      // Apply minimum fee
      if (config.minimum_fee && calculatedFee < Number(config.minimum_fee)) {
        calculatedFee = Number(config.minimum_fee);
      }

      // Apply maximum fee
      if (config.maximum_fee && calculatedFee > Number(config.maximum_fee)) {
        calculatedFee = Number(config.maximum_fee);
      }
    } else {
      // Default fee structure if no config found
      if (transactionAmount <= 100) {
        calculatedFee = 1.0;
      } else if (transactionAmount <= 500) {
        calculatedFee = 2.0;
      } else if (transactionAmount <= 1000) {
        calculatedFee = 3.0;
      } else {
        calculatedFee = Math.min(transactionAmount * 0.005, 10.0); // 0.5% with max of 10 GHS
      }
    }

    console.log("🧮 [FEE] Calculated fee:", calculatedFee);

    return NextResponse.json({
      success: true,
      fee: Number(calculatedFee.toFixed(2)),
      amount: transactionAmount,
      provider,
      transaction_type,
    });
  } catch (error) {
    console.error("[FEE] Error calculating fee:", error);
    return NextResponse.json(
      { error: "Failed to calculate fee" },
      { status: 500 }
    );
  }
}
