import { NextResponse, NextRequest } from "next/server";
import { NotificationService } from "@/lib/services/notification-service";
import { getCurrentUser } from "@/lib/auth-utils";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser(request);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { config, testPhone } = body;

    // Validate that a test phone number is provided
    if (!testPhone) {
      return NextResponse.json(
        {
          success: false,
          error: "Test phone number is required",
        },
        { status: 400 }
      );
    }

    // Use provided config or fall back to system settings
    let prefs;
    if (config) {
      // Use the provided config for testing
      prefs = {
        email_enabled: false,
        sms_enabled: true,
        push_enabled: false,
        login_alerts: false,
        transaction_alerts: false,
        low_balance_alerts: false,
        high_value_transaction_threshold: 1000,
        low_balance_threshold: 100,
        sms_provider: config.smsProvider || "hubtel",
        phone_number: testPhone,
        sms_api_key: config.smsApiKey,
        sms_api_secret: config.smsApiSecret,
        sms_sender_id: config.smsSenderId,
      };
    } else {
      // Get system SMS configuration
      const systemConfig = await sql`
        SELECT config_key, config_value
        FROM system_config
        WHERE config_key IN (
          'sms_provider',
          'hubtel_sms_client_id',
          'hubtel_sms_client_secret', 
          'hubtel_sms_sender_id',
          'smsonlinegh_sms_api_key',
          'smsonlinegh_sms_api_secret',
          'smsonlinegh_sms_sender_id'
        )
      `;

      // Convert system config to object
      const systemConfigObj = systemConfig.reduce((acc: any, config: any) => {
        acc[config.config_key] = config.config_value;
        return acc;
      }, {});

      prefs = {
        email_enabled: false,
        sms_enabled: true,
        push_enabled: false,
        login_alerts: false,
        transaction_alerts: false,
        low_balance_alerts: false,
        high_value_transaction_threshold: 1000,
        low_balance_threshold: 100,
        sms_provider: systemConfigObj.sms_provider || "hubtel",
        phone_number: testPhone,
        sms_api_key:
          systemConfigObj.hubtel_sms_client_id ||
          systemConfigObj.smsonlinegh_sms_api_key,
        sms_api_secret:
          systemConfigObj.hubtel_sms_client_secret ||
          systemConfigObj.smsonlinegh_sms_api_secret,
        sms_sender_id:
          systemConfigObj.hubtel_sms_sender_id ||
          systemConfigObj.smsonlinegh_sms_sender_id,
      };
    }

    console.log("🔍 [TEST-SMS] Sending test SMS to:", testPhone);
    console.log("🔍 [TEST-SMS] Using provider:", prefs.sms_provider);
    console.log("🔍 [TEST-SMS] Configuration:", {
      provider: prefs.sms_provider,
      apiKey: prefs.sms_api_key ? "***" : "MISSING",
      apiSecret: prefs.sms_api_secret ? "***" : "MISSING",
      senderId: prefs.sms_sender_id,
      originalPhone: testPhone,
      formattedPhone: testPhone.replace(/^\+/, ""), // Remove + prefix for API
      messageLength: 92,
    });

    // Test with a different sender ID if the current one doesn't work
    const testConfig = {
      ...prefs,
      sms_sender_id: "MIMHAAD", // Try a shorter sender ID
    };

    console.log(
      "🔍 [TEST-SMS] Testing with sender ID:",
      testConfig.sms_sender_id
    );

    // First try with the original configuration
    let result = await NotificationService["sendSMSNotification"](
      {
        type: "system_alert",
        title: "Test SMS Notification",
        message:
          "This is a test SMS to verify your SMS notification settings from Mimhaad Financial Services.",
        userId: session.id,
        priority: "low",
      },
      testConfig
    );

    // If the first attempt fails, try with a different phone format
    if (!result.success) {
      console.log(
        "🔍 [TEST-SMS] First attempt failed, trying alternative format..."
      );

      const alternativeConfig = {
        ...testConfig,
        phone_number: testPhone.replace(/^\+233/, "0"), // Try local format
      };

      result = await NotificationService["sendSMSNotification"](
        {
          type: "system_alert",
          title: "Test SMS Notification",
          message:
            "This is a test SMS to verify your SMS notification settings from Mimhaad Financial Services.",
          userId: session.id,
          priority: "low",
        },
        alternativeConfig
      );
    }

    console.log("🔍 [TEST-SMS] Result:", result);

    // If successful, log the message ID for delivery tracking
    if (result.success && (result as any).messageId) {
      console.log(
        "🔍 [TEST-SMS] Message ID for delivery tracking:",
        (result as any).messageId
      );
    }

    return NextResponse.json({
      success: result.success,
      message: result.success ? `Test SMS sent to ${testPhone}` : result.error,
      result,
      messageId: (result as any).messageId || null,
    });
  } catch (error) {
    console.error("🔍 [TEST-SMS] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send test SMS" },
      { status: 500 }
    );
  }
}
