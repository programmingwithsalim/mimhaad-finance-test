import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

const sql = neon(process.env.DATABASE_URL!);

// Input validation schemas
const AuditLogQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1).default(1)),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100).default(50)),
  userId: z.string().optional(),
  actionType: z.string().optional(),
  entityType: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  branchId: z.string().optional(),
  searchTerm: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const CreateAuditLogSchema = z.object({
  userId: z.string().optional(),
  username: z.string().min(1),
  actionType: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().optional(),
  description: z.string().min(1),
  details: z.any().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("low"),
  branchId: z.string().optional(),
  branchName: z.string().optional(),
  status: z.enum(["success", "failure"]).default("success"),
  errorMessage: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate and parse query parameters
    const validatedParams = AuditLogQuerySchema.parse(
      Object.fromEntries(searchParams)
    );
    const { page, limit, ...filters } = validatedParams;

    const offset = (page - 1) * limit;

    // Build dynamic query with proper parameterization
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Add filters with proper parameterization
    if (filters.userId) {
      const userIds = filters.userId.split(",");
      const placeholders = userIds.map(() => `$${paramIndex++}`).join(",");
      whereConditions.push(`user_id IN (${placeholders})`);
      queryParams.push(...userIds);
    }

    if (filters.actionType) {
      const actionTypes = filters.actionType.split(",");
      const placeholders = actionTypes.map(() => `$${paramIndex++}`).join(",");
      whereConditions.push(`action_type IN (${placeholders})`);
      queryParams.push(...actionTypes);
    }

    if (filters.entityType) {
      const entityTypes = filters.entityType.split(",");
      const placeholders = entityTypes.map(() => `$${paramIndex++}`).join(",");
      whereConditions.push(`entity_type IN (${placeholders})`);
      queryParams.push(...entityTypes);
    }

    if (filters.severity) {
      const severities = filters.severity.split(",");
      const placeholders = severities.map(() => `$${paramIndex++}`).join(",");
      whereConditions.push(`severity IN (${placeholders})`);
      queryParams.push(...severities);
    }

    if (filters.status) {
      const statuses = filters.status.split(",");
      const placeholders = statuses.map(() => `$${paramIndex++}`).join(",");
      whereConditions.push(`status IN (${placeholders})`);
      queryParams.push(...statuses);
    }

    if (filters.branchId) {
      const branchIds = filters.branchId.split(",");
      const placeholders = branchIds.map(() => `$${paramIndex++}`).join(",");
      whereConditions.push(`branch_id IN (${placeholders})`);
      queryParams.push(...branchIds);
    }

    if (filters.searchTerm) {
      whereConditions.push(
        `(description ILIKE $${paramIndex++} OR username ILIKE $${paramIndex++})`
      );
      queryParams.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
    }

    if (filters.startDate) {
      whereConditions.push(`created_at >= $${paramIndex++}`);
      queryParams.push(filters.startDate);
    }

    if (filters.endDate) {
      whereConditions.push(`created_at <= $${paramIndex++}`);
      queryParams.push(filters.endDate);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Get total count
    let total = 0;
    try {
      if (whereClause) {
        const countResult = await sql.unsafe(
          `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
          queryParams
        );
        total = Number.parseInt(countResult[0]?.total || "0");
      } else {
        const countResult = await sql`SELECT COUNT(*) as total FROM audit_logs`;
        total = Number.parseInt(countResult[0]?.total || "0");
      }
    } catch (countError) {
      console.error("Error getting count:", countError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get audit log count",
          details:
            countError instanceof Error ? countError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // Get paginated results
    let logs = [];
    try {
      const selectQuery = `
        SELECT 
          id,
          user_id as "userId",
          username,
          action_type as "actionType",
          entity_type as "entityType",
          entity_id as "entityId",
          description,
          details,
          ip_address as "ipAddress",
          user_agent as "userAgent",
          severity,
          branch_id as "branchId",
          branch_name as "branchName",
          status,
          error_message as "errorMessage",
          related_entities as "relatedEntities",
          metadata,
          created_at as "timestamp"
        FROM audit_logs 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      if (whereClause) {
        const dataResult = await sql.unsafe(selectQuery, [
          ...queryParams,
          limit,
          offset,
        ]);
        logs = dataResult || [];
      } else {
        const dataResult = await sql`
          SELECT 
            id,
            user_id as "userId",
            username,
            action_type as "actionType",
            entity_type as "entityType",
            entity_id as "entityId",
            description,
            details,
            ip_address as "ipAddress",
            user_agent as "userAgent",
            severity,
            branch_id as "branchId",
            branch_name as "branchName",
            status,
            error_message as "errorMessage",
            related_entities as "relatedEntities",
            metadata,
            created_at as "timestamp"
          FROM audit_logs 
          ORDER BY created_at DESC 
          LIMIT ${limit} OFFSET ${offset}
        `;
        logs = dataResult || [];
      }
    } catch (dataError) {
      console.error("Error getting audit logs:", dataError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get audit logs",
          details:
            dataError instanceof Error ? dataError.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error in audit logs GET:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle export request
    if (body.action === "export") {
      return NextResponse.json({
        success: true,
        message: "Export functionality will be implemented",
        data: { exportId: "export_" + Date.now() },
      });
    }

    // Validate create audit log request
    const validatedData = CreateAuditLogSchema.parse(body);

    const result = await sql`
      INSERT INTO audit_logs (
        user_id, username, action_type, entity_type, entity_id, 
        description, details, severity, branch_id, branch_name, 
        status, error_message, ip_address, user_agent
      )
      VALUES (
        ${validatedData.userId || null}, 
        ${validatedData.username}, 
        ${validatedData.actionType}, 
        ${validatedData.entityType}, 
        ${validatedData.entityId || null},
        ${validatedData.description}, 
        ${
          validatedData.details ? JSON.stringify(validatedData.details) : null
        }, 
        ${validatedData.severity},
        ${validatedData.branchId || null}, 
        ${validatedData.branchName || null}, 
        ${validatedData.status}, 
        ${validatedData.errorMessage || null},
        ${validatedData.ipAddress || null}, 
        ${validatedData.userAgent || null}
      )
      RETURNING 
        id,
        user_id as "userId",
        username,
        action_type as "actionType",
        entity_type as "entityType",
        entity_id as "entityId",
        description,
        details,
        severity,
        branch_id as "branchId",
        branch_name as "branchName",
        status,
        error_message as "errorMessage",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        created_at as "timestamp"
    `;

    return NextResponse.json({
      success: true,
      message: "Audit log created successfully",
      data: result[0],
    });
  } catch (error) {
    console.error("Error in audit logs POST:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create audit log",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
