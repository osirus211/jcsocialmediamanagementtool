/**
 * Frontend Logger
 * 
 * Centralized logging utility for frontend application
 * Replaces console.log calls with structured logging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context || '');
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void {
    console.error(`[ERROR] ${message}`, context || '');
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Generic log method
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case 'info':
        this.info(message, context);
        break;
      case 'warn':
        this.warn(message, context);
        break;
      case 'error':
        this.error(message, context);
        break;
      case 'debug':
        this.debug(message, context);
        break;
    }
  }
}

export const logger = new Logger();
