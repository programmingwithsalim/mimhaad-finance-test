import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { EmailService } from "@/lib/email-service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { template, testEmail } = await request.json();

    if (!template || !testEmail) {
      return NextResponse.json(
        { error: "Template and test email are required" },
        { status: 400 }
      );
    }

    let templateData: any = {};

    // Prepare test data based on template
    switch (template) {
      case "welcome":
        templateData = {
          userName: "Test User",
        };
        break;
      case "transactionAlert":
        templateData = {
          userName: "Test User",
          transactionDetails: {
            id: "TXN-123456",
            amount: 1000.0,
            type: "Cash Out",
            date: new Date().toISOString(),
            service: "MoMo",
            message: "Transaction completed successfully",
          },
        };
        break;
      case "lowBalanceAlert":
        templateData = {
          userName: "Test User",
          accountType: "MoMo Float",
          currentBalance: 50.0,
          threshold: 100.0,
        };
        break;
      case "loginAlert":
        templateData = {
          userName: "Test User",
          loginData: {
            ipAddress: "192.168.1.1",
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            location: "Accra, Ghana",
            timestamp: new Date().toISOString(),
          },
        };
        break;
      default:
        templateData = {
          userName: "Test User",
          message: "This is a test notification",
          type: "System",
        };
    }

    // Send test email
    const result = await EmailService.sendEmail(
      testEmail,
      template,
      templateData
    );

    if (result) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        template,
        templateData,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send test email",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
