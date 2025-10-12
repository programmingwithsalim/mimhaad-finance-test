import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mark all unread notifications as read for the current user
    const result = await sql`
      UPDATE notifications 
      SET read_at = NOW()
      WHERE user_id = ${user.id} 
        AND read_at IS NULL
      RETURNING id
    `;

    const updatedCount = result.length;

    return NextResponse.json({
      success: true,
      message: `Marked ${updatedCount} notifications as read`,
      updatedCount,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      {
        error: "Failed to mark notifications as read",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
