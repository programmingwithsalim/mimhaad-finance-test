import { NextResponse } from "next/server"
import { GLDatabase } from "@/lib/gl-database"

export async function POST() {
  try {
    await GLDatabase.ensureGLAccountsExist()

    return NextResponse.json({
      success: true,
      message: "GL accounts ensured successfully",
    })
  } catch (error) {
    console.error("Error ensuring GL accounts:", error)
    return NextResponse.json({ error: "Failed to ensure GL accounts" }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check which accounts exist
    const requiredCodes = [
      "1001",
      "1002",
      "1003",
      "1004",
      "2001",
      "2002",
      "2003",
      "4001",
      "4002",
      "4003",
      "4004",
      "4005",
      "5001",
    ]
    const accountStatus = []

    for (const code of requiredCodes) {
      const account = await GLDatabase.getGLAccountByCode(code)
      accountStatus.push({
        code,
        exists: !!account,
        name: account?.name || "Not found",
      })
    }

    return NextResponse.json({
      success: true,
      accounts: accountStatus,
    })
  } catch (error) {
    console.error("Error checking GL accounts:", error)
    return NextResponse.json({ error: "Failed to check GL accounts" }, { status: 500 })
  }
}
