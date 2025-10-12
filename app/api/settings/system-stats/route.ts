import { NextRequest, NextResponse } from "next/server";
import { getDatabaseSession } from "@/lib/database-session-service";
import { sql } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
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

    // Get system statistics
    const stats = await getSystemStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching system stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch system statistics" },
      { status: 500 }
    );
  }
}

async function getSystemStats() {
  try {
    // Get database size
    const dbSizeResult = await sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
    `;
    const databaseSize = dbSizeResult[0]?.database_size || "Unknown";

    // Get table counts
    const tableCounts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM audit_logs) as audit_log_count,
        (SELECT COUNT(*) FROM branches) as branch_count
    `;

    // Get system information
    const systemInfo = {
      version: process.env.npm_package_version || "1.0.0",
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
      databaseType: "PostgreSQL (Neon)",
      uptime: formatUptime(process.uptime()),
      memoryUsage: formatBytes(process.memoryUsage().heapUsed),
      cpuUsage: "N/A", // Would need additional monitoring for CPU
      lastBackup: await getLastBackupDate(),
      cacheSize: "N/A", // Would need cache implementation
    };

    return {
      ...systemInfo,
      ...tableCounts[0],
      databaseSize,
    };
  } catch (error) {
    console.error("Error getting system stats:", error);
    return {
      version: process.env.npm_package_version || "1.0.0",
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
      databaseType: "PostgreSQL (Neon)",
      uptime: formatUptime(process.uptime()),
      memoryUsage: formatBytes(process.memoryUsage().heapUsed),
      cpuUsage: "N/A",
      lastBackup: "Unknown",
      cacheSize: "N/A",
      user_count: 0,
      audit_log_count: 0,
      branch_count: 0,
      databaseSize: "Unknown",
    };
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function getLastBackupDate(): Promise<string> {
  try {
    // Check if backup table exists and get last backup date
    const backupResult = await sql`
      SELECT MAX(created_at) as last_backup 
      FROM system_backups 
      WHERE status = 'completed'
    `;

    if (backupResult[0]?.last_backup) {
      return new Date(backupResult[0].last_backup).toLocaleDateString();
    }

    return "Never";
  } catch (error) {
    console.log("system_backups table not found");
    return "Never";
  }
}
