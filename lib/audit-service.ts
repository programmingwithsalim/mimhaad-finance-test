import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface AuditLogData {
  username: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "success" | "failure" | "pending";
  metadata?: Record<string, any>;
  branchId?: string;
}

export interface AuditLogResult {
  success: boolean;
  logId?: string;
  error?: string;
}

export class AuditService {
  static async logAction(
    auditData: AuditLogData,
    request: Request
  ): Promise<AuditLogResult> {
    try {
      const user = await getCurrentUser(request);

      const result = await sql`
        INSERT INTO audit_logs (
          user_id,
          username,
          action_type,
          entity_type,
          entity_id,
          description,
          severity,
          status,
          metadata,
          branch_id,
          created_at,
          updated_at
        )
        VALUES (
          ${user.id},
          ${auditData.username},
          ${auditData.actionType},
          ${auditData.entityType},
          ${auditData.entityId || null},
          ${auditData.description},
          ${auditData.severity},
          ${auditData.status},
          ${auditData.metadata ? JSON.stringify(auditData.metadata) : null},
          ${auditData.branchId || user.branchId},
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return {
        success: true,
        logId: result[0].id,
      };
    } catch (error) {
      console.error("Error logging audit action:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getAuditLogs(
    filters: {
      userId?: string[];
      actionType?: string[];
      entityType?: string[];
      severity?: string[];
      status?: string[];
      branchId?: string;
      startDate?: string;
      endDate?: string;
      searchTerm?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ logs: any[]; pagination: any }> {
    try {
      const {
        userId,
        actionType,
        entityType,
        severity,
        status,
        branchId,
        startDate,
        endDate,
        searchTerm,
        page = 1,
        limit = 50,
      } = filters;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (userId?.length) {
        whereConditions.push(`user_id = ANY($${paramIndex})`);
        params.push(userId);
        paramIndex++;
      }

      if (actionType?.length) {
        whereConditions.push(`action_type = ANY($${paramIndex})`);
        params.push(actionType);
        paramIndex++;
      }

      if (entityType?.length) {
        whereConditions.push(`entity_type = ANY($${paramIndex})`);
        params.push(entityType);
        paramIndex++;
      }

      if (severity?.length) {
        whereConditions.push(`severity = ANY($${paramIndex})`);
        params.push(severity);
        paramIndex++;
      }

      if (status?.length) {
        whereConditions.push(`status = ANY($${paramIndex})`);
        params.push(status);
        paramIndex++;
      }

      if (branchId) {
        whereConditions.push(`branch_id = $${paramIndex}`);
        params.push(branchId);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      if (searchTerm) {
        whereConditions.push(
          `(description ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`
        );
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await sql.unsafe(countQuery, params);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const offset = (page - 1) * limit;
      const logsQuery = `
        SELECT 
          id,
          user_id,
          username,
          action_type,
          entity_type,
          entity_id,
          description,
          severity,
          status,
          metadata,
          branch_id,
          created_at,
          updated_at
        FROM audit_logs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const logsParams = [...params, limit, offset];
      const logsResult = await sql.unsafe(logsQuery, logsParams);

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        logs: logsResult,
        pagination,
      };
    } catch (error) {
      console.error("Error getting audit logs:", error);
      return {
        logs: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }

  static async getAuditStatistics(branchId?: string): Promise<any> {
    try {
      let whereClause = "";
      let params: any[] = [];

      if (branchId) {
        whereClause = "WHERE branch_id = $1";
        params.push(branchId);
      }

      // Get total logs count
      const totalLogsResult = await sql.unsafe(
        `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
        params
      );
      const totalLogs = Number(totalLogsResult[0]?.total || 0);

      // Get critical events count
      const criticalEventsResult = await sql.unsafe(
        `SELECT COUNT(*) as total FROM audit_logs ${
          whereClause ? whereClause + " AND" : "WHERE"
        } severity IN ('critical', 'high')`,
        params
      );
      const criticalEvents = Number(criticalEventsResult[0]?.total || 0);

      // Get failed actions count
      const failedActionsResult = await sql.unsafe(
        `SELECT COUNT(*) as total FROM audit_logs ${
          whereClause ? whereClause + " AND" : "WHERE"
        } status = 'failure'`,
        params
      );
      const failedActions = Number(failedActionsResult[0]?.total || 0);

      // Get active users count
      const activeUsersResult = await sql.unsafe(
        `SELECT COUNT(DISTINCT user_id) as total FROM audit_logs ${
          whereClause ? whereClause + " AND" : "WHERE"
        } created_at >= NOW() - INTERVAL '24 hours'`,
        params
      );
      const activeUsers = Number(activeUsersResult[0]?.total || 0);

      // Get severity breakdown
      const severityBreakdownResult = await sql.unsafe(
        `SELECT severity, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY severity`,
        params
      );

      const severityBreakdown = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

      severityBreakdownResult.forEach((row: any) => {
        if (row.severity in severityBreakdown) {
          severityBreakdown[row.severity as keyof typeof severityBreakdown] =
            Number(row.count);
        }
      });

      // Get action type breakdown
      const actionTypeBreakdownResult = await sql.unsafe(
        `SELECT action_type, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY action_type ORDER BY count DESC LIMIT 10`,
        params
      );

      const actionTypeBreakdown: Record<string, number> = {};
      actionTypeBreakdownResult.forEach((row: any) => {
        actionTypeBreakdown[row.action_type] = Number(row.count);
      });

      return {
        totalLogs,
        criticalEvents,
        failedActions,
        activeUsers,
        severityBreakdown,
        actionTypeBreakdown,
      };
    } catch (error) {
      console.error("Error getting audit statistics:", error);
      return {
        totalLogs: 0,
        criticalEvents: 0,
        failedActions: 0,
        activeUsers: 0,
        severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        actionTypeBreakdown: {},
      };
    }
  }
}
