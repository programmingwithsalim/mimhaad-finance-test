import { NextRequest, NextResponse } from "next/server";
import { getDatabaseSession } from "@/lib/database-session-service";
import { sql } from "@/lib/db";
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const session = await getDatabaseSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    // Create backup
    const backupResult = await createSystemBackup();

    return NextResponse.json({
      success: true,
      data: backupResult,
      message: "System backup created successfully",
    });
  } catch (error) {
    console.error("Error creating backup:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create backup" },
      { status: 500 }
    );
  }
}

async function createSystemBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupId = `backup_${timestamp}`;

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
      backupType: "full",
      schema: schemaResult,
      data: {},
      metadata: {
        totalTables: 0,
        totalRecords: 0,
        backupSize: 0,
      },
    };

    // List of all tables to backup (based on schema analysis)
    const tablesToBackup = [
      // Core system tables
      "users",
      "branches",
      "system_config",
      "system_settings",
      "system_backups",

      // Transaction tables
      "momo_transactions",
      "agency_banking_transactions",
      "e_zwich_transactions",
      "power_transactions",
      "jumia_transactions",
      "ezwich_transactions",

      // Financial tables
      "gl_accounts",
      "gl_transactions",
      "gl_journal_entries",
      "gl_mappings",
      "float_accounts",
      "float_transactions",
      "commissions",
      "expenses",
      "expense_heads",

      // E-Zwich specific tables
      "e_zwich_card_issuances",
      "e_zwich_withdrawals",
      "e_zwich_partner_accounts",
      "ezwich_card_batches",
      "ezwich_card_issuance",
      "ezwich_cards",

      // Security and audit tables
      "audit_logs",
      "security_events",
      "login_attempts",
      "user_sessions",

      // Configuration tables
      "fee_config",
      "partner_banks",
      "permissions",
      "roles",

      // Notification tables
      "notifications",
      "user_notification_settings",

      // Other tables
      "fixed_assets",
      "jumia_packages",
      "user_branch_assignments",
    ];

    let totalRecords = 0;

    // Backup each table
    for (const tableName of tablesToBackup) {
      try {
        console.log(`Backing up table: ${tableName}`);

        // Get all data from table (no LIMIT - full backup)
        const tableData = await sql`SELECT * FROM ${sql(tableName)}`;

        backupData.data[tableName] = tableData;
        totalRecords += tableData.length;

        console.log(`✓ ${tableName}: ${tableData.length} records`);
      } catch (error) {
        console.log(`⚠ Table ${tableName} not found or error:`, error.message);
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

    // Record backup in database (if table exists)
    try {
      const backupRecord = await sql`
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
          'full',
          'completed',
          ${backupFilePath},
          ${backupData.metadata.backupSize},
          ${JSON.stringify(backupData.metadata)},
          NOW()
        ) RETURNING *
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
    console.error("Error creating backup:", error);
    throw error;
  }
}
