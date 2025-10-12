import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all notifications for the current user
    const result = await sql`
      DELETE FROM notifications 
      WHERE user_id = ${user.id}
      RETURNING id
    `;

    const deletedCount = result.length;

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} notifications`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to delete notifications",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
