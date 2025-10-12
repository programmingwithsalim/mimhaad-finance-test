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

    const { method, phoneNumber, email } = await request.json();

    // Validate method
    if (!["sms", "email"].includes(method)) {
      return NextResponse.json(
        { success: false, error: "Invalid 2FA method. Use 'sms' or 'email'" },
        { status: 400 }
      );
    }

    // Validate contact info
    if (method === "sms" && !phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number required for SMS 2FA" },
        { status: 400 }
      );
    }

    if (method === "email" && !email) {
      return NextResponse.json(
        { success: false, error: "Email required for email 2FA" },
        { status: 400 }
      );
    }

    // Enable 2FA
    const result = await TwoFactorAuthService.enable2FA(
      user.id,
      method,
      phoneNumber,
      email
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "2FA enabled successfully",
      backupCodes: result.backupCodes,
      warning:
        "Save these backup codes in a secure location. You will not be able to see them again.",
    });
  } catch (error) {
    console.error("❌ [2FA] Error enabling 2FA:", error);
    return NextResponse.json(
      { success: false, error: "Failed to enable 2FA" },
      { status: 500 }
    );
  }
}
