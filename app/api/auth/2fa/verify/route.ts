import { NextRequest, NextResponse } from "next/server";
import { TwoFactorAuthService } from "@/lib/services/two-factor-auth-service";

export async function POST(request: NextRequest) {
  try {
    const { userId, code, isBackupCode, trustDevice } = await request.json();

    if (!userId || !code) {
      return NextResponse.json(
        { success: false, error: "User ID and code are required" },
        { status: 400 }
      );
    }

    // Verify code
    const result = isBackupCode
      ? await TwoFactorAuthService.verifyBackupCode(userId, code)
      : await TwoFactorAuthService.verifyOTP(userId, code);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
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
        `${userAgent.substring(0, 50)}...`,
        ipAddress,
        userAgent
      );
    }

    return NextResponse.json({
      success: true,
      message: "2FA verification successful",
    });
  } catch (error) {
    console.error("❌ [2FA] Error verifying code:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
