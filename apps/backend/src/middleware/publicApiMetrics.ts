/**
 * Public API Metrics Middleware
 * 
 * Tracks metrics for the Public API layer
 * 
 * Features:
 * - Request counting by endpoint, method, status
 * - Latency tracking
 * - Error tracking
 * - Rate limit hit tracking
 * - Authentication failure tracking
 * - Scope denial tracking
 * - Per-workspace and per-API-key metrics
 * 
 * Security:
 * - NEVER logs or exposes raw API keys
 * - Only uses apiKeyId and workspaceId for tracking
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface PublicApiMetrics {
  // Request counters
  public_api_requests_total: number;
  public_api_errors_total: number;
  public_api_rate_limit_hits: number;
  public_api_auth_failures: number;
  public_api_scope_denials: number;
  
  // Latency tracking
  public_api_latency_sum_ms: number;
  public_api_latency_count: number;
  
  // Per-endpoint metrics
  requests_by_endpoint: Map<string, number>;
  errors_by_endpoint: Map<string, number>;
  latency_by_endpoint: Map<string, { sum: number; count: number }>;
  
  // Per-method metrics
  requests_by_method: Map<string, number>;
  
  // Per-status metrics
  requests_by_status: Map<number, number>;
  
  // Per-workspace metrics
  requests_by_workspace: Map<string, number>;
  
  // Per-API-key metrics (using keyId, NOT raw key)
  requests_by_api_key: Map<string, number>;
  errors_by_api_key: Map<string, number>;
}

export class PublicApiMetricsTracker {
  private metrics: PublicApiMetrics = {
    public_api_requests_total: 0,
    public_api_errors_total: 0,
    public_api_rate_limit_hits: 0,
    public_api_auth_failures: 0,
    public_api_scope_denials: 0,
    public_api_latency_sum_ms: 0,
    public_api_latency_count: 0,
    requests_by_endpoint: new Map(),
    errors_by_endpoint: new Map(),
    latency_by_endpoint: new Map(),
    requests_by_method: new Map(),
    requests_by_status: new Map(),
    requests_by_workspace: new Map(),
    requests_by_api_key: new Map(),
    errors_by_api_key: new Map(),
  };

  /**
   * Increment request counter
   * SECURITY: Only uses apiKeyId, never raw key
   */
  incrementRequest(
    endpoint: string,
    method: string,
    workspaceId: string,
    apiKeyId: string
  ): void {
    this.metrics.public_api_requests_total++;
    
    // By endpoint
    this.metrics.requests_by_endpoint.set(
      endpoint,
      (this.metrics.requests_by_endpoint.get(endpoint) || 0) + 1
    );
    
    // By method
    this.metrics.requests_by_method.set(
      method,
      (this.metrics.requests_by_method.get(method) || 0) + 1
    );
    
    // By workspace
    this.metrics.requests_by_workspace.set(
      workspaceId,
      (this.metrics.requests_by_workspace.get(workspaceId) || 0) + 1
    );
    
    // By API key (using keyId only)
    this.metrics.requests_by_api_key.set(
      apiKeyId,
      (this.metrics.requests_by_api_key.get(apiKeyId) || 0) + 1
    );
  }

  /**
   * Increment error counter
   */
  incrementError(endpoint: string, apiKeyId: string): void {
    this.metrics.public_api_errors_total++;
    
    // By endpoint
    this.metrics.errors_by_endpoint.set(
      endpoint,
      (this.metrics.errors_by_endpoint.get(endpoint) || 0) + 1
    );
    
    // By API key
    this.metrics.errors_by_api_key.set(
      apiKeyId,
      (this.metrics.errors_by_api_key.get(apiKeyId) || 0) + 1
    );
  }

  /**
   * Increment rate limit hit counter
   */
  incrementRateLimitHit(): void {
    this.metrics.public_api_rate_limit_hits++;
  }

  /**
   * Increment authentication failure counter
   */
  incrementAuthFailure(): void {
    this.metrics.public_api_auth_failures++;
  }

  /**
   * Increment scope denial counter
   */
  incrementScopeDenial(): void {
    this.metrics.public_api_scope_denials++;
  }

  /**
   * Record request latency
   */
  recordLatency(endpoint: string, latencyMs: number): void {
    // Overall latency
    this.metrics.public_api_latency_sum_ms += latencyMs;
    this.metrics.public_api_latency_count++;
    
    // Per-endpoint latency
    const endpointLatency = this.metrics.latency_by_endpoint.get(endpoint) || {
      sum: 0,
      count: 0,
    };
    endpointLatency.sum += latencyMs;
    endpointLatency.count++;
    this.metrics.latency_by_endpoint.set(endpoint, endpointLatency);
  }

  /**
   * Record response status
   */
  recordStatus(status: number): void {
    this.metrics.requests_by_status.set(
      status,
      (this.metrics.requests_by_status.get(status) || 0) + 1
    );
  }

  /**
   * Get all metrics
   */
  getMetrics(): PublicApiMetrics {
    return {
      ...this.metrics,
      requests_by_endpoint: new Map(this.metrics.requests_by_endpoint),
      errors_by_endpoint: new Map(this.metrics.errors_by_endpoint),
      latency_by_endpoint: new Map(this.metrics.latency_by_endpoint),
      requests_by_method: new Map(this.metrics.requests_by_method),
      requests_by_status: new Map(this.metrics.requests_by_status),
      requests_by_workspace: new Map(this.metrics.requests_by_workspace),
      requests_by_api_key: new Map(this.metrics.requests_by_api_key),
      errors_by_api_key: new Map(this.metrics.errors_by_api_key),
    };
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    if (this.metrics.public_api_latency_count === 0) {
      return 0;
    }
    return this.metrics.public_api_latency_sum_ms / this.metrics.public_api_latency_count;
  }

  /**
   * Get average latency for specific endpoint
   */
  getEndpointAverageLatency(endpoint: string): number {
    const latency = this.metrics.latency_by_endpoint.get(endpoint);
    if (!latency || latency.count === 0) {
      return 0;
    }
    return latency.sum / latency.count;
  }
}

// Singleton instance
export const publicApiMetricsTracker = new PublicApiMetricsTracker();

/**
 * Middleware to track Public API requests
 * 
 * SECURITY: Never logs raw API keys
 */
export const publicApiMetricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only track metrics for public API routes
  if (!req.path.startsWith('/api/public/')) {
    return next();
  }

  const startTime = Date.now();

  // Extract endpoint (normalize to remove IDs)
  const endpoint = normalizeEndpoint(req.path);
  const method = req.method;

  // Track request if API key is present
  if (req.apiKey) {
    const workspaceId = req.apiKey.workspaceId;
    const apiKeyId = req.apiKey.keyId; // SECURITY: Use keyId, not raw key

    publicApiMetricsTracker.incrementRequest(
      endpoint,
      method,
      workspaceId,
      apiKeyId
    );
  }

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const latencyMs = Date.now() - startTime;
    const status = res.statusCode;

    // Record latency
    publicApiMetricsTracker.recordLatency(endpoint, latencyMs);

    // Record status
    publicApiMetricsTracker.recordStatus(status);

    // Track errors (4xx and 5xx)
    if (status >= 400 && req.apiKey) {
      publicApiMetricsTracker.incrementError(endpoint, req.apiKey.keyId);
    }

    // Log slow requests (> 1 second)
    if (latencyMs > 1000) {
      logger.warn('Slow public API request', {
        endpoint,
        method,
        latencyMs,
        status,
        workspaceId: req.apiKey?.workspaceId,
        apiKeyId: req.apiKey?.keyId, // SECURITY: Log keyId, not raw key
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Normalize endpoint by removing IDs
 * Example: /api/public/v1/posts/123 -> /api/public/v1/posts/:id
 */
function normalizeEndpoint(path: string): string {
  return path
    .replace(/\/[0-9a-f]{24}/gi, '/:id') // MongoDB ObjectIds
    .replace(/\/\d+/g, '/:id') // Numeric IDs
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id'); // UUIDs
}
