/**
 * OpenTelemetry Configuration
 * 
 * Provides distributed tracing across:
 * - OAuth flows
 * - Token refresh workers
 * - Webhook ingestion
 * - Queue processing workers
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { logger } from '../utils/logger';

const SERVICE_NAME = 'social-media-scheduler';
const SERVICE_VERSION = '1.0.0';

/**
 * Initialize OpenTelemetry SDK
 */
export function initTelemetry(): NodeSDK | null {
  // Only enable in production or when explicitly enabled
  const telemetryEnabled = process.env.TELEMETRY_ENABLED === 'true';
  
  if (!telemetryEnabled) {
    logger.info('OpenTelemetry disabled');
    return null;
  }

  try {
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    });

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
        [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      }),
      spanProcessor: new BatchSpanProcessor(jaegerExporter),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable file system instrumentation (too noisy)
          },
        }),
      ],
    });

    sdk.start();

    logger.info('OpenTelemetry initialized', {
      serviceName: SERVICE_NAME,
      serviceVersion: SERVICE_VERSION,
      jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => logger.info('OpenTelemetry shut down'))
        .catch((error) => logger.error('Error shutting down OpenTelemetry', error));
    });

    return sdk;
  } catch (error: any) {
    logger.error('Failed to initialize OpenTelemetry', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Get tracer instance
 */
export function getTracer() {
  return trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
}

/**
 * Create a new span
 */
export function startSpan(name: string, attributes?: Record<string, any>): Span {
  const tracer = getTracer();
  return tracer.startSpan(name, {
    attributes,
  });
}

/**
 * Execute function within a span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const span = startSpan(name, attributes);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error: any) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Get current trace ID
 */
export function getTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;

  const spanContext = span.spanContext();
  return spanContext.traceId;
}

/**
 * Add attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, any>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record exception in current span
 */
export function recordSpanException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}
