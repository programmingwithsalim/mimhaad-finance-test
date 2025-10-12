import { NextRequest, NextResponse } from "next/server";
import { getDatabaseSession } from "@/lib/database-session-service";
import { sql } from "@/lib/db";
import fs from "fs";
import path from "path";

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

    // Clear cache
    const cacheResult = await clearSystemCache();

    return NextResponse.json({
      success: true,
      data: cacheResult,
      message: "System cache cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}

async function clearSystemCache() {
  try {
    const cacheResults = {
      tempFiles: 0,
      logFiles: 0,
      sessionData: 0,
      totalSize: 0,
    };

    // Clear temp files
    const tempDir = path.join(process.cwd(), ".next", "cache");
    if (fs.existsSync(tempDir)) {
      const tempFiles = await clearDirectory(tempDir);
      cacheResults.tempFiles = tempFiles.count;
      cacheResults.totalSize += tempFiles.size;
    }

    // Clear log files (if any)
    const logDir = path.join(process.cwd(), "logs");
    if (fs.existsSync(logDir)) {
      const logFiles = await clearDirectory(logDir);
      cacheResults.logFiles = logFiles.count;
      cacheResults.totalSize += logFiles.size;
    }

    // Clear session data from database (optional)
    try {
      await sql`
        DELETE FROM sessions WHERE expires < NOW()
      `;
      cacheResults.sessionData = 1;
    } catch (error) {
      console.error("Failed to clear session data:", error);
    }

    return {
      ...cacheResults,
      totalSizeFormatted: formatBytes(cacheResults.totalSize),
      clearedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error clearing cache:", error);
    throw error;
  }
}

async function clearDirectory(dirPath: string) {
  let count = 0;
  let totalSize = 0;

  try {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        const subResult = await clearDirectory(filePath);
        count += subResult.count;
        totalSize += subResult.size;

        // Remove empty directory
        try {
          fs.rmdirSync(filePath);
        } catch (error) {
          // Directory not empty, skip
        }
      } else {
        try {
          fs.unlinkSync(filePath);
          count++;
          totalSize += stats.size;
        } catch (error) {
          console.error(`Failed to delete file ${filePath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to clear directory ${dirPath}:`, error);
  }

  return { count, size: totalSize };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
