import { NextResponse } from "next/server"
import { syncAllBranchesWithUserData } from "@/lib/user-service"

export async function POST() {
  try {
    const result = await syncAllBranchesWithUserData()

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in POST /api/sync/branches-users:", error)
    return NextResponse.json(
      {
        success: false,
        updatedBranches: 0,
        errors: 1,
        details: [(error as Error).message],
      },
      { status: 500 },
    )
  }
}

// Also allow GET for convenience
export async function GET() {
  try {
    const result = await syncAllBranchesWithUserData()

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in GET /api/sync/branches-users:", error)
    return NextResponse.json(
      {
        success: false,
        updatedBranches: 0,
        errors: 1,
        details: [(error as Error).message],
      },
      { status: 500 },
    )
  }
}
