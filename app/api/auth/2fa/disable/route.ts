import { NextRequest, NextResponse } from "next/server";
import { TwoFactorAuthService } from "@/lib/services/two-factor-auth-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Disable 2FA
    const result = await TwoFactorAuthService.disable2FA(user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "2FA disabled successfully",
    });
  } catch (error) {
    console.error("❌ [2FA] Error disabling 2FA:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disable 2FA" },
      { status: 500 }
    );
  }
}
