/**
 * Analytics Metrics
 * 
 * Prometheus metrics for analytics collection
 */

import { Counter, Histogram, Gauge } from 'prom-client';
import { metricsRegistry } from './metrics';

/**
 * Analytics Collection Metrics
 */
export const analyticsCollectionTotal = new Counter({
  name: 'analytics_collection_total',
  help: 'Total number of analytics collection attempts',
  labelNames: ['platform', 'status'],
  registers: [metricsRegistry],
});

export const analyticsCollectionSuccess = new Counter({
  name: 'analytics_collection_success',
  help: 'Total number of successful analytics collections',
  labelNames: ['platform'],
  registers: [metricsRegistry],
});

export const analyticsCollectionFailure = new Counter({
  name: 'analytics_collection_failure',
  help: 'Total number of failed analytics collections',
  labelNames: ['platform', 'error_type'],
  registers: [metricsRegistry],
});

export const analyticsApiLatency = new Histogram({
  name: 'analytics_api_latency_ms',
  help: 'Latency of analytics API calls in milliseconds',
  labelNames: ['platform'],
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

export const analyticsCollectionAttempt = new Gauge({
  name: 'analytics_collection_attempt',
  help: 'Current collection attempt number',
  labelNames: ['post_id', 'platform'],
  registers: [metricsRegistry],
});

export const analyticsEngagementRate = new Gauge({
  name: 'analytics_engagement_rate',
  help: 'Engagement rate for posts',
  labelNames: ['platform', 'workspace_id'],
  registers: [metricsRegistry],
});

export const analyticsImpressions = new Gauge({
  name: 'analytics_impressions_total',
  help: 'Total impressions for posts',
  labelNames: ['platform', 'workspace_id'],
  registers: [metricsRegistry],
});

export const analyticsLikes = new Gauge({
  name: 'analytics_likes_total',
  help: 'Total likes for posts',
  labelNames: ['platform', 'workspace_id'],
  registers: [metricsRegistry],
});

export const analyticsComments = new Gauge({
  name: 'analytics_comments_total',
  help: 'Total comments for posts',
  labelNames: ['platform', 'workspace_id'],
  registers: [metricsRegistry],
});

export const analyticsShares = new Gauge({
  name: 'analytics_shares_total',
  help: 'Total shares for posts',
  labelNames: ['platform', 'workspace_id'],
  registers: [metricsRegistry],
});

/**
 * Helper Functions
 */

/**
 * Record analytics collection
 */
export function recordAnalyticsCollection(platform: string, status: 'success' | 'failure'): void {
  analyticsCollectionTotal.inc({ platform, status });
  
  if (status === 'success') {
    analyticsCollectionSuccess.inc({ platform });
  } else {
    analyticsCollectionFailure.inc({ platform, error_type: 'unknown' });
  }
}

/**
 * Record analytics API latency
 */
export function recordAnalyticsApiLatency(platform: string, durationMs: number): void {
  analyticsApiLatency.observe({ platform }, durationMs);
}

/**
 * Update engagement metrics
 */
export function updateEngagementMetrics(
  platform: string,
  workspaceId: string,
  metrics: {
    engagementRate: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
  }
): void {
  analyticsEngagementRate.set({ platform, workspace_id: workspaceId }, metrics.engagementRate);
  analyticsImpressions.set({ platform, workspace_id: workspaceId }, metrics.impressions);
  analyticsLikes.set({ platform, workspace_id: workspaceId }, metrics.likes);
  analyticsComments.set({ platform, workspace_id: workspaceId }, metrics.comments);
  analyticsShares.set({ platform, workspace_id: workspaceId }, metrics.shares);
}

/**
 * Record collection attempt
 */
export function recordCollectionAttempt(postId: string, platform: string, attempt: number): void {
  analyticsCollectionAttempt.set({ post_id: postId, platform }, attempt);
}
