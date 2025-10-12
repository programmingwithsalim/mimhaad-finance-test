import { type NextRequest, NextResponse } from "next/server"
import { EZwichSettlementService } from "@/lib/services/ezwich-settlement-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { branchId, partnerAccountId, amount, reference, processedBy, userId } = body

    // Validate required fields
    if (!branchId || !partnerAccountId || !amount || !processedBy || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 },
      )
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid settlement amount",
        },
        { status: 400 },
      )
    }

    // Process the settlement
    const result = await EZwichSettlementService.processEndOfDaySettlement({
      branchId,
      partnerAccountId,
      amount,
      reference,
      processedBy,
      userId,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        settlementId: result.settlementId,
        withdrawalsSettled: result.withdrawalsSettled,
        totalAmount: result.totalAmount,
        message: result.message,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          errorCode: result.error,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Error processing E-Zwich settlement:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process settlement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")
    const action = searchParams.get("action")

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "Branch ID is required",
        },
        { status: 400 },
      )
    }

    if (action === "history") {
      const history = await EZwichSettlementService.getSettlementHistory(branchId)
      return NextResponse.json({
        success: true,
        settlements: history,
      })
    } else if (action === "statistics") {
      const statistics = await EZwichSettlementService.getSettlementStatistics(branchId)
      return NextResponse.json({
        success: true,
        statistics,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid action",
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Error getting settlement data:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get settlement data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
