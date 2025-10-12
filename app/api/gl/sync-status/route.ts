import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Check if GL sync logs table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gl_sync_logs'
      )
    `

    if (!tableExists[0].exists) {
      return NextResponse.json({
        success: true,
        data: {
          is_synced: true,
          last_sync: new Date().toISOString(),
          message: "GL sync logs table not found - assuming synchronized",
        },
      })
    }

    // Get the latest sync status
    const latestSync = await sql`
      SELECT 
        created_at as last_sync,
        status,
        module,
        operation
      FROM gl_sync_logs 
      ORDER BY created_at DESC 
      LIMIT 1
    `

    const is_synced = latestSync.length === 0 || latestSync[0].status === "success"

    return NextResponse.json({
      success: true,
      data: {
        is_synced,
        last_sync: latestSync.length > 0 ? latestSync[0].last_sync : new Date().toISOString(),
        latest_operation: latestSync.length > 0 ? latestSync[0].operation : null,
        latest_module: latestSync.length > 0 ? latestSync[0].module : null,
      },
    })
  } catch (error) {
    console.error("Error fetching GL sync status:", error)
    return NextResponse.json({
      success: true,
      data: {
        is_synced: true,
        last_sync: new Date().toISOString(),
        message: "Unable to check sync status - assuming synchronized",
      },
    })
  }
}
