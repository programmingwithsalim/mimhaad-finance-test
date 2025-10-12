import { type NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/user-service";
import { createDatabaseSession } from "@/lib/database-session-service";
import { NotificationService } from "@/lib/services/notification-service";
import { TwoFactorAuthService } from "@/lib/services/two-factor-auth-service";
import { sql } from "@/lib/db";

/**
 * Complete login after 2FA verification
 * This endpoint is called after the user has verified their 2FA code
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, verified2FA, trustDevice } = await request.json();

    if (!userId || !verified2FA) {
      return NextResponse.json(
        { error: "User ID and 2FA verification required" },
        { status: 400 }
      );
    }

    // Get user details
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Ensure notifications table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255),
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          priority VARCHAR(20) DEFAULT 'medium',
          status VARCHAR(20) DEFAULT 'unread',
          read_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } catch (tableError) {
      console.error("Error creating notifications table:", tableError);
    }

    // Add trusted device if requested
    if (trustDevice) {
      const userAgent = request.headers.get("user-agent") || "Unknown";
      const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        "Unknown";

      const deviceId = TwoFactorAuthService.generateDeviceId(
        userAgent,
        ipAddress
      );

      await TwoFactorAuthService.addTrustedDevice(
        userId,
        deviceId,
        userAgent.substring(0, 50),
        ipAddress,
        userAgent
      );

      console.log(`✅ [2FA] Device added to trusted list for user ${userId}`);
    }

    // Create database session
    const session = await createDatabaseSession(user, request);

    console.log("✅ Database session created after 2FA verification");

    // Send login notification
    try {
      const userAgent = request.headers.get("user-agent") || "Unknown";
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const ipAddress = forwardedFor?.split(",")[0] || realIp || "Unknown";

      await NotificationService.sendLoginAlert(user.id, {
        ipAddress,
        userAgent,
        location: "Ghana",
        branchId: user.branchId,
      });
    } catch (notificationError) {
      console.error("Failed to send login notification:", notificationError);
    }

    // Create response with user data
    const response = NextResponse.json({
      user,
      expires: session.expiresAt.toISOString(),
    });

    // Set the session cookie
    response.cookies.set("session_token", session.sessionToken, {
      expires: session.expiresAt,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    console.log("✅ Login completed successfully after 2FA");

    return response;
  } catch (error) {
    console.error("Error completing login after 2FA:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

