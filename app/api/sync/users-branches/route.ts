import { NextResponse } from "next/server"
import { syncAllBranchesWithUserData } from "@/lib/user-service"

export async function POST() {
  try {
    const success = await syncAllBranchesWithUserData()

    if (!success) {
      return NextResponse.json({ error: "Failed to synchronize data" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Data synchronized successfully" }, { status: 200 })
  } catch (error) {
    console.error("Error in POST /api/sync/users-branches:", error)
    return NextResponse.json(
      { error: "Failed to synchronize data", details: (error as Error).message },
      { status: 500 },
    )
  }
}

// Also allow GET for convenience
export async function GET() {
  try {
    const success = await syncAllBranchesWithUserData()

    if (!success) {
      return NextResponse.json({ error: "Failed to synchronize data" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Data synchronized successfully" }, { status: 200 })
  } catch (error) {
    console.error("Error in GET /api/sync/users-branches:", error)
    return NextResponse.json(
      { error: "Failed to synchronize data", details: (error as Error).message },
      { status: 500 },
    )
  }
}
