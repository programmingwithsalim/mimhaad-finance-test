import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Seed endpoint disabled",
      message: "Seed endpoints have been disabled for production deployment",
    },
    { status: 404 },
  )
}
