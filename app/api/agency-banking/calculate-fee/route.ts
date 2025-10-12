import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    const { amount, transactionType, partnerBankId } = await request.json()

    if (!amount || !transactionType) {
      return NextResponse.json({ error: "Amount and transaction type are required" }, { status: 400 })
    }

    console.log("Calculating Agency Banking fee:", { amount, transactionType, partnerBankId })

    // Try to get fee configuration from database
    const feeConfig = await sql`
      SELECT * FROM fee_config 
      WHERE service_type = 'agency_banking' 
      AND transaction_type = ${transactionType}
      AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `

    let calculatedFee = 0
    let feeType = "percentage"
    let feeSource = "calculated"
    let minimumFee = 5
    let maximumFee = 50
    let details = null

    if (feeConfig.length > 0) {
      const config = feeConfig[0]
      details = config
      feeSource = "database"
      feeType = config.fee_type

      if (config.fee_type === "percentage") {
        calculatedFee = Number(amount) * (Number(config.fee_value) / 100)
      } else if (config.fee_type === "fixed") {
        calculatedFee = Number(config.fee_value)
      } else if (config.fee_type === "tiered") {
        // Implement tiered fee calculation based on amount ranges
        const tiers = config.tier_config || []
        for (const tier of tiers) {
          if (amount >= tier.min_amount && amount <= tier.max_amount) {
            calculatedFee = Number(tier.fee_value)
            break
          }
        }
      }

      // Apply min/max limits
      if (config.minimum_fee && calculatedFee < Number(config.minimum_fee)) {
        calculatedFee = Number(config.minimum_fee)
      }
      if (config.maximum_fee && calculatedFee > Number(config.maximum_fee)) {
        calculatedFee = Number(config.maximum_fee)
      }

      minimumFee = Number(config.minimum_fee) || 5
      maximumFee = Number(config.maximum_fee) || 50
    } else {
      // Fallback calculation for Agency Banking
      console.log("No Agency Banking fee config found, using fallback calculation")

      if (transactionType === "interbank") {
        // Interbank transfer fee: 1% of amount
        calculatedFee = Number(amount) * 0.01
        minimumFee = 5
        maximumFee = 50
      } else if (transactionType === "deposit") {
        // Deposit fee: fixed fee
        calculatedFee = 5
        feeType = "fixed"
      } else if (transactionType === "withdrawal") {
        // Withdrawal fee: fixed fee
        calculatedFee = 10
        feeType = "fixed"
      } else {
        // Other transaction types
        calculatedFee = 5
        feeType = "fixed"
      }

      calculatedFee = Math.min(Math.max(Number(calculatedFee), minimumFee), maximumFee)
    }

    // Ensure calculatedFee is a valid number
    calculatedFee = Number(calculatedFee) || 0

    const result = {
      fee: Number(calculatedFee.toFixed(2)),
      feeType,
      feeSource,
      minimumFee,
      maximumFee,
      details,
    }

    console.log("Agency Banking fee calculation result:", result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error calculating Agency Banking fee:", error)
    return NextResponse.json({ error: "Failed to calculate fee" }, { status: 500 })
  }
}
