import { NextResponse } from "next/server";
import {
  getDatabaseSession,
  updateSessionActivity,
} from "@/lib/database-session-service";

// GET - Check current session
export async function GET() {
  try {
    const session = await getDatabaseSession();

    if (!session || !session.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Update session activity
    await updateSessionActivity(session.sessionToken);

    return NextResponse.json({
      user: session.user,
      expires: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Session check failed" },
      { status: 500 }
    );
  }
}

// POST - Refresh session (update activity timestamp)
export async function POST() {
  try {
    const session = await getDatabaseSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Session refresh failed" },
        { status: 401 }
      );
    }

    // Update session activity
    await updateSessionActivity(session.sessionToken);

    return NextResponse.json({
      user: session.user,
      expires: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Session refresh error:", error);
    return NextResponse.json(
      { error: "Session refresh failed" },
      { status: 500 }
    );
  }
}
