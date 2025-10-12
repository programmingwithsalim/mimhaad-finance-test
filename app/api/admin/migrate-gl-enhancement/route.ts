import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Migration endpoint disabled",
      message: "This migration endpoint has been disabled for production deployment",
    },
    { status: 404 },
  )
}
