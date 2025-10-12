import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export interface AuditLogData {
  userId: string
  username: string
  actionType: string
  entityType: string
  entityId?: string
  description: string
  details?: any
  severity: "low" | "medium" | "high" | "critical"
  branchId: string
  branchName: string
  status: "success" | "failure"
  errorMessage?: string
}

export interface TransactionAuditParams {
  userId: string
  username?: string
  action: "create" | "update" | "delete" | "transfer"
  transactionType: string
  transactionId: string
  amount: number
  details?: Record<string, any>
  severity?: "low" | "medium" | "high" | "critical"
  branchId: string
  branchName: string
  status?: "success" | "failure"
  errorMessage?: string
}

export interface AuditLogEntry {
  action: string
  entity_type: string
  entity_id?: string
  user_id: string
  username?: string
  branch_id?: string
  description?: string
  details?: Record<string, any>
  severity?: "low" | "medium" | "high" | "critical"
  ip_address?: string
  user_agent?: string
}

// Get user's full name from database
async function getUserFullName(userId: string): Promise<string> {
  try {
    if (!userId || userId === "unknown" || userId === "System") {
      return "System User"
    }

    // Check if userId looks like a UUID (basic validation)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(userId)) {
      console.warn(`Invalid UUID format for user ID: ${userId}`)
      return `User ${userId}`
    }

    // Try to get user from database
    const users = await sql`
      SELECT first_name, last_name, email FROM users WHERE id = ${userId}
    `

    if (users && users.length > 0) {
      const { first_name, last_name, email } = users[0]
      if (first_name && last_name) {
        return `${first_name} ${last_name}`
      } else if (first_name) {
        return first_name
      } else if (last_name) {
        return last_name
      } else if (email) {
        return email
      }
    }

    return "Unknown User"
  } catch (error) {
    console.error(`Failed to get user name for ID ${userId}:`, error)
    return "Unknown User"
  }
}

export class AuditLoggerService {
  static async log(data: AuditLogData): Promise<void> {
    try {
      // Validate that we have proper UUIDs, not "System"
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      // If userId is "System" or invalid, don't log to avoid UUID errors
      if (!data.userId || data.userId === "System" || !uuidRegex.test(data.userId)) {
        console.warn("⚠️ Skipping audit log due to invalid user ID:", data.userId)
        return
      }

      // If branchId is "System" or invalid, don't log to avoid UUID errors
      if (!data.branchId || data.branchId === "System" || !uuidRegex.test(data.branchId)) {
        console.warn("⚠️ Skipping audit log due to invalid branch ID:", data.branchId)
        return
      }

      console.log(`📝 Audit log: Using username "${data.username}" for user ID ${data.userId}`)

      // Ensure audit_logs table exists
      await sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          username VARCHAR(255) NOT NULL,
          action_type VARCHAR(100) NOT NULL,
          entity_type VARCHAR(100) NOT NULL,
          entity_id UUID,
          description TEXT NOT NULL,
          details JSONB,
          severity VARCHAR(20) DEFAULT 'low'::character varying,
          branch_id UUID NOT NULL,
          branch_name VARCHAR(255),
          status VARCHAR(20) DEFAULT 'success',
          error_message TEXT,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `

      // Insert audit log
      await sql`
        INSERT INTO audit_logs (
          user_id,
          username,
          action_type,
          entity_type,
          entity_id,
          description,
          details,
          severity,
          branch_id,
          branch_name,
          status,
          error_message
        ) VALUES (
          ${data.userId},
          ${data.username},
          ${data.actionType},
          ${data.entityType},
          ${data.entityId || null},
          ${data.description},
          ${JSON.stringify(data.details || {})},
          ${data.severity},
          ${data.branchId},
          ${data.branchName},
          ${data.status},
          ${data.errorMessage || null}
        )
      `

      console.log(`📝 Audit log created: ${data.actionType} by ${data.username} (${data.userId})`)
    } catch (error) {
      console.error("❌ Failed to create audit log:", error)
      // Don't throw error to avoid breaking the main transaction
    }
  }

  /**
   * Log transaction-specific events
   */
  static async logTransaction(params: TransactionAuditParams): Promise<void> {
    // Get username if not provided
    let username = params.username
    if (!username && params.userId && params.userId !== "unknown" && params.userId !== "System") {
      username = await getUserFullName(params.userId)
    }

    await this.log({
      userId: params.userId,
      username: username,
      actionType: `transaction_${params.action}`,
      entityType: params.transactionType,
      entityId: params.transactionId,
      description: `${params.transactionType} transaction ${params.action}: GHS ${params.amount}`,
      details: {
        action: params.action,
        transactionType: params.transactionType,
        amount: params.amount,
        ...params.details,
      },
      severity: params.severity || (params.amount > 10000 ? "high" : "medium"),
      branchId: params.branchId,
      branchName: params.branchName,
      status: params.status || "success",
      errorMessage: params.errorMessage,
    })
  }

  /**
   * Log authentication events
   */
  static async logAuth(params: {
    userId: string
    username?: string
    action: "login" | "logout" | "failed_login"
    ipAddress?: string
    userAgent?: string
    branchId?: string
    branchName?: string
    errorMessage?: string
  }): Promise<void> {
    // Get username if not provided
    let username = params.username
    if (!username && params.userId && params.userId !== "unknown" && params.userId !== "System") {
      username = await getUserFullName(params.userId)
    }

    await this.log({
      userId: params.userId,
      username: username,
      actionType: params.action,
      entityType: "authentication",
      entityId: params.userId,
      description: `User ${params.action.replace("_", " ")}`,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      severity: params.action === "failed_login" ? "medium" : "low",
      branchId: params.branchId,
      branchName: params.branchName,
      status: params.action === "failed_login" ? "failure" : "success",
      errorMessage: params.errorMessage,
    })
  }

  /**
   * Log system events
   */
  static async logSystem(params: {
    userId: string
    username?: string
    action: string
    description: string
    details?: Record<string, any>
    severity?: "low" | "medium" | "high" | "critical"
    branchId?: string
    branchName?: string
  }): Promise<void> {
    // Get username if not provided
    let username = params.username
    if (!username && params.userId && params.userId !== "unknown" && params.userId !== "System") {
      username = await getUserFullName(params.userId)
    }

    await this.log({
      userId: params.userId,
      username: username,
      actionType: `system_${params.action}`,
      entityType: "system",
      description: params.description,
      details: params.details,
      severity: params.severity || "low",
      branchId: params.branchId,
      branchName: params.branchName,
    })
  }

  /**
   * Get recent audit logs
   */
  static async getRecentLogs(limit = 100): Promise<any[]> {
    try {
      await this.ensureAuditTable()

      const logs = await sql`
        SELECT * FROM audit_logs 
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `

      return logs
    } catch (error) {
      console.error("Failed to fetch audit logs:", error)
      return []
    }
  }

  /**
   * Get audit logs by user
   */
  static async getLogsByUser(userId: string, limit = 50): Promise<any[]> {
    try {
      await this.ensureAuditTable()

      const logs = await sql`
        SELECT * FROM audit_logs 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `

      return logs
    } catch (error) {
      console.error("Failed to fetch user audit logs:", error)
      return []
    }
  }

  private static async ensureAuditTable(): Promise<void> {
    try {
      // Ensure audit_logs table exists
      await sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          username VARCHAR(255) NOT NULL,
          action_type VARCHAR(100) NOT NULL,
          entity_type VARCHAR(100) NOT NULL,
          entity_id UUID,
          description TEXT NOT NULL,
          details JSONB,
          severity VARCHAR(20) DEFAULT 'low'::character varying,
          branch_id UUID NOT NULL,
          branch_name VARCHAR(255),
          status VARCHAR(20) DEFAULT 'success',
          error_message TEXT,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `

      console.log("audit_logs table created.")
    } catch (error) {
      console.error("Failed to ensure audit_logs table exists:", error)
    }
  }
}

async function auditTableExists(): Promise<boolean> {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT 1
        FROM   information_schema.tables 
        WHERE  table_name = 'audit_logs'
      );
    `
    return result[0].exists
  } catch (error) {
    console.error("Error checking if audit table exists:", error)
    return false
  }
}

export const auditLogger = {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Check if table exists first
      const tableExists = await auditTableExists()

      if (!tableExists) {
        console.warn("Audit logs table does not exist, skipping audit log")
        return
      }

      // Validate that we have proper UUIDs, not "System"
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!entry.user_id || entry.user_id === "System" || !uuidRegex.test(entry.user_id)) {
        console.warn("Skipping audit log due to invalid user ID:", entry.user_id)
        return
      }

      // Validate required fields
      if (!entry.action || !entry.entity_type || !entry.user_id) {
        console.warn("Missing required audit log fields:", {
          action: !!entry.action,
          entity_type: !!entry.entity_type,
          user_id: !!entry.user_id,
        })
        return
      }

      // Get username if not provided
      let username = "System User"
      if (entry.user_id && entry.user_id !== "unknown" && entry.user_id !== "System") {
        username = await getUserFullName(entry.user_id)
      }

      // Ensure description is not null
      const description = entry.description || `${entry.action} action on ${entry.entity_type}`

      // Ensure severity is valid - fix "info" to "low"
      let severity = entry.severity || "low"
      if (severity === "info") {
        severity = "low"
      }
      if (!["low", "medium", "high", "critical"].includes(severity)) {
        severity = "low"
      }

      // Insert audit log entry using action_type instead of action
      await sql`
        INSERT INTO audit_logs (
          action_type,
          entity_type,
          entity_id,
          user_id,
          username,
          branch_id,
          description,
          details,
          severity,
          ip_address,
          user_agent,
          created_at
        ) VALUES (
          ${entry.action},
          ${entry.entity_type},
          ${entry.entity_id || null},
          ${entry.user_id},
          ${username},
          ${entry.branch_id || null},
          ${description},
          ${entry.details ? JSON.stringify(entry.details) : null},
          ${severity},
          ${entry.ip_address || null},
          ${entry.user_agent || null},
          CURRENT_TIMESTAMP
        )
      `

      console.log(`✓ Audit log created: ${entry.action} for ${entry.entity_type}`)
    } catch (error) {
      // Don't throw errors for audit logging failures - just log them
      console.error("Failed to create audit log (non-critical):", error)
      console.error("Audit entry that failed:", entry)
    }
  },
}
