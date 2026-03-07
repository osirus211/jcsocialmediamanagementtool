import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      ),
    }),
    new winston.transports.File({
      filename: '/app/reports/chaos-test.log',
      format: logFormat,
    }),
  ],
});

export function logMetric(metric: string, value: number, tags: Record<string, any> = {}): void {
  logger.info('METRIC', {
    metric,
    value,
    ...tags,
    timestamp: new Date().toISOString(),
  });
}

export function logEvent(event: string, data: Record<string, any> = {}): void {
  logger.info('EVENT', {
    event,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export function logError(error: Error, context: Record<string, any> = {}): void {
  logger.error('ERROR', {
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
  });
}
