import { type NextRequest, NextResponse } from "next/server"
import { GLServiceEnhanced } from "@/lib/gl-service-enhanced"

const glService = new GLServiceEnhanced()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeFloatBalances = searchParams.get("includeFloatBalances") === "true"

    if (includeFloatBalances) {
      const accounts = await glService.getChartOfAccountsWithFloatBalances()
      return NextResponse.json({ accounts })
    }

    // Standard chart of accounts
    const accounts = await glService.getChartOfAccountsWithFloatBalances()
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("Error fetching GL accounts:", error)
    return NextResponse.json({ error: "Failed to fetch GL accounts" }, { status: 500 })
  }
}
