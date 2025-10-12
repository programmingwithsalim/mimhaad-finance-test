import { type NextRequest, NextResponse } from "next/server"
import { GLServiceEnhanced } from "@/lib/gl-service-enhanced"

const glService = new GLServiceEnhanced()

export async function POST(request: NextRequest) {
  try {
    await glService.syncFloatAccountBalances()

    return NextResponse.json({
      success: true,
      message: "Float account balances synced successfully",
    })
  } catch (error) {
    console.error("Error syncing float balances:", error)
    return NextResponse.json({ error: "Failed to sync float balances" }, { status: 500 })
  }
}
