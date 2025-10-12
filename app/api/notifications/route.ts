import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const notifications = await sql`
      SELECT 
        id, 
        type, 
        title, 
        message,
        status,
        read_at,
        COALESCE(created_at, NOW()) as created_at
      FROM notifications
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Process notifications to add is_read field based on read_at
    const processedNotifications = notifications.map((notification) => ({
      ...notification,
      is_read: notification.read_at !== null,
      created_at: notification.created_at
        ? new Date(notification.created_at).toISOString()
        : new Date().toISOString(),
      read_at: notification.read_at
        ? new Date(notification.read_at).toISOString()
        : null,
    }));

    return NextResponse.json({ notifications: processedNotifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch notifications",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
