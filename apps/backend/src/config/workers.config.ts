import { WorkerConfig } from '../services/WorkerManager';
import { config } from './index';

/**
 * Worker Configuration
 * 
 * Based on SYSTEM_RUNTIME_CLASSIFICATION.md
 * 
 * Categories:
 * - CORE_RUNTIME: Essential for basic SaaS operation (always enabled)
 * - FEATURE_RUNTIME: Required for specific features (configurable via env vars)
 * - OPTIONAL_RUNTIME: Nice-to-have operational features (configurable via env vars)
 * - LEGACY: Deprecated workers (never enabled)
 */

/**
 * Worker configurations
 */
export const workerConfigs: Record<string, WorkerConfig> = {
  // ============================================================================
  // CORE_RUNTIME WORKERS - Always enabled (essential for SaaS operation)
  // ============================================================================

  'scheduler-worker': {
    enabled: true,
    maxRestarts: 5, // Higher restart limit for critical scheduler
    restartDelay: 5000, // 5 seconds
  },

  'facebook-publisher-worker': {
    enabled: true,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'instagram-publisher-worker': {
    enabled: true,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'twitter-publisher-worker': {
    enabled: true,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'linkedin-publisher-worker': {
    enabled: true,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'tiktok-publisher-worker': {
    enabled: true,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'token-refresh-worker': {
    enabled: true,
    maxRestarts: 5, // Higher restart limit for critical token refresh
    restartDelay: 10000, // 10 seconds (longer delay for token refresh)
  },

  'distributed-token-refresh-worker': {
    enabled: true,
    maxRestarts: 5,
    restartDelay: 10000,
  },

  // ============================================================================
  // FEATURE_RUNTIME WORKERS - Enabled by default (configurable via env vars)
  // ============================================================================

  'media-processing-worker': {
    enabled: config.workers.enableMediaProcessing,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'email-worker': {
    enabled: config.workers.enableEmail,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'notification-worker': {
    enabled: config.workers.enableNotifications,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'analytics-collector-worker': {
    enabled: config.workers.enableAnalytics,
    maxRestarts: 3,
    restartDelay: 5000,
  },

  'webhook-delivery-worker': {
    enabled: true, // Default to true
    maxRestarts: 3,
    restartDelay: 5000,
  },

  // ============================================================================
  // OPTIONAL_RUNTIME WORKERS - Enabled by default (configurable via env vars)
  // ============================================================================

  'connection-health-check-worker': {
    enabled: config.workers.enableHealthChecks,
    maxRestarts: 3,
    restartDelay: 30000, // 30 seconds (longer delay for health checks)
  },

  'account-health-check-worker': {
    enabled: config.workers.enableHealthChecks,
    maxRestarts: 3,
    restartDelay: 30000,
  },

  'backup-verification-worker': {
    enabled: config.workers.enableBackups,
    maxRestarts: 3,
    restartDelay: 60000, // 60 seconds (longer delay for backups)
  },

  // ============================================================================
  // LEGACY WORKERS - Never enabled (deprecated)
  // ============================================================================

  'publishing-worker': {
    enabled: false, // DEPRECATED: Replaced by platform-specific workers
    maxRestarts: 0,
    restartDelay: 0,
  },

  'post-publishing-worker': {
    enabled: false, // TRANSITIONAL: Needs audit to confirm if still used
    maxRestarts: 0,
    restartDelay: 0,
  },
};

/**
 * Get configuration for a specific worker
 */
export function getWorkerConfig(workerName: string): WorkerConfig {
  const config = workerConfigs[workerName];
  
  if (!config) {
    // Default configuration for unknown workers
    return {
      enabled: false,
      maxRestarts: 3,
      restartDelay: 5000,
    };
  }

  return config;
}

/**
 * Get all enabled worker names
 */
export function getEnabledWorkers(): string[] {
  return Object.entries(workerConfigs)
    .filter(([_, config]) => config.enabled)
    .map(([name, _]) => name);
}

/**
 * Get worker configuration summary for logging
 */
export function getConfigSummary(): {
  total: number;
  enabled: number;
  disabled: number;
  coreRuntime: number;
  featureRuntime: number;
  optionalRuntime: number;
  legacy: number;
} {
  const coreWorkers = [
    'scheduler-worker',
    'facebook-publisher-worker',
    'instagram-publisher-worker',
    'twitter-publisher-worker',
    'linkedin-publisher-worker',
    'tiktok-publisher-worker',
    'token-refresh-worker',
    'distributed-token-refresh-worker',
  ];

  const featureWorkers = [
    'media-processing-worker',
    'email-worker',
    'notification-worker',
    'analytics-collector-worker',
  ];

  const optionalWorkers = [
    'connection-health-check-worker',
    'account-health-check-worker',
    'backup-verification-worker',
  ];

  const legacyWorkers = [
    'publishing-worker',
    'post-publishing-worker',
  ];

  const allWorkers = Object.entries(workerConfigs);
  const enabledWorkers = allWorkers.filter(([_, config]) => config.enabled);

  return {
    total: allWorkers.length,
    enabled: enabledWorkers.length,
    disabled: allWorkers.length - enabledWorkers.length,
    coreRuntime: coreWorkers.filter(name => workerConfigs[name]?.enabled).length,
    featureRuntime: featureWorkers.filter(name => workerConfigs[name]?.enabled).length,
    optionalRuntime: optionalWorkers.filter(name => workerConfigs[name]?.enabled).length,
    legacy: legacyWorkers.filter(name => workerConfigs[name]?.enabled).length,
  };
}

/**
 * Environment variable documentation
 */
export const ENV_VAR_DOCS = `
Worker Configuration Environment Variables:

CORE_RUNTIME (always enabled, cannot be disabled):
  - scheduler-worker
  - facebook-publisher-worker
  - instagram-publisher-worker
  - twitter-publisher-worker
  - linkedin-publisher-worker
  - tiktok-publisher-worker
  - token-refresh-worker
  - distributed-token-refresh-worker

FEATURE_RUNTIME (enabled by default, configurable):
  ENABLE_MEDIA_PROCESSING=true|false  (default: true)
  ENABLE_EMAIL=true|false             (default: true)
  ENABLE_NOTIFICATIONS=true|false     (default: true)
  ENABLE_ANALYTICS=true|false         (default: true)

OPTIONAL_RUNTIME (enabled by default, configurable):
  ENABLE_HEALTH_CHECKS=true|false     (default: true)
  ENABLE_BACKUPS=true|false           (default: true)

LEGACY (never enabled):
  - publishing-worker (deprecated)
  - post-publishing-worker (transitional)

Example - Minimal Production Configuration:
  # Only core workers (8 workers)
  ENABLE_MEDIA_PROCESSING=false
  ENABLE_EMAIL=false
  ENABLE_NOTIFICATIONS=false
  ENABLE_ANALYTICS=false
  ENABLE_HEALTH_CHECKS=false
  ENABLE_BACKUPS=false

Example - Full Production Configuration:
  # All workers enabled (13 workers)
  ENABLE_MEDIA_PROCESSING=true
  ENABLE_EMAIL=true
  ENABLE_NOTIFICATIONS=true
  ENABLE_ANALYTICS=true
  ENABLE_HEALTH_CHECKS=true
  ENABLE_BACKUPS=true

Example - Development Configuration:
  # Core + essential features (10 workers)
  ENABLE_MEDIA_PROCESSING=true
  ENABLE_EMAIL=true
  ENABLE_NOTIFICATIONS=false
  ENABLE_ANALYTICS=false
  ENABLE_HEALTH_CHECKS=false
  ENABLE_BACKUPS=false
`;
