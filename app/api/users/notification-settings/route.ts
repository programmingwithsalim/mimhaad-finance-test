import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getDatabaseSession } from "@/lib/database-session-service";
import { logger, LogCategory } from "@/lib/logger";

export async function GET() {
  try {
    // Get user from database session
    const session = await getDatabaseSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    await logger.info(LogCategory.API, "Fetching notification settings", {
      userId,
    });

    // Get user's notification settings
    const settings = await sql`
      SELECT * FROM user_notification_settings 
      WHERE user_id = ${userId}
    `;

    if (settings.length === 0) {
      await logger.info(
        LogCategory.API,
        "No notification settings found, returning defaults",
        { userId }
      );
      // Return default settings if none exist
      return NextResponse.json({
        success: true,
        data: {
          emailNotifications: true,
          emailAddress: "",
          smsNotifications: false,
          phoneNumber: "",
          pushNotifications: true,
          transactionAlerts: true,
          floatThresholdAlerts: true,
          systemUpdates: true,
          securityAlerts: true,
          dailyReports: false,
          weeklyReports: false,
          loginAlerts: true,
          marketingEmails: false,
          quietHoursEnabled: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          alertFrequency: "immediate",
          reportFrequency: "weekly",
        },
      });
    }

    // Transform database fields to expected format
    const userSettings = settings[0];
    await logger.info(
      LogCategory.API,
      "Notification settings fetched successfully",
      { userId }
    );

    return NextResponse.json({
      success: true,
      data: {
        emailNotifications: userSettings.email_notifications || true,
        emailAddress: userSettings.email_address || "",
        smsNotifications: userSettings.sms_notifications || false,
        phoneNumber: userSettings.phone_number || "",
        pushNotifications: userSettings.push_notifications || true,
        transactionAlerts: userSettings.transaction_alerts || true,
        floatThresholdAlerts: userSettings.float_threshold_alerts || true,
        systemUpdates: userSettings.system_updates || true,
        securityAlerts: userSettings.security_alerts || true,
        dailyReports: userSettings.daily_reports || false,
        weeklyReports: userSettings.weekly_reports || false,
        loginAlerts: userSettings.login_alerts || true,
        marketingEmails: userSettings.marketing_emails || false,
        quietHoursEnabled: userSettings.quiet_hours_enabled || false,
        quietHoursStart: userSettings.quiet_hours_start || "22:00",
        quietHoursEnd: userSettings.quiet_hours_end || "08:00",
        alertFrequency: userSettings.alert_frequency || "immediate",
        reportFrequency: userSettings.report_frequency || "weekly",
      },
    });
  } catch (error) {
    await logger.error(
      LogCategory.API,
      "Error fetching notification settings",
      error as Error
    );
    console.error("Error fetching notification settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch notification settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // Get user from database session
    const session = await getDatabaseSession();

    if (!session || !session.user) {
      console.error("No session or user found in notification settings PUT");
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const data = await request.json();

    console.log("[NOTIFICATION-SETTINGS] Updating settings for user:", userId);
    console.log("[NOTIFICATION-SETTINGS] Request data:", data);

    await logger.info(LogCategory.API, "Updating notification settings", {
      userId,
      settings: {
        emailNotifications: data.emailNotifications,
        smsNotifications: data.smsNotifications,
        pushNotifications: data.pushNotifications,
      },
    });

    // Upsert notification settings
    const result = await sql`
      INSERT INTO user_notification_settings (
        user_id,
        email_notifications,
        email_address,
        sms_notifications,
        phone_number,
        push_notifications,
        transaction_alerts,
        float_threshold_alerts,
        system_updates,
        security_alerts,
        daily_reports,
        weekly_reports,
        login_alerts,
        marketing_emails,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        alert_frequency,
        report_frequency,
        updated_at
      ) VALUES (
        ${userId},
        ${data.emailNotifications},
        ${data.emailAddress || ""},
        ${data.smsNotifications},
        ${data.phoneNumber || ""},
        ${data.pushNotifications},
        ${data.transactionAlerts},
        ${data.floatThresholdAlerts},
        ${data.systemUpdates},
        ${data.securityAlerts},
        ${data.dailyReports},
        ${data.weeklyReports},
        ${data.loginAlerts},
        ${data.marketingEmails},
        ${data.quietHoursEnabled},
        ${data.quietHoursStart || "22:00"},
        ${data.quietHoursEnd || "08:00"},
        ${data.alertFrequency || "immediate"},
        ${data.reportFrequency || "weekly"},
        NOW()
      )
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        email_notifications = EXCLUDED.email_notifications,
        email_address = EXCLUDED.email_address,
        sms_notifications = EXCLUDED.sms_notifications,
        phone_number = EXCLUDED.phone_number,
        push_notifications = EXCLUDED.push_notifications,
        transaction_alerts = EXCLUDED.transaction_alerts,
        float_threshold_alerts = EXCLUDED.float_threshold_alerts,
        system_updates = EXCLUDED.system_updates,
        security_alerts = EXCLUDED.security_alerts,
        daily_reports = EXCLUDED.daily_reports,
        weekly_reports = EXCLUDED.weekly_reports,
        login_alerts = EXCLUDED.login_alerts,
        marketing_emails = EXCLUDED.marketing_emails,
        quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        alert_frequency = EXCLUDED.alert_frequency,
        report_frequency = EXCLUDED.report_frequency,
        updated_at = EXCLUDED.updated_at
    `;

    console.log(
      "[NOTIFICATION-SETTINGS] Settings updated successfully for user:",
      userId
    );
    await logger.info(
      LogCategory.API,
      "Notification settings updated successfully",
      { userId }
    );

    return NextResponse.json({
      success: true,
      message: "Notification settings updated successfully",
    });
  } catch (error) {
    console.error("[NOTIFICATION-SETTINGS] Error updating settings:", error);
    await logger.error(
      LogCategory.API,
      "Error updating notification settings",
      error as Error
    );
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update notification settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
