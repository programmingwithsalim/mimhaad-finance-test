import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    // Get backup settings from system_config
    const backupSettingsResult = await sql`
      SELECT config_value FROM system_config 
      WHERE config_key = 'backupSettings' AND category = 'general'
    `;

    if (backupSettingsResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Backup settings not found",
        },
        { status: 404 }
      );
    }

    const backupSettings = JSON.parse(backupSettingsResult[0].config_value);

    // Check if auto-backup is enabled
    if (!backupSettings.autoBackup) {
      return NextResponse.json({
        success: false,
        message: "Auto-backup is disabled",
      });
    }

    // Check if it's time for backup based on frequency
    const shouldBackup = await checkBackupSchedule(
      backupSettings.backupFrequency
    );

    if (!shouldBackup) {
      return NextResponse.json({
        success: false,
        message: "Not time for backup yet",
      });
    }

    // Create backup
    const backupResult = await createSystemBackup();

    // Clean up old backups based on retention policy
    await cleanupOldBackups(backupSettings.retentionDays);

    return NextResponse.json({
      success: true,
      data: backupResult,
      message: "Auto-backup completed successfully",
    });
  } catch (error) {
    console.error("Error in auto-backup:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create auto-backup" },
      { status: 500 }
    );
  }
}

async function checkBackupSchedule(frequency: string): Promise<boolean> {
  try {
    // Get last backup date
    const lastBackupResult = await sql`
      SELECT created_at FROM system_backups 
      WHERE backup_type = 'auto' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    if (lastBackupResult.length === 0) {
      return true; // No previous backup, should backup
    }

    const lastBackup = new Date(lastBackupResult[0].created_at);
    const now = new Date();
    const hoursSinceLastBackup =
      (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

    switch (frequency) {
      case "daily":
        return hoursSinceLastBackup >= 24;
      case "weekly":
        return hoursSinceLastBackup >= 168; // 7 days
      case "monthly":
        return hoursSinceLastBackup >= 720; // 30 days
      default:
        return hoursSinceLastBackup >= 24; // Default to daily
    }
  } catch (error) {
    console.error("Error checking backup schedule:", error);
    return true; // If error, allow backup
  }
}

async function createSystemBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupId = `auto_backup_${timestamp}`;

    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Get database schema
    const schemaResult = await sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position
    `;

    // Get ALL data from ALL tables (full backup)
    const backupData = {
      backupId,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      backupType: "auto",
      schema: schemaResult,
      data: {},
      metadata: {
        totalTables: 0,
        totalRecords: 0,
        backupSize: 0,
      },
    };

    // List of all tables to backup
    const tablesToBackup = [
      "users",
      "branches",
      "system_config",
      "system_settings",
      "system_backups",
      "momo_transactions",
      "agency_banking_transactions",
      "e_zwich_transactions",
      "power_transactions",
      "jumia_transactions",
      "ezwich_transactions",
      "gl_accounts",
      "gl_transactions",
      "gl_journal_entries",
      "gl_mappings",
      "float_accounts",
      "float_transactions",
      "commissions",
      "expenses",
      "expense_heads",
      "e_zwich_card_issuances",
      "e_zwich_withdrawals",
      "e_zwich_partner_accounts",
      "ezwich_card_batches",
      "ezwich_card_issuance",
      "ezwich_cards",
      "audit_logs",
      "security_events",
      "login_attempts",
      "user_sessions",
      "fee_config",
      "partner_banks",
      "permissions",
      "roles",
      "notifications",
      "user_notification_settings",
      "fixed_assets",
      "jumia_packages",
      "user_branch_assignments",
    ];

    let totalRecords = 0;

    // Backup each table
    for (const tableName of tablesToBackup) {
      try {
        const tableData = await sql`SELECT * FROM ${sql(tableName)}`;
        backupData.data[tableName] = tableData;
        totalRecords += tableData.length;
      } catch (error) {
        console.log(`Table ${tableName} not found, skipping`);
        backupData.data[tableName] = [];
      }
    }

    // Update metadata
    backupData.metadata.totalTables = Object.keys(backupData.data).length;
    backupData.metadata.totalRecords = totalRecords;

    // Save backup to file
    const backupFilePath = path.join(backupDir, `${backupId}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

    // Update backup size
    backupData.metadata.backupSize = fs.statSync(backupFilePath).size;

    // Record backup in database
    try {
      await sql`
        INSERT INTO system_backups (
          backup_id,
          backup_type,
          status,
          file_path,
          size_bytes,
          metadata,
          created_at
        ) VALUES (
          ${backupId},
          'auto',
          'completed',
          ${backupFilePath},
          ${backupData.metadata.backupSize},
          ${JSON.stringify(backupData.metadata)},
          NOW()
        )
      `;
    } catch (error) {
      console.log("system_backups table not found, skipping database record");
    }

    return {
      backupId,
      filePath: backupFilePath,
      size: backupData.metadata.backupSize,
      metadata: backupData.metadata,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error creating auto-backup:", error);
    throw error;
  }
}

async function cleanupOldBackups(retentionDays: number) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Get old backup files to delete
    const oldBackups = await sql`
      SELECT backup_id, file_path FROM system_backups 
      WHERE created_at < ${cutoffDate.toISOString()}
    `;

    for (const backup of oldBackups) {
      try {
        // Delete file
        if (fs.existsSync(backup.file_path)) {
          fs.unlinkSync(backup.file_path);
        }

        // Delete database record
        await sql`
          DELETE FROM system_backups WHERE backup_id = ${backup.backup_id}
        `;

        console.log(`Deleted old backup: ${backup.backup_id}`);
      } catch (error) {
        console.error(`Error deleting backup ${backup.backup_id}:`, error);
      }
    }
  } catch (error) {
    console.error("Error cleaning up old backups:", error);
  }
}
