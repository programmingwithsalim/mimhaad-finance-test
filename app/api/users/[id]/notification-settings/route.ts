import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: userId } = await params

    // Get user notification settings
    const settings = await sql`
      SELECT * FROM user_notification_settings 
      WHERE user_id = ${userId}
    `

    if (settings.length === 0) {
      // Create default settings for user
      await sql`
        INSERT INTO user_notification_settings (
          user_id, email_notifications, sms_notifications, push_notifications,
          transaction_alerts, float_threshold_alerts, system_updates, security_alerts,
          daily_reports, weekly_reports, login_alerts, marketing_emails,
          quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
          alert_frequency, report_frequency
        ) VALUES (
          ${userId}, true, false, true,
          true, true, true, true,
          false, false, true, false,
          false, '22:00', '08:00',
          'immediate', 'weekly'
        )
      `

      // Fetch the newly created settings
      const newSettings = await sql`
        SELECT * FROM user_notification_settings 
        WHERE user_id = ${userId}
      `

      // Convert snake_case to camelCase
      const formattedSettings = {
        emailNotifications: newSettings[0].email_notifications,
        emailAddress: newSettings[0].email_address,
        smsNotifications: newSettings[0].sms_notifications,
        phoneNumber: newSettings[0].phone_number,
        pushNotifications: newSettings[0].push_notifications,
        transactionAlerts: newSettings[0].transaction_alerts,
        floatThresholdAlerts: newSettings[0].float_threshold_alerts,
        systemUpdates: newSettings[0].system_updates,
        securityAlerts: newSettings[0].security_alerts,
        dailyReports: newSettings[0].daily_reports,
        weeklyReports: newSettings[0].weekly_reports,
        loginAlerts: newSettings[0].login_alerts,
        marketingEmails: newSettings[0].marketing_emails,
        quietHoursEnabled: newSettings[0].quiet_hours_enabled,
        quietHoursStart: newSettings[0].quiet_hours_start,
        quietHoursEnd: newSettings[0].quiet_hours_end,
        alertFrequency: newSettings[0].alert_frequency,
        reportFrequency: newSettings[0].report_frequency,
      }

      return NextResponse.json({
        success: true,
        data: formattedSettings,
      })
    }

    // Convert snake_case to camelCase for existing settings
    const formattedSettings = {
      emailNotifications: settings[0].email_notifications,
      emailAddress: settings[0].email_address,
      smsNotifications: settings[0].sms_notifications,
      phoneNumber: settings[0].phone_number,
      pushNotifications: settings[0].push_notifications,
      transactionAlerts: settings[0].transaction_alerts,
      floatThresholdAlerts: settings[0].float_threshold_alerts,
      systemUpdates: settings[0].system_updates,
      securityAlerts: settings[0].security_alerts,
      dailyReports: settings[0].daily_reports,
      weeklyReports: settings[0].weekly_reports,
      loginAlerts: settings[0].login_alerts,
      marketingEmails: settings[0].marketing_emails,
      quietHoursEnabled: settings[0].quiet_hours_enabled,
      quietHoursStart: settings[0].quiet_hours_start,
      quietHoursEnd: settings[0].quiet_hours_end,
      alertFrequency: settings[0].alert_frequency,
      reportFrequency: settings[0].report_frequency,
    }

    return NextResponse.json({
      success: true,
      data: formattedSettings,
    })
  } catch (error) {
    console.error("Error fetching notification settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch notification settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: userId } = await params
    const data = await request.json()

    // Update user notification settings
    await sql`
      INSERT INTO user_notification_settings (
        user_id, email_notifications, email_address, sms_notifications, phone_number,
        push_notifications, transaction_alerts, float_threshold_alerts, system_updates,
        security_alerts, daily_reports, weekly_reports, login_alerts, marketing_emails,
        quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
        alert_frequency, report_frequency, updated_at
      ) VALUES (
        ${userId}, 
        ${data.emailNotifications || false}, 
        ${data.emailAddress || null},
        ${data.smsNotifications || false}, 
        ${data.phoneNumber || null},
        ${data.pushNotifications || false}, 
        ${data.transactionAlerts || false}, 
        ${data.floatThresholdAlerts || false}, 
        ${data.systemUpdates || false},
        ${data.securityAlerts || false}, 
        ${data.dailyReports || false}, 
        ${data.weeklyReports || false}, 
        ${data.loginAlerts || false}, 
        ${data.marketingEmails || false},
        ${data.quietHoursEnabled || false}, 
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
    `

    return NextResponse.json({
      success: true,
      message: "Notification settings updated successfully",
    })
  } catch (error) {
    console.error("Error updating notification settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update notification settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
