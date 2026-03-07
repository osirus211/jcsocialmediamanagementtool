/**
 * Tracing Middleware
 * 
 * Attaches trace ID to every HTTP request and propagates context
 */

import { Request, Response, NextFunction } from 'express';
import { getTracer, getTraceId, addSpanAttributes } from '../config/telemetry';
import { context, trace } from '@opentelemetry/api';
import { logger } from '../utils/logger';

/**
 * Express middleware to create a span for each request
 */
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tracer = getTracer();

  // Create span for this request
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.path': req.path,
      'http.user_agent': req.headers['user-agent'] || 'unknown',
      'http.client_ip': req.ip || 'unknown',
    },
  });

  // Get trace ID and attach to request
  const traceId = span.spanContext().traceId;
  (req as any).traceId = traceId;

  // Add trace ID to response headers
  res.setHeader('X-Trace-Id', traceId);

  // Log request with trace ID
  logger.info('HTTP request', {
    method: req.method,
    path: req.path,
    traceId,
    ip: req.ip,
  });

  // Capture response status
  const originalSend = res.send;
  res.send = function (data: any) {
    span.setAttribute('http.status_code', res.statusCode);
    
    if (res.statusCode >= 400) {
      span.setStatus({
        code: 2, // ERROR
        message: `HTTP ${res.statusCode}`,
      });
    } else {
      span.setStatus({ code: 1 }); // OK
    }

    span.end();
    return originalSend.call(this, data);
  };

  // Execute request within span context
  context.with(trace.setSpan(context.active(), span), () => {
    next();
  });
}

/**
 * Get trace ID from request
 */
export function getRequestTraceId(req: Request): string | undefined {
  return (req as any).traceId || getTraceId();
}

/**
 * Add trace context to BullMQ job data
 */
export function addTraceContextToJob(jobData: any): any {
  const traceId = getTraceId();
  
  return {
    ...jobData,
    _traceContext: {
      traceId,
      timestamp: Date.now(),
    },
  };
}

/**
 * Extract trace context from BullMQ job data
 */
export function extractTraceContextFromJob(jobData: any): {
  traceId?: string;
  timestamp?: number;
} {
  return jobData._traceContext || {};
}

/**
 * Create span for BullMQ job processing
 */
export function createJobSpan(
  jobName: string,
  jobId: string,
  jobData: any
): void {
  const tracer = getTracer();
  const traceContext = extractTraceContextFromJob(jobData);

  const span = tracer.startSpan(`job:${jobName}`, {
    attributes: {
      'job.name': jobName,
      'job.id': jobId,
      'job.trace_id': traceContext.traceId || 'unknown',
      'job.timestamp': traceContext.timestamp || Date.now(),
    },
  });

  // Set span as active
  context.with(trace.setSpan(context.active(), span), () => {
    // Span will be active during job processing
  });

  return span as any;
}
