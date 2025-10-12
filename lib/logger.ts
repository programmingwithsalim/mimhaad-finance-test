import { sql } from "@/lib/db";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export enum LogCategory {
  SYSTEM = "system",
  AUTH = "auth",
  TRANSACTION = "transaction",
  FLOAT_ACCOUNT = "float_account",
  GL_ENTRY = "gl_entry",
  AGENCY_BANKING = "agency_banking",
  MOMO = "momo",
  EZWICH = "ezwich",
  POWER = "power",
  AUDIT = "audit",
  API = "api",
  DATABASE = "database",
  NOTIFICATION = "notification",
}

export interface LogEntry {
  id?: string;
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  userId?: string;
  branchId?: string;
  transactionId?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  error?: Error;
  stackTrace?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private enableDatabaseLogging: boolean;

  private constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.enableDatabaseLogging = process.env.ENABLE_DB_LOGGING === "true";
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const category = entry.category.toUpperCase();
    
    let message = `[${timestamp}] [${levelStr}] [${category}] ${entry.message}`;
    
    if (entry.userId) {
      message += ` | User: ${entry.userId}`;
    }
    if (entry.branchId) {
      message += ` | Branch: ${entry.branchId}`;
    }
    if (entry.transactionId) {
      message += ` | TXN: ${entry.transactionId}`;
    }
    if (entry.entityId) {
      message += ` | Entity: ${entry.entityType}:${entry.entityId}`;
    }
    
    return message;
  }

  private async logToDatabase(entry: LogEntry): Promise<void> {
    if (!this.enableDatabaseLogging) return;

    try {
      await sql`
        INSERT INTO system_logs (
          id, timestamp, level, category, message, details, user_id, branch_id, 
          transaction_id, entity_id, entity_type, metadata, error_message, stack_trace
        ) VALUES (
          gen_random_uuid(),
          ${entry.timestamp},
          ${LogLevel[entry.level]},
          ${entry.category},
          ${entry.message},
          ${entry.details ? JSON.stringify(entry.details) : null},
          ${entry.userId || null},
          ${entry.branchId || null},
          ${entry.transactionId || null},
          ${entry.entityId || null},
          ${entry.entityType || null},
          ${entry.metadata ? JSON.stringify(entry.metadata) : null},
          ${entry.error?.message || null},
          ${entry.stackTrace || null}
        )
      `;
    } catch (error) {
      // Fallback to console if database logging fails
      console.error("Failed to log to database:", error);
      console.log(this.formatMessage(entry));
    }
  }

  private async log(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) return;

    // Always log to console for now
    console.log(this.formatMessage(entry));
    
    // Log to database if enabled
    await this.logToDatabase(entry);
  }

  public async debug(
    category: LogCategory,
    message: string,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      category,
      message,
      details,
      ...metadata,
    });
  }

  public async info(
    category: LogCategory,
    message: string,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: LogLevel.INFO,
      category,
      message,
      details,
      ...metadata,
    });
  }

  public async warn(
    category: LogCategory,
    message: string,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: LogLevel.WARN,
      category,
      message,
      details,
      ...metadata,
    });
  }

  public async error(
    category: LogCategory,
    message: string,
    error?: Error,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      category,
      message,
      details,
      error,
      stackTrace: error?.stack,
      ...metadata,
    });
  }

  public async critical(
    category: LogCategory,
    message: string,
    error?: Error,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: LogLevel.CRITICAL,
      category,
      message,
      details,
      error,
      stackTrace: error?.stack,
      ...metadata,
    });
  }

  // Convenience methods for common operations
  public async logTransaction(
    transactionId: string,
    message: string,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.info(LogCategory.TRANSACTION, message, details, {
      transactionId,
      ...metadata,
    });
  }

  public async logFloatAccount(
    entityId: string,
    message: string,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.info(LogCategory.FLOAT_ACCOUNT, message, details, {
      entityId,
      entityType: "float_account",
      ...metadata,
    });
  }

  public async logGLEntry(
    transactionId: string,
    message: string,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.info(LogCategory.GL_ENTRY, message, details, {
      transactionId,
      ...metadata,
    });
  }

  public async logAPI(
    endpoint: string,
    message: string,
    details?: any,
    metadata?: Partial<LogEntry>
  ): Promise<void> {
    await this.info(LogCategory.API, message, details, {
      metadata: { endpoint, ...metadata?.metadata },
      ...metadata,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions for backward compatibility
export const logDebug = (category: LogCategory, message: string, details?: any, metadata?: Partial<LogEntry>) =>
  logger.debug(category, message, details, metadata);

export const logInfo = (category: LogCategory, message: string, details?: any, metadata?: Partial<LogEntry>) =>
  logger.info(category, message, details, metadata);

export const logWarn = (category: LogCategory, message: string, details?: any, metadata?: Partial<LogEntry>) =>
  logger.warn(category, message, details, metadata);

export const logError = (category: LogCategory, message: string, error?: Error, details?: any, metadata?: Partial<LogEntry>) =>
  logger.error(category, message, error, details, metadata);

export const logCritical = (category: LogCategory, message: string, error?: Error, details?: any, metadata?: Partial<LogEntry>) =>
  logger.critical(category, message, error, details, metadata); 