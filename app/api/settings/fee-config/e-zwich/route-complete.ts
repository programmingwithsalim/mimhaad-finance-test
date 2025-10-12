import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
  try {
    const { amount, transactionType } = await request.json()

    // Try to get fee from database
    const feeConfig = await sql`
      SELECT * FROM fee_config 
      WHERE service_type = 'e-zwich' 
      AND transaction_type = ${transactionType}
      AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (feeConfig.length > 0) {
      const config = feeConfig[0]
      let calculatedFee = 0

      if (config.fee_type === "fixed") {
        calculatedFee = Number(config.fee_value)
      } else if (config.fee_type === "percentage") {
        calculatedFee = (amount * Number(config.fee_value)) / 100

        // Apply min/max limits
        if (config.minimum_fee) {
          calculatedFee = Math.max(calculatedFee, Number(config.minimum_fee))
        }
        if (config.maximum_fee) {
          calculatedFee = Math.min(calculatedFee, Number(config.maximum_fee))
        }
      }

      return NextResponse.json({
        fee: calculatedFee,
        fee_type: config.fee_type,
        fee_value: config.fee_value,
        minimum_fee: config.minimum_fee,
        maximum_fee: config.maximum_fee,
        source: "database",
      })
    }

    // Fallback fee calculation
    let fallbackFee = 0
    if (transactionType === "withdrawal") {
      if (amount <= 100) fallbackFee = 2
      else if (amount <= 500) fallbackFee = 5
      else if (amount <= 1000) fallbackFee = 8
      else fallbackFee = Math.min(amount * 0.01, 15) // 1% max 15 GHS
    } else if (transactionType === "card_issuance") {
      fallbackFee = 15 // Standard card fee
    }

    return NextResponse.json({
      fee: fallbackFee,
      fee_type: "calculated",
      source: "fallback",
    })
  } catch (error: any) {
    console.error("Error calculating E-Zwich fee:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to calculate fee",
      },
      { status: 500 },
    )
  }
}
