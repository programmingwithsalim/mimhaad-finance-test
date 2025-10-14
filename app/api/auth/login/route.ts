import { type NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth-service";
import { createDatabaseSession } from "@/lib/database-session-service";
import { NotificationService } from "@/lib/services/notification-service";
import { TwoFactorAuthService } from "@/lib/services/two-factor-auth-service";
import { sql } from "@/lib/db";

// Rate limiting for brute force protection
const loginAttempts = new Map<
  string,
  { count: number; firstAttempt: number; lockedUntil?: number }
>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes window

function checkRateLimit(email: string): {
  allowed: boolean;
  remainingAttempts?: number;
  lockedUntil?: Date;
} {
  const now = Date.now();
  const attempt = loginAttempts.get(email);

  if (!attempt) {
    // First attempt
    loginAttempts.set(email, { count: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  // Check if still locked out
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    return { allowed: false, lockedUntil: new Date(attempt.lockedUntil) };
  }

  // Check if attempt window has expired
  if (now - attempt.firstAttempt > ATTEMPT_WINDOW) {
    // Reset attempts
    loginAttempts.set(email, { count: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  // Check if exceeded max attempts
  if (attempt.count >= MAX_ATTEMPTS) {
    // Lock out the user
    const lockedUntil = now + LOCKOUT_DURATION;
    loginAttempts.set(email, { ...attempt, lockedUntil });
    return { allowed: false, lockedUntil: new Date(lockedUntil) };
  }

  // Increment attempt count
  attempt.count += 1;
  loginAttempts.set(email, attempt);
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempt.count };
}

function resetRateLimit(email: string) {
  loginAttempts.delete(email);
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    console.log("Login attempt for:", email);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check rate limiting
    const rateLimit = checkRateLimit(email);
    if (!rateLimit.allowed) {
      const minutesRemaining = rateLimit.lockedUntil
        ? Math.ceil((rateLimit.lockedUntil.getTime() - Date.now()) / 60000)
        : 15;

      console.log(`Login blocked for ${email} - too many attempts`);

      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          lockedUntil: rateLimit.lockedUntil,
          minutesRemaining,
        },
        { status: 429 } // Too Many Requests
      );
    }

    // Ensure notifications table exists before attempting to send notifications
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

    const user = await authenticate(email, password);

    if (!user) {
      console.log("Authentication failed for:", email);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("Authentication successful for:", email);

    // Reset rate limiting on successful login
    resetRateLimit(email);

    // Check if 2FA is required
    const userAgent = request.headers.get("user-agent") || "Unknown";
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "Unknown";

    const deviceId = TwoFactorAuthService.generateDeviceId(
      userAgent,
      ipAddress
    );
    const requires2FA = await TwoFactorAuthService.is2FARequired(
      user.id,
      deviceId
    );

    if (requires2FA) {
      console.log(`[2FA] 2FA required for user ${email}`);

      // Send OTP
      const otpResult = await TwoFactorAuthService.sendOTP(
        user.id,
        ipAddress,
        userAgent
      );

      if (!otpResult.success) {
        console.error("[2FA] Failed to send OTP:", otpResult.error);
        // Continue with login but warn user
      }

      return NextResponse.json({
        requires2FA: true,
        userId: user.id,
        userEmail: user.email,
        otpSent: otpResult.success,
        expiresAt: otpResult.expiresAt,
        message: "Please enter the verification code sent to your device",
      });
    }

    // Create database session (without setting cookie)
    const session = await createDatabaseSession(user, request);

    console.log("Database session created successfully");

    // Send login notification
    try {
      const userAgent = request.headers.get("user-agent") || "Unknown";
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const ipAddress = forwardedFor?.split(",")[0] || realIp || "Unknown";

      await NotificationService.sendLoginAlert(user.id, {
        ipAddress,
        userAgent,
        location: "Ghana", // You can enhance this with IP geolocation
        branchId: user.branchId,
      });
    } catch (notificationError) {
      console.error("Failed to send login notification:", notificationError);
      // Don't fail the login if notification fails
    }

    // Create response with user data
    const response = NextResponse.json({
      user,
      expires: session.expiresAt.toISOString(),
    });

    // Set the session cookie in the response
    response.cookies.set("session_token", session.sessionToken, {
      expires: session.expiresAt,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    console.log(
      "Login response created with session token:",
      session.sessionToken.substring(0, 10) + "..."
    );
    console.log("Cookie set in response");

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
