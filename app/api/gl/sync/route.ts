import { type NextRequest, NextResponse } from "next/server"
import { GLSyncManager } from "@/lib/gl-sync-manager"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { module } = body

    let result

    if (module) {
      // Sync specific module
      switch (module) {
        case "momo":
          result = await GLSyncManager.syncMoMoTransactions()
          break
        case "agency-banking":
          result = await GLSyncManager.syncAgencyBankingTransactions()
          break
        case "commissions":
          result = await GLSyncManager.syncCommissionTransactions()
          break
        case "expenses":
          result = await GLSyncManager.syncExpenseTransactions()
          break
        default:
          return NextResponse.json({ error: `Unknown module: ${module}` }, { status: 400 })
      }

      return NextResponse.json({ result })
    } else {
      // Sync all modules
      result = await GLSyncManager.syncAllModules()
      return NextResponse.json({ results: result })
    }
  } catch (error) {
    console.error("Error in POST /api/gl/sync:", error)
    return NextResponse.json({ error: "Failed to sync GL data" }, { status: 500 })
  }
}
