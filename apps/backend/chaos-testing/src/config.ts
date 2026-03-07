/**
 * Chaos Testing Configuration
 * 
 * All configuration values with defaults and environment variable overrides
 */

export interface ChaosConfig {
  // Database
  mongodbUri: string;
  redisHost: string;
  redisPort: number;
  apiUrl: string;

  // Load generation
  accounts: number;
  posts: number;
  publishRate: number; // posts per second
  refreshExpiryBurst: number;
  failureRate: number; // 0.0 to 1.0
  durationMinutes: number;

  // Chaos injection
  chaosEnabled: boolean;
  chaosKillWorkerInterval: number; // ms
  chaosRedisDelayRate: number; // 0.0 to 1.0
  chaosRestartRedisInterval: number; // ms
  chaosWorkerCrashRate: number; // 0.0 to 1.0
  chaosPlatform429Rate: number; // 0.0 to 1.0
  chaosPlatform500Rate: number; // 0.0 to 1.0
  chaosNetworkTimeoutRate: number; // 0.0 to 1.0
  chaosTokenCorruptionRate: number; // 0.0 to 1.0
  chaosTokenRevocationRate: number; // 0.0 to 1.0

  // Validation thresholds
  maxRefreshPerSecond: number;
  maxQueueLagSeconds: number;
  maxMemoryGrowthMultiplier: number;
  maxRetryStormThreshold: number;

  // Metrics
  metricsPort: number;
  metricsInterval: number; // ms

  // Reporting
  reportsDir: string;
}

export const config: ChaosConfig = {
  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/chaos-test?authSource=admin',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  apiUrl: process.env.API_URL || 'http://localhost:3000',

  // Load generation
  accounts: parseInt(process.env.ACCOUNTS || '1000'),
  posts: parseInt(process.env.POSTS || '5000'),
  publishRate: parseFloat(process.env.PUBLISH_RATE || '5'),
  refreshExpiryBurst: parseInt(process.env.REFRESH_EXPIRY_BURST || '500'),
  failureRate: parseFloat(process.env.FAILURE_RATE || '0.1'),
  durationMinutes: parseInt(process.env.DURATION_MINUTES || '30'),

  // Chaos injection
  chaosEnabled: process.env.CHAOS_ENABLED === 'true',
  chaosKillWorkerInterval: parseInt(process.env.CHAOS_KILL_WORKER_INTERVAL || '300000'), // 5 minutes
  chaosRedisDelayRate: parseFloat(process.env.CHAOS_REDIS_DELAY_RATE || '0.05'),
  chaosRestartRedisInterval: parseInt(process.env.CHAOS_RESTART_REDIS_INTERVAL || '600000'), // 10 minutes
  chaosWorkerCrashRate: parseFloat(process.env.CHAOS_WORKER_CRASH_RATE || '0.01'),
  chaosPlatform429Rate: parseFloat(process.env.CHAOS_PLATFORM_429_RATE || '0.1'),
  chaosPlatform500Rate: parseFloat(process.env.CHAOS_PLATFORM_500_RATE || '0.05'),
  chaosNetworkTimeoutRate: parseFloat(process.env.CHAOS_NETWORK_TIMEOUT_RATE || '0.05'),
  chaosTokenCorruptionRate: parseFloat(process.env.CHAOS_TOKEN_CORRUPTION_RATE || '0.02'),
  chaosTokenRevocationRate: parseFloat(process.env.CHAOS_TOKEN_REVOCATION_RATE || '0.01'),

  // Validation thresholds
  maxRefreshPerSecond: parseInt(process.env.MAX_REFRESH_PER_SECOND || '50'),
  maxQueueLagSeconds: parseInt(process.env.MAX_QUEUE_LAG_SECONDS || '60'),
  maxMemoryGrowthMultiplier: parseFloat(process.env.MAX_MEMORY_GROWTH_MULTIPLIER || '2.0'),
  maxRetryStormThreshold: parseInt(process.env.MAX_RETRY_STORM_THRESHOLD || '100'),

  // Metrics
  metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
  metricsInterval: parseInt(process.env.METRICS_INTERVAL || '5000'),

  // Reporting
  reportsDir: process.env.REPORTS_DIR || '/app/reports',
};

export function validateConfig(cfg: ChaosConfig): void {
  if (cfg.accounts <= 0) throw new Error('ACCOUNTS must be > 0');
  if (cfg.posts <= 0) throw new Error('POSTS must be > 0');
  if (cfg.publishRate <= 0) throw new Error('PUBLISH_RATE must be > 0');
  if (cfg.failureRate < 0 || cfg.failureRate > 1) throw new Error('FAILURE_RATE must be 0.0-1.0');
  if (cfg.durationMinutes <= 0) throw new Error('DURATION_MINUTES must be > 0');
}
