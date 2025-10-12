import { type NextRequest, NextResponse } from "next/server"
import { GLServiceEnhanced } from "@/lib/gl-service-enhanced"

const glService = new GLServiceEnhanced()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const asOfDate = searchParams.get("asOfDate")

    const trialBalance = await glService.getTrialBalance(asOfDate || undefined)

    return NextResponse.json({ trialBalance })
  } catch (error) {
    console.error("Error generating trial balance:", error)
    return NextResponse.json({ error: "Failed to generate trial balance" }, { status: 500 })
  }
}
