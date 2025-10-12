import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
  try {
    const { amount, transactionType, partnerBankId } = await request.json()

    // Map transaction types to fee config service types
    const serviceType = "agency_banking"
    let feeTransactionType = transactionType

    if (transactionType === "interbank") {
      feeTransactionType = "interbank_transfer"
    }

    // Get fee configuration from database
    const feeConfig = await sql`
      SELECT * FROM fee_config 
      WHERE service_type = ${serviceType} 
      AND transaction_type = ${feeTransactionType}
      AND is_active = true
      ORDER BY effective_date DESC
      LIMIT 1
    `

    if (feeConfig.length === 0) {
      // Return default fee structure
      return NextResponse.json({
        success: true,
        fee: transactionType === "interbank" ? 15 : 0,
        fee_type: "fixed",
        fee_value: transactionType === "interbank" ? "15.0000" : "0.0000",
        minimum_fee: "0.00",
        maximum_fee: "0.00",
        feeSource: "default",
      })
    }

    const config = feeConfig[0]
    let calculatedFee = 0

    if (config.fee_type === "fixed") {
      calculatedFee = Number(config.fee_value)
    } else if (config.fee_type === "percentage") {
      calculatedFee = (amount * Number(config.fee_value)) / 100

      // Apply minimum and maximum limits
      if (config.minimum_fee && calculatedFee < Number(config.minimum_fee)) {
        calculatedFee = Number(config.minimum_fee)
      }
      if (config.maximum_fee && calculatedFee > Number(config.maximum_fee)) {
        calculatedFee = Number(config.maximum_fee)
      }
    }

    return NextResponse.json({
      success: true,
      fee: calculatedFee,
      fee_type: config.fee_type,
      fee_value: config.fee_value,
      minimum_fee: config.minimum_fee,
      maximum_fee: config.maximum_fee,
      feeSource: "database",
    })
  } catch (error) {
    console.error("Error calculating agency banking fee:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate fee",
      },
      { status: 500 },
    )
  }
}
