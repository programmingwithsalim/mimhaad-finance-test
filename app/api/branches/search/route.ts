import { NextResponse } from "next/server"
import { searchBranches } from "@/lib/branch-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""

    const branches = await searchBranches(query)
    return NextResponse.json(branches)
  } catch (error) {
    console.error("Error searching branches:", error)
    return NextResponse.json({ error: "Failed to search branches" }, { status: 500 })
  }
}
