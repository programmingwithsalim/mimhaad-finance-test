import { NextRequest, NextResponse } from "next/server";
import { getDatabaseSession } from "@/lib/database-session-service";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const session = await getDatabaseSession();

    console.log("GET Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userRole: session?.user?.role,
      userId: session?.user?.id,
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin (case-sensitive check)
    if (session.user.role !== "Admin") {
      console.log(
        "GET Access denied for user:",
        session.user.email,
        "Role:",
        session.user.role
      );
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    // Get system configuration from database
    const configResult = await sql`
      SELECT config_key, config_value FROM system_config WHERE category = 'general'
    `;

    // Convert key-value pairs to object
    const config: any = {};
    for (const row of configResult) {
      try {
        config[row.config_key] = JSON.parse(row.config_value);
      } catch {
        config[row.config_key] = row.config_value;
      }
    }

    if (Object.keys(config).length === 0) {
      // Return default configuration if none exists
      const defaultConfig = {
        systemName: "Mimhaad Financial Services",
        systemVersion: "1.0.0",
        maintenanceMode: false,
        debugMode: false,
        sessionTimeout: 30,
        maxLoginAttempts: 5,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
        },
        backupSettings: {
          autoBackup: true,
          backupFrequency: "daily",
          retentionDays: 30,
          backupLocation: "",
        },
        securitySettings: {
          enableTwoFactor: false,
          requireTwoFactorForAdmins: true,
          enableAuditLogs: true,
          enableIpWhitelist: false,
          allowedIps: "",
        },
      };

      return NextResponse.json({
        success: true,
        data: defaultConfig,
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error fetching system config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch system configuration" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getDatabaseSession();

    console.log("Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userRole: session?.user?.role,
      userId: session?.user?.id,
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin (case-sensitive check)
    if (session.user.role !== "Admin") {
      console.log(
        "Access denied for user:",
        session.user.email,
        "Role:",
        session.user.role
      );
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();

    console.log("Received system config update:", {
      hasSystemName: !!body.systemName,
      hasPasswordPolicy: !!body.passwordPolicy,
      hasBackupSettings: !!body.backupSettings,
      hasSecuritySettings: !!body.securitySettings,
      bodyKeys: Object.keys(body),
    });

    // Validate required fields
    if (!body.systemName) {
      return NextResponse.json(
        { success: false, error: "System name is required" },
        { status: 400 }
      );
    }

    // Convert the body object to key-value pairs and insert/update
    const configEntries = [
      { key: "systemName", value: body.systemName },
      { key: "systemVersion", value: body.systemVersion },
      { key: "maintenanceMode", value: JSON.stringify(body.maintenanceMode) },
      { key: "debugMode", value: JSON.stringify(body.debugMode) },
      { key: "sessionTimeout", value: JSON.stringify(body.sessionTimeout) },
      { key: "maxLoginAttempts", value: JSON.stringify(body.maxLoginAttempts) },
      { key: "passwordPolicy", value: JSON.stringify(body.passwordPolicy) },
      { key: "backupSettings", value: JSON.stringify(body.backupSettings) },
      { key: "securitySettings", value: JSON.stringify(body.securitySettings) },
    ];

    // Insert or update each configuration entry
    for (const entry of configEntries) {
      await sql`
        INSERT INTO system_config (config_key, config_value, category, updated_at)
        VALUES (${entry.key}, ${entry.value}, 'general', NOW())
        ON CONFLICT (config_key) 
        DO UPDATE SET 
          config_value = EXCLUDED.config_value,
          updated_at = NOW()
      `;
    }

    return NextResponse.json({
      success: true,
      data: body,
      message: "System configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating system config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update system configuration" },
      { status: 500 }
    );
  }
}
