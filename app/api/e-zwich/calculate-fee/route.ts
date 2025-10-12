import { NextResponse } from "next/server";
import { SettingsService } from "@/lib/settings-service";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { amount, transactionType, fee } = await request.json();

    if (!transactionType) {
      return NextResponse.json(
        { success: false, error: "Transaction type is required" },
        { status: 400 }
      );
    }

    let calculatedFee = 0;
    let feeType = "none";
    let minimumFee = 0;
    let maximumFee = 0;
    let feeSource = "calculated";

    if (transactionType === "withdrawal") {
      try {
        // Try to get fee configuration from database
        const feeConfig = await sql`
          SELECT * FROM fee_config 
          WHERE service_type = 'e-zwich' 
          AND transaction_type = 'withdrawal'
          AND is_active = true
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (feeConfig.length > 0) {
          const config = feeConfig[0];
          feeSource = "database";
          feeType = config.fee_type;

          if (config.fee_type === "percentage") {
            calculatedFee = Number(amount) * (Number(config.fee_value) / 100);
          } else if (config.fee_type === "fixed") {
            calculatedFee = Number(config.fee_value);
          }

          // Apply min/max limits
          if (
            config.minimum_fee &&
            calculatedFee < Number(config.minimum_fee)
          ) {
            calculatedFee = Number(config.minimum_fee);
          }
          if (
            config.maximum_fee &&
            calculatedFee > Number(config.maximum_fee)
          ) {
            calculatedFee = Number(config.maximum_fee);
          }

          minimumFee = Number(config.minimum_fee) || 1.5;
          maximumFee = Number(config.maximum_fee) || 50;
        } else {
          // Fallback to default calculation for withdrawal
          console.log(
            "No E-Zwich fee config found, using fallback calculation"
          );

          if (amount >= 100) {
            calculatedFee = Math.max(amount * 0.015, 1.5); // 1.5% with minimum of GHS 1.5
            calculatedFee = Math.min(calculatedFee, 50); // Maximum of GHS 50
            feeType = "percentage";
            minimumFee = 1.5;
            maximumFee = 50;
          } else {
            calculatedFee = 0; // Free for amounts below GHS 100
            feeType = "free";
          }
        }
      } catch (dbError) {
        console.error(
          "Error fetching fee configuration from database:",
          dbError
        );
        // Fallback calculation for withdrawal
        if (amount >= 100) {
          calculatedFee = Math.max(amount * 0.015, 1.5); // 1.5% with minimum of GHS 1.5
          calculatedFee = Math.min(calculatedFee, 50); // Maximum of GHS 50
          feeType = "percentage";
          minimumFee = 1.5;
          maximumFee = 50;
        } else {
          calculatedFee = 0; // Free for amounts below GHS 100
          feeType = "free";
        }
      }
    } else if (transactionType === "card_issuance") {
      // Try to get E-Zwich card issuance fee configuration
      try {
        const feeConfig = await SettingsService.getFeeConfiguration(
          "e_zwich_card_issuance"
        );

        if (feeConfig && feeConfig.is_active) {
          calculatedFee = feeConfig.fee_value;
          feeType = feeConfig.fee_type;
          minimumFee = feeConfig.minimum_fee;
          maximumFee = feeConfig.maximum_fee;
          feeSource = "database";
        } else {
          // Fallback to default
          calculatedFee = 15.0; // Fixed fee for card issuance
          feeType = "fixed";
        }
      } catch (dbError) {
        console.error(
          "Error fetching fee configuration from database:",
          dbError
        );
        // Fallback to default for card issuance
        calculatedFee = 15.0;
        feeType = "fixed";
      }
    }

    // If a specific fee was provided, use that instead of calculated fee
    if (fee !== undefined && fee !== null && fee !== "") {
      calculatedFee = Number(fee);
      feeSource = "user_override";
    }

    return NextResponse.json({
      success: true,
      fee: Number(calculatedFee.toFixed(2)),
      feeType,
      minimumFee,
      maximumFee,
      feeSource,
      amount: Number(amount),
      transactionType,
    });
  } catch (error) {
    console.error("Error in fee calculation logic:", error);

    // Final fallback calculations
    let fallbackFee = 0;
    let fallbackFeeType = "fixed";

    if (transactionType === "withdrawal") {
      if (amount >= 100) {
        fallbackFee = Math.max(amount * 0.015, 1.5);
        fallbackFee = Math.min(fallbackFee, 50);
        fallbackFeeType = "percentage";
      } else {
        fallbackFee = 0;
        fallbackFeeType = "free";
      }
    } else if (transactionType === "card_issuance") {
      fallbackFee = 15.0;
      fallbackFeeType = "fixed";
    }

    return NextResponse.json({
      success: true,
      fee: Number(fallbackFee.toFixed(2)),
      feeType: fallbackFeeType,
      feeSource: "fallback",
      amount: Number(amount),
      transactionType,
    });
  }
}
