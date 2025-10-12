import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Check if sync logs table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gl_sync_logs'
      ) as table_exists
    `

    if (!tableExists[0]?.table_exists) {
      // Return default status if table doesn't exist
      return NextResponse.json({
        success: true,
        status: [
          {
            module: "momo",
            lastSyncTime: new Date().toISOString(),
            recordsProcessed: 0,
            recordsSucceeded: 0,
            recordsFailed: 0,
            status: "pending",
            error: "Sync logs table not initialized",
          },
          {
            module: "agency-banking",
            lastSyncTime: new Date().toISOString(),
            recordsProcessed: 0,
            recordsSucceeded: 0,
            recordsFailed: 0,
            status: "pending",
            error: "Sync logs table not initialized",
          },
          {
            module: "e-zwich",
            lastSyncTime: new Date().toISOString(),
            recordsProcessed: 0,
            recordsSucceeded: 0,
            recordsFailed: 0,
            status: "pending",
            error: "Sync logs table not initialized",
          },
        ],
      })
    }

    // Get the latest sync logs for each module
    const logs = await sql`
      SELECT 
        module,
        operation,
        sync_status as status,
        details,
        affected_records,
        error_message as error,
        created_at as timestamp
      FROM gl_sync_logs 
      ORDER BY created_at DESC
      LIMIT 100
    `

    // Group logs by module and get the latest for each
    const moduleMap = new Map()

    for (const log of logs) {
      if (!moduleMap.has(log.module) || new Date(log.timestamp) > new Date(moduleMap.get(log.module).timestamp)) {
        moduleMap.set(log.module, log)
      }
    }

    // Convert to array with proper format
    const status = Array.from(moduleMap.values()).map((log: any) => ({
      module: log.module,
      lastSyncTime: log.timestamp,
      recordsProcessed: log.affected_records || 0,
      recordsSucceeded: log.status === "success" ? log.affected_records || 0 : 0,
      recordsFailed: log.status === "failed" ? log.affected_records || 0 : 0,
      status: log.status || "pending",
      error: log.error,
    }))

    // Ensure we have entries for all modules
    const requiredModules = ["momo", "agency-banking", "e-zwich", "power", "jumia"]
    for (const module of requiredModules) {
      if (!status.find((s) => s.module === module)) {
        status.push({
          module,
          lastSyncTime: new Date().toISOString(),
          recordsProcessed: 0,
          recordsSucceeded: 0,
          recordsFailed: 0,
          status: "pending",
          error: "No sync performed yet",
        })
      }
    }

    return NextResponse.json({
      success: true,
      status,
    })
  } catch (error) {
    console.error("Error getting GL sync status:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get GL sync status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
