import { type NextRequest, NextResponse } from "next/server"
import { GLDatabase } from "@/lib/gl-database"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get("accountId")
    const accountCode = searchParams.get("accountCode")

    if (accountId) {
      // Get balance by account ID
      const balance = await GLDatabase.getAccountBalance(accountId)

      if (!balance) {
        return NextResponse.json({ error: `Balance for account ID ${accountId} not found` }, { status: 404 })
      }

      return NextResponse.json({ balance })
    } else if (accountCode) {
      // Get balance by account code
      const balance = await GLDatabase.getAccountBalanceByCode(accountCode)

      if (!balance) {
        return NextResponse.json({ error: `Balance for account code ${accountCode} not found` }, { status: 404 })
      }

      return NextResponse.json({ balance })
    } else {
      // Get trial balance
      const asOfDate = searchParams.get("asOfDate")
      const trialBalance = await GLDatabase.getTrialBalance(asOfDate || undefined)

      return NextResponse.json({ trialBalance })
    }
  } catch (error) {
    console.error("Error in GET /api/gl/balances:", error)
    return NextResponse.json({ error: "Failed to fetch GL balances" }, { status: 500 })
  }
}
