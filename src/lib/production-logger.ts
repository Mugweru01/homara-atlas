/**
 * Production-Ready Logger
 *
 * Replaces console.log with proper logging that:
 * - Only logs in development mode
 * - Supports different log levels
 * - Can be toggled via environment variable
 * - Sends errors to monitoring services (Sentry, etc.)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  sendToMonitoring: boolean;
}

class ProductionLogger {
  private config: LoggerConfig;

  constructor() {
    this.config = {
      enabled:
        import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOGGING === "true",
      level: (import.meta.env.VITE_LOG_LEVEL as LogLevel) || "info",
      sendToMonitoring: import.meta.env.PROD,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return `${prefix} ${message}`;
  }

  /**
   * Debug logging (development only)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message), ...args);
    }
  }

  /**
   * Info logging
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      logger.info(this.formatMessage("info", message), ...args);
    }
  }

  /**
   * Warning logging
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      logger.warn(this.formatMessage("warn", message), ...args);
    }
  }

  /**
   * Error logging (always logged + sent to monitoring)
   */
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage("error", message);

    // Always log errors to console
    if (error instanceof Error) {
      logger.error(formattedMessage, error.message, error.stack, ...args);
    } else {
      logger.error(formattedMessage, error, ...args);
    }

    // Send to monitoring service in production
    if (this.config.sendToMonitoring) {
      this.sendToMonitoring(message, error);
    }
  }

  /**
   * Send errors to monitoring service (Sentry, etc.)
   */
  private sendToMonitoring(message: string, error?: Error | unknown): void {
    try {
      // If Sentry is available
      interface WindowWithSentry extends Window {
        Sentry?: {
          captureException: (error: Error, context?: unknown) => void;
          captureMessage: (message: string, level?: string) => void;
        };
      }

      const windowWithSentry = window as WindowWithSentry;

      if (typeof window !== "undefined" && windowWithSentry.Sentry) {
        if (error instanceof Error) {
          windowWithSentry.Sentry.captureException(error, {
            contexts: {
              custom: { message },
            },
          });
        } else {
          windowWithSentry.Sentry.captureMessage(message, "error");
        }
      }
    } catch (monitoringError) {
      // Silently fail if monitoring is not available
      logger.error("Failed to send to monitoring:", monitoringError);
    }
  }

  /**
   * Performance timing
   */
  time(label: string): void {
    if (this.shouldLog("debug")) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog("debug")) {
      console.timeEnd(label);
    }
  }

  /**
   * Group logs together
   */
  group(label: string): void {
    if (this.shouldLog("info")) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.shouldLog("info")) {
      console.groupEnd();
    }
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Export for testing
export { ProductionLogger };
