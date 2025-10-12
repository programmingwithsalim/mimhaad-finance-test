import { NextResponse } from "next/server"
import { getExistingAccountTypesForBranch } from "@/lib/float-account-service"

export async function GET(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: branchId } = await params

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 })
    }

    const existingAccounts = await getExistingAccountTypesForBranch(branchId)

    return NextResponse.json(existingAccounts)
  } catch (error) {
    console.error("Error fetching existing accounts:", error)
    return NextResponse.json({ error: "Failed to fetch existing accounts" }, { status: 500 })
  }
}
