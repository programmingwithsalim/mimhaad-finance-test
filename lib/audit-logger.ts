import { v4 as uuidv4 } from "uuid"

// Define action types
export type AuditActionType =
  // Authentication actions
  | "login"
  | "logout"
  | "password_reset"
  | "failed_login_attempt"

  // CRUD actions
  | "create"
  | "update"
  | "delete"
  | "view"

  // Transaction actions
  | "transaction_deposit"
  | "transaction_withdrawal"
  | "transaction_transfer"
  | "transaction_reversal"
  | "transaction_approval"
  | "transaction_rejection"

  // Float actions
  | "float_addition"
  | "float_withdrawal"
  | "float_adjustment"
  | "float_allocation"
  | "float_reconciliation"

  // Export actions
  | "export_data"
  | "export_report"
  | "export_logs"

  // System actions
  | "system_config_change"
  | "permission_change"
  | "role_change"
  | "branch_change"
  | "system_error"

// Define entity types
export type EntityType =
  | "user"
  | "transaction"
  | "float_account"
  | "branch"
  | "expense"
  | "commission"
  | "report"
  | "system_config"
  | "role"
  | "permission"
  | "gl_account"
  | "gl_transaction"
  | "cash_till"
  | "agency_banking"
  | "momo"
  | "e_zwich"
  | "power"
  | "jumia"

// Define severity levels
export type SeverityLevel = "low" | "medium" | "high" | "critical"

// Define audit log entry structure
export interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  username: string
  actionType: AuditActionType
  entityType: EntityType
  entityId?: string
  description: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  severity: SeverityLevel
  branchId?: string
  branchName?: string
  status: "success" | "failure"
  errorMessage?: string
  relatedEntities?: Array<{
    entityType: EntityType
    entityId: string
  }>
  metadata?: Record<string, any>
}

// Define search parameters
export interface AuditLogSearchParams {
  userId?: string
  actionType?: AuditActionType | AuditActionType[]
  entityType?: EntityType | EntityType[]
  entityId?: string
  startDate?: Date | string
  endDate?: Date | string
  severity?: SeverityLevel | SeverityLevel[]
  branchId?: string
  status?: "success" | "failure"
  searchTerm?: string
  limit?: number
  offset?: number
  sortBy?: keyof AuditLogEntry
  sortDirection?: "asc" | "desc"
}

// Define transaction log details
export interface TransactionLogDetails {
  transactionType: "deposit" | "withdrawal" | "transfer" | "reversal" | "adjustment"
  amount: number
  currency: string
  sourceAccount?: string
  sourceAccountType?: string
  destinationAccount?: string
  destinationAccountType?: string
  reference?: string
  notes?: string
  beforeBalance?: number
  afterBalance?: number
}

// Define float log details
export interface FloatLogDetails {
  floatActionType: "addition" | "withdrawal" | "adjustment" | "allocation" | "reconciliation"
  amount: number
  currency: string
  floatAccountId: string
  floatAccountName?: string
  sourceAccount?: string
  destinationAccount?: string
  reference?: string
  notes?: string
  beforeBalance?: number
  afterBalance?: number
}

// Define export log details
export interface ExportLogDetails {
  exportType: "data" | "report" | "logs"
  format: "csv" | "pdf" | "excel" | "json"
  filters?: Record<string, any>
  recordCount?: number
  dataDescription: string
  fileName?: string
  fileSize?: number
}

/**
 * In-memory audit logging service (replace with database in production)
 */
export class AuditLogger {
  private static logs: AuditLogEntry[] = []
  private static readonly MAX_LOGS_IN_MEMORY = 1000

  /**
   * Initialize with some mock data
   */
  private static initializeMockData(): void {
    if (this.logs.length === 0) {
      this.logs = [
        {
          id: uuidv4(),
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          userId: "user-1",
          username: "john.doe",
          actionType: "login",
          entityType: "user",
          entityId: "user-1",
          description: "User logged in successfully",
          severity: "low",
          status: "success",
          ipAddress: "192.168.1.100",
          userAgent: "Mozilla/5.0...",
        },
        {
          id: uuidv4(),
          timestamp: new Date(Date.now() - 43200000).toISOString(),
          userId: "user-2",
          username: "jane.smith",
          actionType: "transaction_deposit",
          entityType: "transaction",
          entityId: "tx-001",
          description: "Mobile money deposit of GHS 500",
          severity: "medium",
          status: "success",
          details: {
            amount: 500,
            provider: "mtn",
            customer_phone: "0241234567",
          },
        },
        {
          id: uuidv4(),
          timestamp: new Date(Date.now() - 21600000).toISOString(),
          userId: "admin-1",
          username: "admin",
          actionType: "float_allocation",
          entityType: "float_account",
          entityId: "float-001",
          description: "Allocated GHS 10,000 to branch float account",
          severity: "high",
          status: "success",
          details: {
            amount: 10000,
            branch_id: "branch-001",
            allocation_type: "manual",
          },
        },
      ]
    }
  }

  /**
   * Log an audit event
   */
  static log(params: {
    userId: string
    username: string
    actionType: AuditActionType
    entityType: EntityType
    entityId?: string
    description: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
    severity?: SeverityLevel
    branchId?: string
    branchName?: string
    status?: "success" | "failure"
    errorMessage?: string
    relatedEntities?: Array<{
      entityType: EntityType
      entityId: string
    }>
    metadata?: Record<string, any>
  }): AuditLogEntry {
    this.initializeMockData()

    // Create the log entry
    const logEntry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId: params.userId,
      username: params.username,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      details: params.details,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      severity: params.severity || "low",
      branchId: params.branchId,
      branchName: params.branchName,
      status: params.status || "success",
      errorMessage: params.errorMessage,
      relatedEntities: params.relatedEntities,
      metadata: params.metadata,
    }

    // Add the log entry to the in-memory logs
    this.logs.push(logEntry)

    // Keep only the most recent logs to prevent memory issues
    if (this.logs.length > this.MAX_LOGS_IN_MEMORY) {
      this.logs = this.logs.slice(-this.MAX_LOGS_IN_MEMORY)
    }

    // For demo purposes, log to console
    console.log("Audit Log:", logEntry)

    return logEntry
  }

  /**
   * Log a transaction event
   */
  static logTransaction(params: {
    userId: string
    username: string
    transactionDetails: TransactionLogDetails
    entityId: string
    description: string
    ipAddress?: string
    userAgent?: string
    branchId?: string
    branchName?: string
    status?: "success" | "failure"
    errorMessage?: string
    metadata?: Record<string, any>
  }): AuditLogEntry {
    // Determine the action type based on transaction type
    let actionType: AuditActionType
    switch (params.transactionDetails.transactionType) {
      case "deposit":
        actionType = "transaction_deposit"
        break
      case "withdrawal":
        actionType = "transaction_withdrawal"
        break
      case "transfer":
        actionType = "transaction_transfer"
        break
      case "reversal":
        actionType = "transaction_reversal"
        break
      case "adjustment":
        actionType = "transaction_deposit" // Default to deposit for adjustments
        break
      default:
        actionType = "transaction_deposit"
    }

    // Determine severity based on amount
    let severity: SeverityLevel = "low"
    const amount = params.transactionDetails.amount
    if (amount > 10000) {
      severity = "critical"
    } else if (amount > 5000) {
      severity = "high"
    } else if (amount > 1000) {
      severity = "medium"
    }

    // Log the transaction
    return this.log({
      userId: params.userId,
      username: params.username,
      actionType,
      entityType: "transaction",
      entityId: params.entityId,
      description: params.description,
      details: params.transactionDetails,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      severity,
      branchId: params.branchId,
      branchName: params.branchName,
      status: params.status,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    })
  }

  /**
   * Log a float event
   */
  static logFloatAction(params: {
    userId: string
    username: string
    floatDetails: FloatLogDetails
    description: string
    ipAddress?: string
    userAgent?: string
    branchId?: string
    branchName?: string
    status?: "success" | "failure"
    errorMessage?: string
    metadata?: Record<string, any>
  }): AuditLogEntry {
    // Determine the action type based on float action type
    let actionType: AuditActionType
    switch (params.floatDetails.floatActionType) {
      case "addition":
        actionType = "float_addition"
        break
      case "withdrawal":
        actionType = "float_withdrawal"
        break
      case "adjustment":
        actionType = "float_adjustment"
        break
      case "allocation":
        actionType = "float_allocation"
        break
      case "reconciliation":
        actionType = "float_reconciliation"
        break
      default:
        actionType = "float_adjustment"
    }

    // Determine severity based on amount
    let severity: SeverityLevel = "low"
    const amount = params.floatDetails.amount
    if (amount > 50000) {
      severity = "critical"
    } else if (amount > 20000) {
      severity = "high"
    } else if (amount > 5000) {
      severity = "medium"
    }

    // Log the float action
    return this.log({
      userId: params.userId,
      username: params.username,
      actionType,
      entityType: "float_account",
      entityId: params.floatDetails.floatAccountId,
      description: params.description,
      details: params.floatDetails,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      severity,
      branchId: params.branchId,
      branchName: params.branchName,
      status: params.status,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    })
  }

  /**
   * Log an export event
   */
  static logExport(params: {
    userId: string
    username: string
    exportDetails: ExportLogDetails
    description: string
    ipAddress?: string
    userAgent?: string
    branchId?: string
    branchName?: string
    status?: "success" | "failure"
    errorMessage?: string
    metadata?: Record<string, any>
  }): AuditLogEntry {
    // Determine the action type based on export type
    let actionType: AuditActionType
    switch (params.exportDetails.exportType) {
      case "data":
        actionType = "export_data"
        break
      case "report":
        actionType = "export_report"
        break
      case "logs":
        actionType = "export_logs"
        break
      default:
        actionType = "export_data"
    }

    // Log the export action
    return this.log({
      userId: params.userId,
      username: params.username,
      actionType,
      entityType: params.exportDetails.exportType === "report" ? "report" : "system_config",
      description: params.description,
      details: params.exportDetails,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      severity: "medium", // Exports are generally medium severity
      branchId: params.branchId,
      branchName: params.branchName,
      status: params.status,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    })
  }

  /**
   * Log an authentication event
   */
  static logAuthentication(params: {
    userId: string
    username: string
    actionType: "login" | "logout" | "password_reset" | "failed_login_attempt"
    description: string
    ipAddress?: string
    userAgent?: string
    branchId?: string
    branchName?: string
    status?: "success" | "failure"
    errorMessage?: string
    metadata?: Record<string, any>
  }): AuditLogEntry {
    // Determine severity based on action type
    let severity: SeverityLevel = "low"
    if (params.actionType === "failed_login_attempt") {
      severity = "medium"
    } else if (params.actionType === "password_reset") {
      severity = "medium"
    }

    // Log the authentication action
    return this.log({
      userId: params.userId,
      username: params.username,
      actionType: params.actionType,
      entityType: "user",
      entityId: params.userId,
      description: params.description,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      severity,
      branchId: params.branchId,
      branchName: params.branchName,
      status: params.status,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    })
  }

  /**
   * Search audit logs
   */
  static async searchLogs(params: AuditLogSearchParams): Promise<{
    logs: AuditLogEntry[]
    total: number
  }> {
    try {
      this.initializeMockData()

      // Filter logs based on search parameters
      let filteredLogs = this.logs.filter((log) => {
        // Filter by userId
        if (params.userId && log.userId !== params.userId) {
          return false
        }

        // Filter by actionType
        if (params.actionType) {
          if (Array.isArray(params.actionType)) {
            if (!params.actionType.includes(log.actionType)) {
              return false
            }
          } else if (log.actionType !== params.actionType) {
            return false
          }
        }

        // Filter by entityType
        if (params.entityType) {
          if (Array.isArray(params.entityType)) {
            if (!params.entityType.includes(log.entityType)) {
              return false
            }
          } else if (log.entityType !== params.entityType) {
            return false
          }
        }

        // Filter by entityId
        if (params.entityId && log.entityId !== params.entityId) {
          return false
        }

        // Filter by date range
        if (params.startDate) {
          const startDate = typeof params.startDate === "string" ? new Date(params.startDate) : params.startDate
          if (new Date(log.timestamp) < startDate) {
            return false
          }
        }

        if (params.endDate) {
          const endDate = typeof params.endDate === "string" ? new Date(params.endDate) : params.endDate
          if (new Date(log.timestamp) > endDate) {
            return false
          }
        }

        // Filter by severity
        if (params.severity) {
          if (Array.isArray(params.severity)) {
            if (!params.severity.includes(log.severity)) {
              return false
            }
          } else if (log.severity !== params.severity) {
            return false
          }
        }

        // Filter by branchId
        if (params.branchId && log.branchId !== params.branchId) {
          return false
        }

        // Filter by status
        if (params.status && log.status !== params.status) {
          return false
        }

        // Filter by search term
        if (params.searchTerm) {
          const searchTerm = params.searchTerm.toLowerCase()
          const searchableFields = [
            log.username,
            log.description,
            log.entityId,
            log.branchName,
            JSON.stringify(log.details).toLowerCase(),
          ].filter(Boolean)

          if (!searchableFields.some((field) => field?.toLowerCase().includes(searchTerm))) {
            return false
          }
        }

        return true
      })

      // Sort logs
      if (params.sortBy) {
        filteredLogs.sort((a, b) => {
          const aValue = a[params.sortBy as keyof AuditLogEntry]
          const bValue = b[params.sortBy as keyof AuditLogEntry]

          if (typeof aValue === "string" && typeof bValue === "string") {
            return params.sortDirection === "desc" ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
          }

          // Default to timestamp sorting if the field doesn't exist or isn't comparable
          return params.sortDirection === "desc"
            ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        })
      } else {
        // Default sort by timestamp descending (newest first)
        filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      }

      // Apply pagination
      const total = filteredLogs.length
      if (params.offset !== undefined && params.limit !== undefined) {
        filteredLogs = filteredLogs.slice(params.offset, params.offset + params.limit)
      } else if (params.limit !== undefined) {
        filteredLogs = filteredLogs.slice(0, params.limit)
      }

      return { logs: filteredLogs, total }
    } catch (error) {
      console.error("Error searching audit logs:", error)
      return { logs: [], total: 0 }
    }
  }

  /**
   * Get all logs (for demo purposes)
   */
  static async getAllLogs(): Promise<AuditLogEntry[]> {
    this.initializeMockData()
    return [...this.logs]
  }

  /**
   * Flush in-memory logs (no-op for in-memory implementation)
   */
  static flush(): void {
    // No-op for in-memory implementation
    console.log("Audit logs flushed (in-memory)")
  }
}
