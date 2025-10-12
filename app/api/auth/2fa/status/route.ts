import { NextRequest, NextResponse } from "next/server";
import { TwoFactorAuthService } from "@/lib/services/two-factor-auth-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const settings = await TwoFactorAuthService.get2FASettings(user.id);
    const trustedDevices = await TwoFactorAuthService.getTrustedDevices(
      user.id
    );

    return NextResponse.json({
      success: true,
      enabled: settings?.enabled || false,
      method: settings?.method || "sms",
      phoneNumber: settings?.phoneNumber,
      email: settings?.email,
      backupCodesCount: settings?.backupCodes?.length || 0,
      trustedDevicesCount: trustedDevices.length,
      trustedDevices,
    });
  } catch (error) {
    console.error("❌ [2FA] Error getting status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get 2FA status" },
      { status: 500 }
    );
  }
}
