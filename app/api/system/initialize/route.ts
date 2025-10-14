import { NextResponse } from "next/server";
import { AuditService } from "@/lib/audit-service";
import { SettingsService } from "@/lib/settings-service";
import { sql } from "@/lib/db";

export async function POST() {
  try {
    // Initialize settings tables
    await SettingsService.initializeTables();

    // Create user_notification_settings table
    await sql`
      CREATE TABLE IF NOT EXISTS user_notification_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_notifications BOOLEAN DEFAULT true,
        email_address VARCHAR(255),
        sms_notifications BOOLEAN DEFAULT false,
        phone_number VARCHAR(20),
        push_notifications BOOLEAN DEFAULT true,
        transaction_alerts BOOLEAN DEFAULT true,
        float_threshold_alerts BOOLEAN DEFAULT true,
        system_updates BOOLEAN DEFAULT true,
        security_alerts BOOLEAN DEFAULT true,
        daily_reports BOOLEAN DEFAULT false,
        weekly_reports BOOLEAN DEFAULT false,
        login_alerts BOOLEAN DEFAULT true,
        marketing_emails BOOLEAN DEFAULT false,
        quiet_hours_enabled BOOLEAN DEFAULT false,
        quiet_hours_start TIME DEFAULT '22:00:00',
        quiet_hours_end TIME DEFAULT '08:00:00',
        alert_frequency VARCHAR(20) DEFAULT 'immediate',
        report_frequency VARCHAR(20) DEFAULT 'weekly',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        sms_provider VARCHAR(50),
        sms_sender_id VARCHAR(50),
        sms_api_key VARCHAR(255),
        sms_api_secret VARCHAR(255),
        UNIQUE(user_id)
      )
    `;

    // Create system_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS system_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        level VARCHAR(20) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
        category VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        entity_id VARCHAR(255),
        entity_type VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_id UUID REFERENCES users(id),
        branch_id UUID REFERENCES branches(id),
        ip_address INET,
        user_agent TEXT
      )
    `;

    // Create indexes for system_logs
    await sql`
      CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_system_logs_entity_id ON system_logs(entity_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id)
    `;

    // Create indexes for user_notification_settings
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id ON user_notification_settings(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_notification_settings_email_notifications ON user_notification_settings(email_notifications)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_notification_settings_sms_notifications ON user_notification_settings(sms_notifications)
    `;

    // Seed default settings and fees
    await SettingsService.seedDefaultSettings();

    // Ensure SMS and Email settings are seeded in system_config
    try {
      const notificationSettings = [
        {
          config_key: "sms_provider",
          config_value: "hubtel",
          config_type: "string",
          description: "Default SMS provider (hubtel, smsonlinegh)",
          category: "notifications",
        },
        {
          config_key: "sms_api_key",
          config_value: "",
          config_type: "string",
          description: "SMS API key for notifications",
          category: "notifications",
        },
        {
          config_key: "sms_api_secret",
          config_value: "",
          config_type: "string",
          description: "SMS API secret for notifications",
          category: "notifications",
        },
        {
          config_key: "sms_sender_id",
          config_value: "MIMHAAD",
          config_type: "string",
          description: "SMS sender ID for notifications",
          category: "notifications",
        },
        {
          config_key: "email_provider",
          config_value: "resend",
          config_type: "string",
          description: "Default email provider (resend, sendgrid)",
          category: "notifications",
        },
        {
          config_key: "email_api_key",
          config_value: "",
          config_type: "string",
          description: "Email API key for notifications",
          category: "notifications",
        },
        {
          config_key: "email_from_address",
          config_value: "noreply@mimhaad.com",
          config_type: "string",
          description: "Default from email address",
          category: "notifications",
        },
      ];

      for (const setting of notificationSettings) {
        await sql`
          INSERT INTO system_config (config_key, config_value, config_type, description, category)
          VALUES (${setting.config_key}, ${setting.config_value}, ${setting.config_type}, 
                  ${setting.description}, ${setting.category})
          ON CONFLICT (config_key) DO NOTHING
        `;
      }
      console.log("Notification settings ensured in system_config");
    } catch (error) {
      console.error("Error ensuring notification settings:", error);
    }

    // Seed GL mappings for float accounts
    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/api/gl/mappings/seed`,
        {
          method: "POST",
        }
      );
      if (response.ok) {
        const result = await response.json();
        console.log("GL mappings seeded:", result.message);
      } else {
        console.log("GL mappings seeding failed or already exists");
      }
    } catch (error) {
      console.log("GL mappings seeding error:", error);
    }

    // Create some sample audit logs
    await AuditService.log({
      userId: "system",
      username: "system",
      actionType: "system_initialization",
      entityType: "system_config",
      description: "System tables initialized and default settings configured",
      severity: "medium",
    });

    // Add sample audit logs
    const sampleLogs = [
      {
        userId: "1",
        username: "admin",
        actionType: "login",
        entityType: "user",
        entityId: "1",
        description: "Administrator logged in successfully",
        details: { ip_address: "192.168.1.100", browser: "Chrome" },
        severity: "low" as const,
        branchId: "1",
        branchName: "Accra Main Branch",
      },
      {
        userId: "2",
        username: "manager1",
        actionType: "transaction_deposit",
        entityType: "transaction",
        entityId: "TXN001",
        description: "Customer deposit transaction processed",
        details: { amount: 1500, currency: "GHS", customer_id: "CUST001" },
        severity: "medium" as const,
        branchId: "1",
        branchName: "Accra Main Branch",
      },
      {
        userId: "3",
        username: "cashier1",
        actionType: "float_addition",
        entityType: "float_account",
        entityId: "FLOAT001",
        description: "Float account replenishment",
        details: { amount: 10000, currency: "GHS", float_type: "MoMo" },
        severity: "high" as const,
        branchId: "2",
        branchName: "Kumasi Branch",
      },
      {
        userId: "unknown",
        username: "hacker123",
        actionType: "failed_login",
        entityType: "user",
        description: "Failed login attempt with invalid credentials",
        details: { ip_address: "203.0.113.45", attempts: 3 },
        severity: "high" as const,
        status: "failure" as const,
        errorMessage: "Invalid username or password",
      },
    ];

    for (const log of sampleLogs) {
      await AuditService.log(log);
    }

    return NextResponse.json({
      success: true,
      message:
        "System initialized successfully with audit logs, settings, and fee configurations",
      data: {
        audit_logs_created: true,
        settings_initialized: true,
        fee_configurations_created: true,
        sample_data_added: true,
        notification_settings_table_created: true,
      },
    });
  } catch (error) {
    console.error("Error initializing system:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize system",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
