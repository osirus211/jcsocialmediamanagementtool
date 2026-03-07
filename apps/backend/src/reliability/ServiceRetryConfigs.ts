/**
 * ServiceRetryConfigs - Service-specific retry configurations
 * 
 * Defines retry policies tailored for each external service based on:
 * - Service reliability characteristics
 * - Rate limiting behavior
 * - Timeout patterns
 * - Business criticality
 */

import { RetryConfig } from './RetryManager';

export interface ServiceRetryConfigs {
  oauth: RetryConfig;
  mediaUpload: RetryConfig;
  aiCaption: RetryConfig;
  email: RetryConfig;
  socialPublishing: RetryConfig;
  analytics: RetryConfig;
}

/**
 * Default retry configurations for each service
 * 
 * Configuration rationale:
 * - OAuth: Critical for user authentication, moderate retries
 * - Media Upload: Large files, fewer retries with longer delays
 * - AI Caption: High latency service, moderate retries
 * - Email: Non-critical, fewer retries
 * - Social Publishing: Critical for core functionality, aggressive retries
 * - Analytics: Non-critical, minimal retries
 */
export const RETRY_CONFIGS: ServiceRetryConfigs = {
  oauth: {
    maxRetries: 3,
    baseDelayMs: 1000,      // 1 second
    maxDelayMs: 16000,      // 16 seconds max
    backoffMultiplier: 2,   // 1s, 2s, 4s, 8s, 16s
    jitterMs: 100           // ±100ms jitter
  },

  mediaUpload: {
    maxRetries: 2,
    baseDelayMs: 2000,      // 2 seconds (longer for large files)
    maxDelayMs: 8000,       // 8 seconds max
    backoffMultiplier: 2,   // 2s, 4s, 8s
    jitterMs: 200           // ±200ms jitter
  },

  aiCaption: {
    maxRetries: 3,
    baseDelayMs: 1000,      // 1 second
    maxDelayMs: 16000,      // 16 seconds max
    backoffMultiplier: 2,   // 1s, 2s, 4s, 8s, 16s
    jitterMs: 100           // ±100ms jitter
  },

  email: {
    maxRetries: 2,
    baseDelayMs: 1000,      // 1 second
    maxDelayMs: 4000,       // 4 seconds max (non-critical)
    backoffMultiplier: 2,   // 1s, 2s, 4s
    jitterMs: 50            // ±50ms jitter
  },

  socialPublishing: {
    maxRetries: 4,          // More retries for critical functionality
    baseDelayMs: 1000,      // 1 second
    maxDelayMs: 32000,      // 32 seconds max
    backoffMultiplier: 2,   // 1s, 2s, 4s, 8s, 16s, 32s
    jitterMs: 150           // ±150ms jitter
  },

  analytics: {
    maxRetries: 1,          // Minimal retries for non-critical
    baseDelayMs: 2000,      // 2 seconds
    maxDelayMs: 4000,       // 4 seconds max
    backoffMultiplier: 2,   // 2s, 4s
    jitterMs: 100           // ±100ms jitter
  }
};

/**
 * Get retry configuration for a specific service
 */
export function getRetryConfig(service: keyof ServiceRetryConfigs): RetryConfig {
  const config = RETRY_CONFIGS[service];
  if (!config) {
    throw new Error(`No retry configuration found for service: ${service}`);
  }
  return { ...config }; // Return a copy to prevent mutations
}

/**
 * Create a custom retry configuration
 */
export function createRetryConfig(
  maxRetries: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number = 2,
  jitterMs: number = 100
): RetryConfig {
  return {
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    backoffMultiplier,
    jitterMs
  };
}

/**
 * Validate retry configuration
 */
export function validateRetryConfig(config: RetryConfig): void {
  if (config.maxRetries < 0) {
    throw new Error('maxRetries must be non-negative');
  }
  if (config.baseDelayMs <= 0) {
    throw new Error('baseDelayMs must be positive');
  }
  if (config.maxDelayMs < config.baseDelayMs) {
    throw new Error('maxDelayMs must be greater than or equal to baseDelayMs');
  }
  if (config.backoffMultiplier <= 1) {
    throw new Error('backoffMultiplier must be greater than 1');
  }
  if (config.jitterMs && config.jitterMs < 0) {
    throw new Error('jitterMs must be non-negative');
  }
}

/**
 * Service-specific error handling configurations
 */
export const SERVICE_ERROR_CONFIGS = {
  oauth: {
    retryableStatusCodes: [500, 502, 503, 504, 429],
    nonRetryableStatusCodes: [400, 401, 403, 404],
    timeoutMs: 10000
  },
  
  mediaUpload: {
    retryableStatusCodes: [500, 502, 503, 504, 429, 408],
    nonRetryableStatusCodes: [400, 401, 403, 404, 413], // 413 = Payload Too Large
    timeoutMs: 30000 // Longer timeout for file uploads
  },
  
  aiCaption: {
    retryableStatusCodes: [500, 502, 503, 504, 429],
    nonRetryableStatusCodes: [400, 401, 403, 404],
    timeoutMs: 15000
  },
  
  email: {
    retryableStatusCodes: [500, 502, 503, 504, 429],
    nonRetryableStatusCodes: [400, 401, 403, 404],
    timeoutMs: 10000
  },
  
  socialPublishing: {
    retryableStatusCodes: [500, 502, 503, 504, 429],
    nonRetryableStatusCodes: [400, 401, 403, 404],
    timeoutMs: 15000
  },
  
  analytics: {
    retryableStatusCodes: [500, 502, 503, 504, 429],
    nonRetryableStatusCodes: [400, 401, 403, 404],
    timeoutMs: 10000
  }
};

export default RETRY_CONFIGS;