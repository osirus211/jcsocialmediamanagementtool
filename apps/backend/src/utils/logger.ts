import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += `\n${JSON.stringify(metadata, null, 2)}`;
  }
  
  return msg;
});

/**
 * Comprehensive secret masking for logs
 * 
 * Masks sensitive data to prevent token leakage:
 * - Access tokens
 * - Refresh tokens
 * - OAuth secrets
 * - Stripe secrets
 * - API keys
 * - Passwords
 * - Authorization headers
 */
const maskSensitiveData = winston.format((info) => {
  const sensitivePatterns = [
    // Token patterns
    /accessToken/i,
    /refreshToken/i,
    /access_token/i,
    /refresh_token/i,
    /bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,
    
    // Secret patterns
    /secret/i,
    /apiKey/i,
    /api_key/i,
    /privateKey/i,
    /private_key/i,
    
    // Stripe patterns
    /sk_live_/i,
    /sk_test_/i,
    /pk_live_/i,
    /pk_test_/i,
    /stripe/i,
    
    // OAuth patterns
    /client_secret/i,
    /clientSecret/i,
    /oauth/i,
    
    // Auth patterns
    /password/i,
    /authorization/i,
    /auth/i,
    
    // Database patterns
    /connectionString/i,
    /connection_string/i,
    /dbPassword/i,
    /db_password/i,
  ];

  /**
   * Check if a key should be masked
   */
  const shouldMask = (key: string): boolean => {
    return sensitivePatterns.some((pattern) => pattern.test(key));
  };

  /**
   * Mask a string value
   * Shows first 4 and last 4 characters for debugging
   */
  const maskString = (value: string): string => {
    if (value.length <= 8) {
      return '***MASKED***';
    }
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  };

  /**
   * Recursively mask sensitive data in objects
   */
  const maskObject = (obj: any, depth: number = 0): any => {
    // Prevent infinite recursion
    if (depth > 10) return '[MAX_DEPTH]';
    
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => maskObject(item, depth + 1));
    }

    // Handle objects
    const masked: any = {};
    for (const key in obj) {
      if (shouldMask(key)) {
        // Mask the value
        if (typeof obj[key] === 'string') {
          masked[key] = maskString(obj[key]);
        } else {
          masked[key] = '***MASKED***';
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Recursively mask nested objects
        masked[key] = maskObject(obj[key], depth + 1);
      } else {
        // Keep non-sensitive values
        masked[key] = obj[key];
      }
    }
    return masked;
  };

  /**
   * Mask sensitive data in log message
   */
  const maskMessage = (message: string): string => {
    let masked = message;

    // Mask Bearer tokens
    masked = masked.replace(
      /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
      'Bearer ***MASKED***'
    );

    // Mask JWT tokens (3 parts separated by dots)
    masked = masked.replace(
      /eyJ[a-zA-Z0-9\-._~+/]+=*\.eyJ[a-zA-Z0-9\-._~+/]+=*\.[a-zA-Z0-9\-._~+/]+=*/g,
      'eyJ...MASKED...JWT'
    );

    // Mask Stripe keys
    masked = masked.replace(/sk_(live|test)_[a-zA-Z0-9]+/g, 'sk_$1_***MASKED***');
    masked = masked.replace(/pk_(live|test)_[a-zA-Z0-9]+/g, 'pk_$1_***MASKED***');

    // Mask generic secrets (40+ character alphanumeric strings)
    masked = masked.replace(/[a-zA-Z0-9]{40,}/g, (match) => {
      return `${match.substring(0, 4)}...${match.substring(match.length - 4)}`;
    });

    return masked;
  };

  // Mask message
  if (typeof info.message === 'string') {
    info.message = maskMessage(info.message);
  }

  // Mask metadata
  const { level, message, timestamp, stack, ...metadata } = info;
  const maskedMetadata = maskObject(metadata);

  return {
    level,
    message,
    timestamp,
    stack,
    ...maskedMetadata,
  };
});

// Create transports
const transports: winston.transport[] = [];

// Determine logs directory (absolute path for production)
const logsDir = process.env.NODE_ENV === 'production' 
  ? '/app/logs' 
  : path.join(process.cwd(), 'logs');

// Console transport (development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    })
  );
}

// File transport (all logs)
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  })
);

// Error file transport
transports.push(
  new DailyRotateFile({
    level: 'error',
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), maskSensitiveData(), timestamp()),
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logger
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
