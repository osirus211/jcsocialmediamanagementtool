/**
 * Backpressure Monitoring Configuration
 * 
 * Defines thresholds for critical queues based on SYSTEM_RUNTIME_CLASSIFICATION.md
 */

import { QueueBackpressureConfig } from '../services/monitoring/QueueBackpressureMonitor';

/**
 * Backpressure configurations for critical queues
 * 
 * Thresholds are tuned based on queue type and expected load:
 * - Publishing queues: Lower thresholds (high priority)
 * - Scheduler queue: Very low threshold (critical path)
 * - Token refresh: Medium threshold (background task)
 * - Media/Email: Higher threshold (can tolerate backlog)
 */
export const backpressureConfigs: Record<string, QueueBackpressureConfig> = {
  // CRITICAL: Scheduler queue (lowest threshold - must process quickly)
  'scheduler-queue': {
    enabled: true,
    pollInterval: 30000, // 30 seconds
    queueName: 'scheduler-queue',
    waitingJobsThreshold: 100,  // Alert if >100 waiting (should be near-zero)
    growthRateThreshold: 5,     // Alert if growing >5 jobs/second
    jobTimeThreshold: 30,       // Alert if avg job time >30s
    failureRateThreshold: 2,    // Alert if failure rate >2%
    backlogAgeThreshold: 120,   // Alert if backlog >2 minutes old
    stalledThreshold: 50,       // Alert if >50 waiting but 0 active
  },

  // CRITICAL: Platform publishing queues (medium threshold)
  'facebook-publish-queue': {
    enabled: true,
    pollInterval: 30000,
    queueName: 'facebook-publish-queue',
    waitingJobsThreshold: 500,
    growthRateThreshold: 10,
    jobTimeThreshold: 60,
    failureRateThreshold: 5,
    backlogAgeThreshold: 300,   // 5 minutes
    stalledThreshold: 100,
  },

  'instagram-publish-queue': {
    enabled: true,
    pollInterval: 30000,
    queueName: 'instagram-publish-queue',
    waitingJobsThreshold: 500,
    growthRateThreshold: 10,
    jobTimeThreshold: 60,
    failureRateThreshold: 5,
    backlogAgeThreshold: 300,
    stalledThreshold: 100,
  },

  'twitter-publish-queue': {
    enabled: true,
    pollInterval: 30000,
    queueName: 'twitter-publish-queue',
    waitingJobsThreshold: 500,
    growthRateThreshold: 10,
    jobTimeThreshold: 60,
    failureRateThreshold: 5,
    backlogAgeThreshold: 300,
    stalledThreshold: 100,
  },

  'linkedin-publish-queue': {
    enabled: true,
    pollInterval: 30000,
    queueName: 'linkedin-publish-queue',
    waitingJobsThreshold: 500,
    growthRateThreshold: 10,
    jobTimeThreshold: 60,
    failureRateThreshold: 5,
    backlogAgeThreshold: 300,
    stalledThreshold: 100,
  },

  'tiktok-publish-queue': {
    enabled: true,
    pollInterval: 30000,
    queueName: 'tiktok-publish-queue',
    waitingJobsThreshold: 500,
    growthRateThreshold: 10,
    jobTimeThreshold: 60,
    failureRateThreshold: 5,
    backlogAgeThreshold: 300,
    stalledThreshold: 100,
  },

  // CRITICAL: Token refresh queue (medium threshold - background but critical)
  'token-refresh-queue': {
    enabled: true,
    pollInterval: 60000, // 1 minute (less frequent)
    queueName: 'token-refresh-queue',
    waitingJobsThreshold: 1000,
    growthRateThreshold: 20,
    jobTimeThreshold: 120,
    failureRateThreshold: 10,
    backlogAgeThreshold: 600,   // 10 minutes
    stalledThreshold: 200,
  },

  // HIGH: Media processing queue (higher threshold - can tolerate backlog)
  'media-processing-queue': {
    enabled: true,
    pollInterval: 60000,
    queueName: 'media-processing-queue',
    waitingJobsThreshold: 1000,
    growthRateThreshold: 20,
    jobTimeThreshold: 180,
    failureRateThreshold: 10,
    backlogAgeThreshold: 900,   // 15 minutes
    stalledThreshold: 200,
  },

  // HIGH: Email queue (medium threshold - important but not critical)
  'email-queue': {
    enabled: true,
    pollInterval: 60000,
    queueName: 'email-queue',
    waitingJobsThreshold: 500,
    growthRateThreshold: 10,
    jobTimeThreshold: 60,
    failureRateThreshold: 5,
    backlogAgeThreshold: 300,
    stalledThreshold: 100,
  },

  // MEDIUM: Analytics queue (higher threshold - background task)
  'analytics-collection-queue': {
    enabled: true,
    pollInterval: 120000, // 2 minutes (less frequent)
    queueName: 'analytics-collection-queue',
    waitingJobsThreshold: 2000,
    growthRateThreshold: 30,
    jobTimeThreshold: 300,
    failureRateThreshold: 15,
    backlogAgeThreshold: 1800,  // 30 minutes
    stalledThreshold: 500,
  },

  // MEDIUM: Notification queue (higher threshold - nice-to-have)
  'notification-queue': {
    enabled: true,
    pollInterval: 120000,
    queueName: 'notification-queue',
    waitingJobsThreshold: 1000,
    growthRateThreshold: 20,
    jobTimeThreshold: 120,
    failureRateThreshold: 10,
    backlogAgeThreshold: 600,
    stalledThreshold: 200,
  },
};

/**
 * Get all enabled backpressure configs
 */
export function getEnabledBackpressureConfigs(): QueueBackpressureConfig[] {
  return Object.values(backpressureConfigs).filter(config => config.enabled);
}

/**
 * Get config for specific queue
 */
export function getBackpressureConfig(queueName: string): QueueBackpressureConfig | undefined {
  return backpressureConfigs[queueName];
}

/**
 * Get critical queue names (for priority monitoring)
 */
export function getCriticalQueueNames(): string[] {
  return [
    'scheduler-queue',
    'facebook-publish-queue',
    'instagram-publish-queue',
    'twitter-publish-queue',
    'linkedin-publish-queue',
    'tiktok-publish-queue',
    'token-refresh-queue',
  ];
}

/**
 * Environment variable documentation
 */
export const BACKPRESSURE_ENV_DOCS = `
Backpressure Monitoring Configuration:

All backpressure monitors are enabled by default for critical queues.
To disable monitoring for a specific queue, set:

  DISABLE_BACKPRESSURE_MONITORING=true

To adjust thresholds globally (affects all queues):

  BACKPRESSURE_WAITING_JOBS_MULTIPLIER=1.5    # Multiply all waiting job thresholds by 1.5
  BACKPRESSURE_GROWTH_RATE_MULTIPLIER=1.5     # Multiply all growth rate thresholds by 1.5
  BACKPRESSURE_FAILURE_RATE_MULTIPLIER=1.5    # Multiply all failure rate thresholds by 1.5

Example - More Aggressive Monitoring (lower thresholds):
  BACKPRESSURE_WAITING_JOBS_MULTIPLIER=0.5
  BACKPRESSURE_GROWTH_RATE_MULTIPLIER=0.5
  BACKPRESSURE_FAILURE_RATE_MULTIPLIER=0.5

Example - More Relaxed Monitoring (higher thresholds):
  BACKPRESSURE_WAITING_JOBS_MULTIPLIER=2.0
  BACKPRESSURE_GROWTH_RATE_MULTIPLIER=2.0
  BACKPRESSURE_FAILURE_RATE_MULTIPLIER=2.0
`;
