import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    let whereClause = "";
    let params: any[] = [];
    let paramIndex = 1;
    if (branchId) {
      whereClause = `WHERE branch_id = $${paramIndex}`;
      params.push(branchId);
    }

    // Check if audit_logs table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      )
    `;

    if (!tableExists[0]?.exists) {
      return NextResponse.json({
        success: true,
        data: {
          totalLogs: 0,
          criticalEvents: 0,
          failedActions: 0,
          activeUsers: 0,
          recentActivity: [],
          severityBreakdown: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          },
          actionTypeBreakdown: {},
          dailyActivity: [],
        },
      });
    }

    // Get total logs count
    const totalLogsResult = await sql.unsafe(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params
    );
    const totalLogs = Number.parseInt(totalLogsResult[0]?.total || "0");

    // Get critical events count (critical and high severity)
    const criticalEventsResult = await sql.unsafe(
      `SELECT COUNT(*) as total FROM audit_logs ${
        whereClause ? whereClause + " AND" : "WHERE"
      } severity IN ('critical', 'high')`,
      params
    );
    const criticalEvents = Number.parseInt(
      criticalEventsResult[0]?.total || "0"
    );

    // Get failed actions count
    const failedActionsResult = await sql.unsafe(
      `SELECT COUNT(*) as total FROM audit_logs ${
        whereClause ? whereClause + " AND" : "WHERE"
      } status = 'failure'`,
      params
    );
    const failedActions = Number.parseInt(failedActionsResult[0]?.total || "0");

    // Get active users count (unique users in last 24 hours)
    const activeUsersResult = await sql.unsafe(
      `SELECT COUNT(DISTINCT user_id) as total FROM audit_logs ${
        whereClause ? whereClause + " AND" : "WHERE"
      } created_at >= NOW() - INTERVAL '24 hours'`,
      params
    );
    const activeUsers = Number.parseInt(activeUsersResult[0]?.total || "0");

    // Get recent activity (last 10 logs)
    const recentActivity = await sql.unsafe(
      `SELECT 
        id,
        username,
        action_type as "actionType",
        entity_type as "entityType",
        description,
        severity,
        status,
        created_at as "timestamp"
      FROM audit_logs 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT 10`,
      params
    );

    // Get severity breakdown
    let severityBreakdownResult = await sql.unsafe(
      `SELECT 
        severity,
        COUNT(*) as count
      FROM audit_logs 
      ${whereClause}
      GROUP BY severity`,
      params
    );
    if (!Array.isArray(severityBreakdownResult)) severityBreakdownResult = [];

    const severityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    severityBreakdownResult.forEach((row) => {
      if (row.severity in severityBreakdown) {
        severityBreakdown[row.severity as keyof typeof severityBreakdown] =
          Number.parseInt(row.count);
      }
    });

    // Get action type breakdown
    let actionTypeBreakdownResult = await sql.unsafe(
      `SELECT 
        action_type as "actionType",
        COUNT(*) as count
      FROM audit_logs 
      ${whereClause}
      GROUP BY action_type
      ORDER BY count DESC
      LIMIT 10`,
      params
    );
    if (!Array.isArray(actionTypeBreakdownResult))
      actionTypeBreakdownResult = [];

    const actionTypeBreakdown: Record<string, number> = {};
    actionTypeBreakdownResult.forEach((row) => {
      actionTypeBreakdown[row.actionType] = Number.parseInt(row.count);
    });

    // Get daily activity for the last 7 days
    let dailyActivityResult = await sql.unsafe(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN severity IN ('critical', 'high') THEN 1 END) as critical_count,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failure_count
      FROM audit_logs 
      ${whereClause}
      AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      params
    );
    if (!Array.isArray(dailyActivityResult)) dailyActivityResult = [];

    const dailyActivity = dailyActivityResult.map((row) => ({
      date: row.date,
      total: Number.parseInt(row.count),
      critical: Number.parseInt(row.critical_count),
      failures: Number.parseInt(row.failure_count),
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalLogs,
        criticalEvents,
        failedActions,
        activeUsers,
        recentActivity,
        severityBreakdown,
        actionTypeBreakdown,
        dailyActivity,
      },
    });
  } catch (error) {
    console.error("Error fetching audit log statistics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch audit log statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
