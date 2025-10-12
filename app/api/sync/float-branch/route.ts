import { type NextRequest, NextResponse } from "next/server"
import { syncFloatWithBranchData } from "@/lib/float-service"

export async function POST(request: NextRequest) {
  try {
    const success = await syncFloatWithBranchData()

    if (!success) {
      return NextResponse.json({ error: "Failed to synchronize float with branch data" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in POST /api/sync/float-branch:", error)
    return NextResponse.json({ error: "Failed to synchronize float with branch data" }, { status: 500 })
  }
}
