/**
 * Production-Ready Logging Service
 * Mimhaad Financial Services ERP
 *
 * Features:
 * - Environment-aware logging (dev vs production)
 * - Log levels (debug, info, warn, error, critical)
 * - Structured logging with metadata
 * - Error tracking integration ready
 * - Performance monitoring
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  CRITICAL = "critical",
}

export enum LogCategory {
  AUTH = "auth",
  TRANSACTION = "transaction",
  GL = "gl",
  FLOAT = "float",
  NOTIFICATION = "notification",
  API = "api",
  DATABASE = "database",
  SYSTEM = "system",
  USER = "user",
  SECURITY = "security",
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  branchId?: string;
  error?: Error;
  stack?: string;
}

class ProductionLogger {
  private isDevelopment: boolean;
  private isProduction: boolean;
  private minLogLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.isProduction = process.env.NODE_ENV === "production";

    // Set minimum log level based on environment
    const envLogLevel = process.env.LOG_LEVEL || "info";
    this.minLogLevel = this.parseLogLevel(envLogLevel);
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case "debug":
        return LogLevel.DEBUG;
      case "info":
        return LogLevel.INFO;
      case "warn":
        return LogLevel.WARN;
      case "error":
        return LogLevel.ERROR;
      case "critical":
        return LogLevel.CRITICAL;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.CRITICAL,
    ];
    const minIndex = levels.indexOf(this.minLogLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(8);
    const category = `[${entry.category.toUpperCase()}]`.padEnd(15);

    let message = `${timestamp} ${level} ${category} ${entry.message}`;

    if (entry.userId) {
      message += ` [User: ${entry.userId}]`;
    }

    if (entry.branchId) {
      message += ` [Branch: ${entry.branchId}]`;
    }

    return message;
  }

  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
      error,
      stack: error?.stack,
    };

    const formattedMessage = this.formatLogEntry(entry);

    // Console output with appropriate method
    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.log(formattedMessage, metadata || "");
        }
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, metadata || "");
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, metadata || "");
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formattedMessage, error || metadata || "");
        if (error?.stack && this.isDevelopment) {
          console.error(error.stack);
        }
        break;
    }

    // In production, send critical errors to monitoring service
    if (
      this.isProduction &&
      (level === LogLevel.ERROR || level === LogLevel.CRITICAL)
    ) {
      this.sendToMonitoring(entry);
    }
  }

  private sendToMonitoring(entry: LogEntry) {
    // TODO: Integrate with error monitoring service (Sentry, LogRocket, etc.)
    // Example for Sentry:
    // Sentry.captureException(entry.error, {
    //   level: entry.level,
    //   tags: {
    //     category: entry.category,
    //     userId: entry.userId,
    //     branchId: entry.branchId,
    //   },
    //   extra: entry.metadata,
    // });
  }

  /**
   * Debug-level logging (development only)
   * Use for detailed debugging information
   */
  debug(
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>
  ) {
    this.log(LogLevel.DEBUG, category, message, metadata);
  }

  /**
   * Info-level logging
   * Use for general informational messages
   */
  info(category: LogCategory, message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, category, message, metadata);
  }

  /**
   * Warning-level logging
   * Use for potentially problematic situations
   */
  warn(category: LogCategory, message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, category, message, metadata);
  }

  /**
   * Error-level logging
   * Use for error conditions
   */
  error(
    category: LogCategory,
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ) {
    this.log(LogLevel.ERROR, category, message, metadata, error);
  }

  /**
   * Critical-level logging
   * Use for critical system failures
   */
  critical(
    category: LogCategory,
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ) {
    this.log(LogLevel.CRITICAL, category, message, metadata, error);
  }

  /**
   * Measure execution time of async functions
   */
  async measure<T>(
    category: LogCategory,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.info(category, `${operation} completed`, {
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.error(category, `${operation} failed`, error as Error, {
        duration: `${duration}ms`,
      });

      throw error;
    }
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Export convenience functions
export const logDebug = (
  category: LogCategory,
  message: string,
  metadata?: Record<string, any>
) => {
  logger.debug(category, message, metadata);
};

export const logInfo = (
  category: LogCategory,
  message: string,
  metadata?: Record<string, any>
) => {
  logger.info(category, message, metadata);
};

export const logWarn = (
  category: LogCategory,
  message: string,
  metadata?: Record<string, any>
) => {
  logger.warn(category, message, metadata);
};

export const logError = (
  category: LogCategory,
  message: string,
  error?: Error,
  metadata?: Record<string, any>
) => {
  logger.error(category, message, error, metadata);
};

export const logCritical = (
  category: LogCategory,
  message: string,
  error?: Error,
  metadata?: Record<string, any>
) => {
  logger.critical(category, message, error, metadata);
};

// Export for direct import
export { logger as ProductionLogger };

