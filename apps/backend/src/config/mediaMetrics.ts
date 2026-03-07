/**
 * Media Upload Metrics
 * 
 * Prometheus metrics for media upload and processing operations
 */

import { Counter, Histogram, Gauge } from 'prom-client';
import { metricsRegistry } from './metrics';

/**
 * Media Upload Metrics
 */
export const mediaUploadsTotal = new Counter({
  name: 'media_uploads_total',
  help: 'Total number of media uploads',
  labelNames: ['media_type', 'status'],
  registers: [metricsRegistry],
});

export const mediaUploadFailuresTotal = new Counter({
  name: 'media_upload_failures_total',
  help: 'Total number of failed media uploads',
  labelNames: ['media_type', 'error_type'],
  registers: [metricsRegistry],
});

export const mediaUploadDuration = new Histogram({
  name: 'media_upload_duration_ms',
  help: 'Media upload duration in milliseconds',
  labelNames: ['media_type', 'status'],
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000, 60000],
  registers: [metricsRegistry],
});

export const mediaUploadSize = new Histogram({
  name: 'media_upload_size_bytes',
  help: 'Media upload size in bytes',
  labelNames: ['media_type'],
  buckets: [
    10 * 1024, // 10KB
    100 * 1024, // 100KB
    1024 * 1024, // 1MB
    5 * 1024 * 1024, // 5MB
    10 * 1024 * 1024, // 10MB
    50 * 1024 * 1024, // 50MB
    100 * 1024 * 1024, // 100MB
  ],
  registers: [metricsRegistry],
});

export const mediaStorageUsage = new Gauge({
  name: 'media_storage_usage_bytes',
  help: 'Total media storage usage in bytes',
  labelNames: ['workspace_id'],
  registers: [metricsRegistry],
});

export const mediaSignedUrlsGenerated = new Counter({
  name: 'media_signed_urls_generated_total',
  help: 'Total number of signed upload URLs generated',
  labelNames: ['media_type'],
  registers: [metricsRegistry],
});

export const mediaValidationFailures = new Counter({
  name: 'media_validation_failures_total',
  help: 'Total number of media validation failures',
  labelNames: ['validation_type'],
  registers: [metricsRegistry],
});

/**
 * Media Processing Metrics
 */
export const mediaProcessingTotal = new Counter({
  name: 'media_processing_total',
  help: 'Total number of media processing jobs',
  labelNames: ['media_type', 'platform', 'status'],
  registers: [metricsRegistry],
});

export const mediaProcessingSuccess = new Counter({
  name: 'media_processing_success_total',
  help: 'Total number of successful media processing jobs',
  labelNames: ['media_type', 'platform'],
  registers: [metricsRegistry],
});

export const mediaProcessingFailure = new Counter({
  name: 'media_processing_failure_total',
  help: 'Total number of failed media processing jobs',
  labelNames: ['media_type', 'platform', 'error_type'],
  registers: [metricsRegistry],
});

export const mediaProcessingTime = new Histogram({
  name: 'media_processing_time_ms',
  help: 'Media processing time in milliseconds',
  labelNames: ['media_type', 'platform'],
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000, 60000],
  registers: [metricsRegistry],
});

/**
 * Helper Functions
 */

/**
 * Record media upload
 */
export function recordMediaUpload(
  mediaType: string,
  status: 'success' | 'failed',
  durationMs: number,
  sizeBytes: number
): void {
  mediaUploadsTotal.inc({ media_type: mediaType, status });
  mediaUploadDuration.observe({ media_type: mediaType, status }, durationMs);
  mediaUploadSize.observe({ media_type: mediaType }, sizeBytes);
}

/**
 * Record media upload failure
 */
export function recordMediaUploadFailure(mediaType: string, errorType: string): void {
  mediaUploadFailuresTotal.inc({ media_type: mediaType, error_type: errorType });
}

/**
 * Record signed URL generation
 */
export function recordSignedUrlGenerated(mediaType: string): void {
  mediaSignedUrlsGenerated.inc({ media_type: mediaType });
}

/**
 * Record validation failure
 */
export function recordValidationFailure(validationType: string): void {
  mediaValidationFailures.inc({ validation_type: validationType });
}

/**
 * Update storage usage for workspace
 */
export function updateStorageUsage(workspaceId: string, totalBytes: number): void {
  mediaStorageUsage.set({ workspace_id: workspaceId }, totalBytes);
}

/**
 * Record media processing
 */
export function recordMediaProcessing(
  mediaType: string,
  platform: string,
  status: 'success' | 'failed',
  durationMs: number
): void {
  mediaProcessingTotal.inc({ media_type: mediaType, platform, status });
  
  if (status === 'success') {
    mediaProcessingSuccess.inc({ media_type: mediaType, platform });
  }
  
  mediaProcessingTime.observe({ media_type: mediaType, platform }, durationMs);
}

/**
 * Record media processing failure
 */
export function recordMediaProcessingFailure(
  mediaType: string,
  platform: string,
  errorType: string
): void {
  mediaProcessingFailure.inc({ media_type: mediaType, platform, error_type: errorType });
}
