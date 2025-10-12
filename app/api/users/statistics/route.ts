import { NextResponse } from "next/server"
import { getUserStatistics } from "@/lib/user-service"

export async function GET() {
  try {
    const statistics = await getUserStatistics()

    return NextResponse.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fetching user statistics:", error)

    // Return default statistics on error
    return NextResponse.json(
      {
        success: false,
        data: {
          total: 0,
          active: 0,
          inactive: 0,
          admins: 0,
          managers: 0,
          cashiers: 0,
        },
        error: error instanceof Error ? error.message : "Failed to fetch statistics",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
