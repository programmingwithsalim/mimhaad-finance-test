import { NextResponse } from "next/server";
import { resetUserPassword, getUserById } from "@/lib/user-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sendEmail = false } = body;

    // Always reset to "Password123!"
    const newPassword = "Password123!";

    // Reset the password
    const result = await resetUserPassword(id, newPassword);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to reset password" },
        { status: 500 }
      );
    }

    // Get user details for email notification
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Send email notification if requested
    if (sendEmail && user.email) {
      try {
        const { EmailService } = await import("@/lib/email-service");
        await EmailService.sendEmail({
          to: user.email,
          subject: "Password Reset - Mimhaad Financial Services",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Password Reset Successful</h2>
              <p>Hello ${user.firstName} ${user.lastName},</p>
              <p>Your password has been reset by an administrator.</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>New Password:</strong> <code style="background-color: #fff; padding: 5px 10px; border-radius: 3px;">Password123!</code></p>
              </div>
              <p><strong>Important:</strong> Please change your password immediately after logging in for security reasons.</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                If you did not request this password reset, please contact your system administrator immediately.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #9ca3af; font-size: 12px;">
                This is an automated message from Mimhaad Financial Services ERP. Please do not reply to this email.
              </p>
            </div>
          `,
        });
        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't fail the request if email fails - password was still reset
      }
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
      password: result.password,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      {
        error: "Failed to reset password",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
