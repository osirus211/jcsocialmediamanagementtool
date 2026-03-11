import dotenv from 'dotenv';
import { z } from 'zod';
import { validateOAuthConfigAtStartup } from './validateOAuthEnv';

dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  API_URL: z.string().url().optional(),

  // Validation Mode (testing only)
  VALIDATION_MODE: z.string().transform(val => val === 'true').default('false'),

  // Database
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  MONGODB_TEST_URI: z.string().optional(),
  MONGODB_URI_TEST: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TEST_DB: z.string().transform(Number).default('1'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  
  // Social Media OAuth
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  TWITTER_CALLBACK_URL: z.string().url().optional(),
  TWITTER_CONSUMER_SECRET: z.string().optional(),
  TWITTER_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_CALLBACK_URL: z.string().url().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_REDIRECT_URI: z.string().url().optional(),
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  INSTAGRAM_CALLBACK_URL: z.string().url().optional(),
  INSTAGRAM_REDIRECT_URI: z.string().url().optional(),
  
  // Instagram Basic Display API
  INSTAGRAM_BASIC_APP_ID: z.string().optional(),
  INSTAGRAM_BASIC_APP_SECRET: z.string().optional(),
  INSTAGRAM_BASIC_REDIRECT_URI: z.string().url().optional(),
  USE_INSTAGRAM_PROFESSIONAL: z.string().transform(val => val === 'true').default('false'),
  
  // Google Business Profile
  GOOGLE_BUSINESS_CLIENT_ID: z.string().optional(),
  GOOGLE_BUSINESS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_BUSINESS_REDIRECT_URI: z.string().url().optional(),
  
  // TikTok
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_CALLBACK_URL: z.string().url().optional(),
  THREADS_CLIENT_ID: z.string().optional(),
  THREADS_CLIENT_SECRET: z.string().optional(),
  THREADS_CALLBACK_URL: z.string().url().optional(),

  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'mock']).default('mock'),
  AI_MODEL: z.string().optional(),
  AI_MAX_TOKENS: z.string().transform(Number).default('500'),
  AI_TEMPERATURE: z.string().transform(Number).default('0.7'),
  AI_TIMEOUT: z.string().transform(Number).default('30000'),

  // Stock Photo APIs
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_SECRET_NAME: z.string().optional(),

  // Storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),
  LOCAL_STORAGE_URL: z.string().url().default('http://localhost:3000/uploads'),
  CDN_URL: z.string().url().optional(),
  CDN_BASE_URL: z.string().url().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be 64 hex characters (32 bytes)'),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@example.com'),
  APP_URL: z.string().url().optional(),

  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().optional(),

  // Feature Flags
  TRANSACTION_ENABLED: z.string().transform(val => val !== 'false').default('true'),
  QUEUE_LIMITS_ENABLED: z.string().transform(val => val !== 'false').default('true'),
  IDEMPOTENCY_ENABLED: z.string().transform(val => val !== 'false').default('true'),
  IDEMPOTENCY_FALLBACK_TO_MEMORY: z.string().transform(val => val !== 'false').default('true'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Alerting
  ALERTING_ENABLED: z.string().transform(val => val === 'true').default('false'),
  ALERTING_COOLDOWN_MINUTES: z.string().transform(Number).default('30'),
  ALERTING_WEBHOOK_URL: z.string().url().optional(),
  ALERTING_WEBHOOK_FORMAT: z.enum(['slack', 'discord', 'generic']).default('slack'),
  ALERTING_MEMORY_THRESHOLD: z.string().transform(Number).default('90'),
  ALERTING_QUEUE_FAILURE_RATE_THRESHOLD: z.string().transform(Number).default('20'),
  ALERTING_DLQ_THRESHOLD: z.string().transform(Number).default('10'),
  ALERTING_POLL_INTERVAL: z.string().transform(Number).default('60000'),

  // Backup Configuration
  BACKUP_ENABLED: z.string().transform(val => val === 'true').default('false'),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'), // 2 AM daily
  BACKUP_RETENTION_DAYS: z.string().transform(Number).default('14'),
  BACKUP_LOCAL_PATH: z.string().default('/backups/mongodb'),
  BACKUP_PATH: z.string().default('./backups'),
  BACKUP_VERIFICATION_INTERVAL_HOURS: z.string().transform(Number).default('24'),
  BACKUP_VERIFICATION_TIMEOUT_MS: z.string().transform(Number).default('300000'),
  MAX_BACKUP_AGE_HOURS: z.string().transform(Number).default('48'),
  BACKUP_S3_BUCKET: z.string().optional(),
  BACKUP_S3_REGION: z.string().default('us-east-1'),
  BACKUP_S3_PREFIX: z.string().default('mongodb-backups'),
  BACKUP_COMPRESSION_ENABLED: z.string().transform(val => val === 'true').default('true'),
  BACKUP_VERIFY_AFTER_BACKUP: z.string().transform(val => val === 'true').default('true'),

  // Queue Backpressure Monitoring
  BACKPRESSURE_ENABLED: z.string().transform(val => val === 'true').default('true'),
  BACKPRESSURE_POLL_INTERVAL: z.string().transform(Number).default('30000'),
  BACKPRESSURE_WAITING_THRESHOLD: z.string().transform(Number).default('50'),
  BACKPRESSURE_GROWTH_RATE_THRESHOLD: z.string().transform(Number).default('5'),
  BACKPRESSURE_JOBTIME_THRESHOLD: z.string().transform(Number).default('300'),
  BACKPRESSURE_FAILURE_RATE_THRESHOLD: z.string().transform(Number).default('15'),
  BACKPRESSURE_AGE_THRESHOLD: z.string().transform(Number).default('600'),
  BACKPRESSURE_STALLED_THRESHOLD: z.string().transform(Number).default('10'),

  // DLQ Replay
  DLQ_REPLAY_ENABLED: z.string().transform(val => val === 'true').default('true'),
  DLQ_REPLAY_BATCH_SIZE: z.string().transform(Number).default('10'),
  DLQ_REPLAY_SKIP_PUBLISHED: z.string().transform(val => val === 'true').default('true'),
  DLQ_REPLAY_DRY_RUN: z.string().transform(val => val === 'true').default('false'),

  // Feature Flags
  GRACEFUL_DEGRADATION_ENABLED: z.string().transform(val => val === 'true').default('false'),

  // Distributed Locking
  DISTRIBUTED_LOCK_ENABLED: z.string().transform(val => val !== 'false').default('true'),
  DISTRIBUTED_LOCK_FALLBACK_ENABLED: z.string().transform(val => val !== 'false').default('true'),

  // Worker Configuration
  WORKER_CONCURRENCY: z.string().transform(Number).default('5'),

  // API Keys
  API_KEY_MAX_PER_WORKSPACE: z.string().transform(Number).default('10'),
  API_KEY_DEFAULT_RATE_LIMIT: z.string().transform(Number).default('1000'),
  API_KEY_DEFAULT_WINDOW_MS: z.string().transform(Number).default('3600000'),
  API_KEY_CACHE_TTL_SECONDS: z.string().transform(Number).default('300'),
  WORKSPACE_API_KEY_RATE_LIMIT: z.string().transform(Number).default('5000'),

  // Test Configuration
  TEST_DB_NAME: z.string().default('social-media-test'),
  TEST_REDIS_NAMESPACE: z.string().default('test'),
  SUPPRESS_LOGS: z.string().transform(val => val === 'true').default('false'),

  // Resilience Configuration - Load Thresholds
  LOAD_THRESHOLD_LOW_TO_ELEVATED_ENTER: z.string().transform(Number).default('45'),
  LOAD_THRESHOLD_ELEVATED_TO_HIGH_ENTER: z.string().transform(Number).default('65'),
  LOAD_THRESHOLD_HIGH_TO_CRITICAL_ENTER: z.string().transform(Number).default('85'),
  LOAD_THRESHOLD_ELEVATED_TO_LOW_EXIT: z.string().transform(Number).default('35'),
  LOAD_THRESHOLD_HIGH_TO_ELEVATED_EXIT: z.string().transform(Number).default('55'),
  LOAD_THRESHOLD_CRITICAL_TO_HIGH_EXIT: z.string().transform(Number).default('75'),

  // Resilience Configuration - Load Weights
  LOAD_WEIGHT_QUEUE_DEPTH: z.string().transform(Number).default('0.3'),
  LOAD_WEIGHT_RETRY_RATE: z.string().transform(Number).default('0.3'),
  LOAD_WEIGHT_RATE_LIMIT: z.string().transform(Number).default('0.2'),
  LOAD_WEIGHT_REFRESH_BACKLOG: z.string().transform(Number).default('0.2'),

  // Resilience Configuration - Publish Pacing
  PUBLISH_CONCURRENCY_NORMAL: z.string().transform(Number).default('5'),
  PUBLISH_CONCURRENCY_ELEVATED: z.string().transform(Number).default('4'),
  PUBLISH_CONCURRENCY_HIGH: z.string().transform(Number).default('2'),
  PUBLISH_CONCURRENCY_CRITICAL: z.string().transform(Number).default('0'),
  PUBLISH_DELAY_NON_CRITICAL_MS: z.string().transform(Number).default('0'),

  // Resilience Configuration - Refresh Throttle
  REFRESH_MAX_PER_SEC_PER_PLATFORM: z.string().transform(Number).default('10'),
  REFRESH_JITTER_MS: z.string().transform(Number).default('1000'),
  REFRESH_PRIORITY_THRESHOLD_HOURS: z.string().transform(Number).default('1'),
  REFRESH_HIGH_LOAD_THRESHOLD_MIN: z.string().transform(Number).default('30'),
  REFRESH_CRITICAL_LOAD_THRESHOLD_MIN: z.string().transform(Number).default('10'),

  // Resilience Configuration - Admission Control
  ADMISSION_ENABLE_REJECTION: z.string().transform(val => val !== 'false').default('true'),
  ADMISSION_ENABLE_DELAY: z.string().transform(val => val !== 'false').default('true'),
  ADMISSION_RETRY_AFTER_SEC: z.string().transform(Number).default('60'),
  ADMISSION_DELAY_MS: z.string().transform(Number).default('2000'),

  // Resilience Configuration - Degraded Mode
  DEGRADED_P99_LATENCY_THRESHOLD_MS: z.string().transform(Number).default('5000'),
  DEGRADED_P99_SUSTAINED_SEC: z.string().transform(Number).default('120'),
  DEGRADED_QUEUE_LAG_THRESHOLD_SEC: z.string().transform(Number).default('60'),
  DEGRADED_QUEUE_LAG_SUSTAINED_SEC: z.string().transform(Number).default('120'),
  DEGRADED_RETRY_STORM_THRESHOLD: z.string().transform(Number).default('100'),
  DEGRADED_RECOVERY_STABLE_SEC: z.string().transform(Number).default('300'),
  DEGRADED_DISABLE_ANALYTICS: z.string().transform(val => val !== 'false').default('true'),
  DEGRADED_PAUSE_NON_ESSENTIAL: z.string().transform(val => val !== 'false').default('true'),
  DEGRADED_SLOW_PUBLISH_PACING: z.string().transform(val => val !== 'false').default('true'),
  DEGRADED_AGGRESSIVE_BACKOFF: z.string().transform(val => val !== 'false').default('true'),

  // Resilience Configuration - Monitoring
  BACKPRESSURE_CHECK_INTERVAL_MS: z.string().transform(Number).default('10000'),
  DEGRADED_MODE_CHECK_INTERVAL_MS: z.string().transform(Number).default('30000'),
  METRICS_EXPORT_INTERVAL_MS: z.string().transform(Number).default('60000'),

  // Resilience Configuration - Control Loop
  CONTROL_LOOP_EMA_ALPHA: z.string().transform(Number).default('0.2'),
  CONTROL_LOOP_DWELL_TIME_LOW_MS: z.string().transform(Number).default('10000'),
  CONTROL_LOOP_DWELL_TIME_ELEVATED_MS: z.string().transform(Number).default('15000'),
  CONTROL_LOOP_DWELL_TIME_HIGH_MS: z.string().transform(Number).default('20000'),
  CONTROL_LOOP_DWELL_TIME_CRITICAL_MS: z.string().transform(Number).default('30000'),
  CONTROL_LOOP_TRANSITION_COOLDOWN_MS: z.string().transform(Number).default('10000'),
  CONTROL_LOOP_OSCILLATION_WINDOW_MS: z.string().transform(Number).default('60000'),
  CONTROL_LOOP_OSCILLATION_THRESHOLD: z.string().transform(Number).default('5'),
  CONTROL_LOOP_OSCILLATION_FREEZE_MS: z.string().transform(Number).default('30000'),
  CONTROL_LOOP_RAMP_INTERVAL_MS: z.string().transform(Number).default('5000'),
  CONTROL_LOOP_RAMP_STEP_SIZE: z.string().transform(Number).default('1'),

  // Telemetry
  TELEMETRY_ENABLED: z.string().transform(val => val === 'true').default('false'),
  JAEGER_ENDPOINT: z.string().url().default('http://localhost:14268/api/traces'),

  // Worker Enable Flags
  ENABLE_MEDIA_PROCESSING: z.string().transform(val => val !== 'false').default('true'),
  ENABLE_EMAIL: z.string().transform(val => val !== 'false').default('true'),
  ENABLE_NOTIFICATIONS: z.string().transform(val => val !== 'false').default('true'),
  ENABLE_ANALYTICS: z.string().transform(val => val !== 'false').default('true'),
  ENABLE_HEALTH_CHECKS: z.string().transform(val => val !== 'false').default('true'),
  ENABLE_BACKUPS: z.string().transform(val => val !== 'false').default('true'),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().transform(Number).default('0.1'),
  APP_VERSION: z.string().default('1.0.0'),
});

// Validate environment variables FIRST (before any other imports or checks)
const validateEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      console.error('❌ Environment validation failed:');
      console.error(missingVars.join('\n'));
      process.exit(1);
    }
    throw error;
  }
};

const env = validateEnv();

// Production safety check: Prevent VALIDATION_MODE in production
if (env.VALIDATION_MODE && env.NODE_ENV === 'production') {
  console.error('❌ FATAL: VALIDATION_MODE cannot be enabled in production');
  console.error('❌ This mode bypasses security checks and is only for testing');
  process.exit(1);
}

// Log validation mode status
if (env.VALIDATION_MODE) {
  console.warn('⚠️  VALIDATION_MODE ENABLED - Security checks bypassed');
  console.warn('⚠️  This mode is NOT for production use');
  console.warn('⚠️  OAuth and MongoDB validation will be skipped');
}

// Validate OAuth configuration at startup (fail fast)
// Skip in VALIDATION_MODE to allow testing without credentials
if (!env.VALIDATION_MODE) {
  validateOAuthConfigAtStartup();
} else {
  console.log('[OAuth Config] ⚠️  Validation skipped (VALIDATION_MODE enabled)');
}

// Export typed configuration
export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  apiUrl: env.API_URL,
  validationMode: env.VALIDATION_MODE,

  database: {
    uri: env.MONGODB_URI,
    testUri: env.MONGODB_TEST_URI || env.MONGODB_URI_TEST,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    testDb: env.REDIS_TEST_DB,
  },

  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  },

  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackUrl: env.GOOGLE_CALLBACK_URL,
    },
    twitter: {
      clientId: env.TWITTER_CLIENT_ID,
      clientSecret: env.TWITTER_CLIENT_SECRET,
      callbackUrl: env.TWITTER_CALLBACK_URL,
      consumerSecret: env.TWITTER_CONSUMER_SECRET,
      redirectUri: env.TWITTER_REDIRECT_URI,
    },
    linkedin: {
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      redirectUri: env.LINKEDIN_REDIRECT_URI,
    },
    facebook: {
      appId: env.FACEBOOK_APP_ID,
      appSecret: env.FACEBOOK_APP_SECRET,
      callbackUrl: env.FACEBOOK_CALLBACK_URL,
      clientId: env.FACEBOOK_CLIENT_ID,
      clientSecret: env.FACEBOOK_CLIENT_SECRET,
      redirectUri: env.FACEBOOK_REDIRECT_URI,
    },
    instagram: {
      clientId: env.INSTAGRAM_CLIENT_ID,
      clientSecret: env.INSTAGRAM_CLIENT_SECRET,
      callbackUrl: env.INSTAGRAM_CALLBACK_URL,
      redirectUri: env.INSTAGRAM_REDIRECT_URI,
    },
    instagramBasic: {
      appId: env.INSTAGRAM_BASIC_APP_ID,
      appSecret: env.INSTAGRAM_BASIC_APP_SECRET,
      redirectUri: env.INSTAGRAM_BASIC_REDIRECT_URI,
    },
    googleBusiness: {
      clientId: env.GOOGLE_BUSINESS_CLIENT_ID,
      clientSecret: env.GOOGLE_BUSINESS_CLIENT_SECRET,
      redirectUri: env.GOOGLE_BUSINESS_REDIRECT_URI,
    },
    tiktok: {
      clientKey: env.TIKTOK_CLIENT_KEY,
      clientSecret: env.TIKTOK_CLIENT_SECRET,
    },
    youtube: {
      clientId: env.YOUTUBE_CLIENT_ID,
      clientSecret: env.YOUTUBE_CLIENT_SECRET,
      callbackUrl: env.YOUTUBE_CALLBACK_URL,
    },
    threads: {
      clientId: env.THREADS_CLIENT_ID,
      clientSecret: env.THREADS_CLIENT_SECRET,
      callbackUrl: env.THREADS_CALLBACK_URL,
    },
  },

  openai: {
    apiKey: env.OPENAI_API_KEY,
  },

  ai: {
    defaultProvider: env.AI_PROVIDER as 'openai' | 'anthropic' | 'mock',
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openaiModel: env.AI_MODEL || 'gpt-3.5-turbo',
    maxTokens: env.AI_MAX_TOKENS,
    temperature: env.AI_TEMPERATURE,
    timeout: env.AI_TIMEOUT,
  },

  stockPhotos: {
    unsplashAccessKey: env.UNSPLASH_ACCESS_KEY || '',
    pexelsApiKey: env.PEXELS_API_KEY || '',
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
    s3Bucket: env.AWS_S3_BUCKET,
    secretName: env.AWS_SECRET_NAME,
  },

  storage: {
    type: env.STORAGE_TYPE as 'local' | 's3',
    s3: {
      bucket: env.S3_BUCKET,
      bucketName: env.S3_BUCKET_NAME,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      publicUrl: env.S3_PUBLIC_URL,
    },
    localStorage: {
      path: env.LOCAL_STORAGE_PATH,
      url: env.LOCAL_STORAGE_URL,
    },
    cdn: {
      url: env.CDN_URL,
      baseUrl: env.CDN_BASE_URL,
    },
  },

  encryption: {
    key: env.ENCRYPTION_KEY,
  },

  email: {
    resendApiKey: env.RESEND_API_KEY,
    fromEmail: env.EMAIL_FROM,
  },

  cors: {
    origin: env.FRONTEND_URL,
  },

  frontend: {
    url: env.FRONTEND_URL,
    allowedOrigins: env.ALLOWED_ORIGINS,
  },

  app: {
    url: env.APP_URL,
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  alerting: {
    enabled: env.ALERTING_ENABLED,
    cooldownMinutes: env.ALERTING_COOLDOWN_MINUTES,
    webhookUrl: env.ALERTING_WEBHOOK_URL,
    webhookFormat: env.ALERTING_WEBHOOK_FORMAT as 'slack' | 'discord' | 'generic',
    memoryThreshold: env.ALERTING_MEMORY_THRESHOLD,
    queueFailureRateThreshold: env.ALERTING_QUEUE_FAILURE_RATE_THRESHOLD,
    dlqThreshold: env.ALERTING_DLQ_THRESHOLD,
    pollInterval: env.ALERTING_POLL_INTERVAL,
  },

  backup: {
    enabled: env.BACKUP_ENABLED,
    schedule: env.BACKUP_SCHEDULE,
    retentionDays: env.BACKUP_RETENTION_DAYS,
    localPath: env.BACKUP_LOCAL_PATH,
    path: env.BACKUP_PATH,
    verifyEnabled: env.BACKUP_VERIFY_AFTER_BACKUP,
    verifyIntervalHours: env.BACKUP_VERIFICATION_INTERVAL_HOURS,
    verifyTimeoutMs: env.BACKUP_VERIFICATION_TIMEOUT_MS,
    maxAgeHours: env.MAX_BACKUP_AGE_HOURS,
    tempDbPrefix: 'backup_verify_',
    s3Bucket: env.BACKUP_S3_BUCKET,
    s3Region: env.BACKUP_S3_REGION,
    s3Prefix: env.BACKUP_S3_PREFIX,
    compressionEnabled: env.BACKUP_COMPRESSION_ENABLED,
    verifyAfterBackup: env.BACKUP_VERIFY_AFTER_BACKUP,
  },

  backpressure: {
    enabled: env.BACKPRESSURE_ENABLED,
    pollInterval: env.BACKPRESSURE_POLL_INTERVAL,
    waitingJobsThreshold: env.BACKPRESSURE_WAITING_THRESHOLD,
    growthRateThreshold: env.BACKPRESSURE_GROWTH_RATE_THRESHOLD,
    jobTimeThreshold: env.BACKPRESSURE_JOBTIME_THRESHOLD,
    failureRateThreshold: env.BACKPRESSURE_FAILURE_RATE_THRESHOLD,
    backlogAgeThreshold: env.BACKPRESSURE_AGE_THRESHOLD,
    stalledThreshold: env.BACKPRESSURE_STALLED_THRESHOLD,
  },

  dlqReplay: {
    enabled: env.DLQ_REPLAY_ENABLED,
    batchSize: env.DLQ_REPLAY_BATCH_SIZE,
    skipPublished: env.DLQ_REPLAY_SKIP_PUBLISHED,
    dryRun: env.DLQ_REPLAY_DRY_RUN,
  },

  features: {
    gracefulDegradation: env.GRACEFUL_DEGRADATION_ENABLED,
    useInstagramProfessional: env.USE_INSTAGRAM_PROFESSIONAL,
    transactionEnabled: env.TRANSACTION_ENABLED,
    queueLimitsEnabled: env.QUEUE_LIMITS_ENABLED,
    idempotencyEnabled: env.IDEMPOTENCY_ENABLED,
    idempotencyFallbackToMemory: env.IDEMPOTENCY_FALLBACK_TO_MEMORY,
  },

  distributedLock: {
    enabled: env.DISTRIBUTED_LOCK_ENABLED,
    fallbackEnabled: env.DISTRIBUTED_LOCK_FALLBACK_ENABLED,
  },

  worker: {
    concurrency: env.WORKER_CONCURRENCY,
  },

  apiKey: {
    maxPerWorkspace: env.API_KEY_MAX_PER_WORKSPACE,
    defaultRateLimit: env.API_KEY_DEFAULT_RATE_LIMIT,
    defaultWindowMs: env.API_KEY_DEFAULT_WINDOW_MS,
    cacheTtlSeconds: env.API_KEY_CACHE_TTL_SECONDS,
    workspaceRateLimit: env.WORKSPACE_API_KEY_RATE_LIMIT,
  },

  test: {
    dbName: env.TEST_DB_NAME,
    redisNamespace: env.TEST_REDIS_NAMESPACE,
    suppressLogs: env.SUPPRESS_LOGS,
  },

  resilience: {
    loadThresholds: {
      lowToElevatedEnter: env.LOAD_THRESHOLD_LOW_TO_ELEVATED_ENTER,
      elevatedToHighEnter: env.LOAD_THRESHOLD_ELEVATED_TO_HIGH_ENTER,
      highToCriticalEnter: env.LOAD_THRESHOLD_HIGH_TO_CRITICAL_ENTER,
      elevatedToLowExit: env.LOAD_THRESHOLD_ELEVATED_TO_LOW_EXIT,
      highToElevatedExit: env.LOAD_THRESHOLD_HIGH_TO_ELEVATED_EXIT,
      criticalToHighExit: env.LOAD_THRESHOLD_CRITICAL_TO_HIGH_EXIT,
    },
    loadWeights: {
      queueDepth: env.LOAD_WEIGHT_QUEUE_DEPTH,
      retryRate: env.LOAD_WEIGHT_RETRY_RATE,
      rateLimitHits: env.LOAD_WEIGHT_RATE_LIMIT,
      refreshBacklog: env.LOAD_WEIGHT_REFRESH_BACKLOG,
    },
    publishPacing: {
      normalConcurrency: env.PUBLISH_CONCURRENCY_NORMAL,
      elevatedConcurrency: env.PUBLISH_CONCURRENCY_ELEVATED,
      highConcurrency: env.PUBLISH_CONCURRENCY_HIGH,
      criticalConcurrency: env.PUBLISH_CONCURRENCY_CRITICAL,
      delayNonCriticalMs: env.PUBLISH_DELAY_NON_CRITICAL_MS,
    },
    refreshThrottle: {
      maxRefreshPerSecondPerPlatform: env.REFRESH_MAX_PER_SEC_PER_PLATFORM,
      jitterMs: env.REFRESH_JITTER_MS,
      priorityThresholdHours: env.REFRESH_PRIORITY_THRESHOLD_HOURS,
      highLoadThresholdMinutes: env.REFRESH_HIGH_LOAD_THRESHOLD_MIN,
      criticalLoadThresholdMinutes: env.REFRESH_CRITICAL_LOAD_THRESHOLD_MIN,
    },
    admissionControl: {
      enableRejection: env.ADMISSION_ENABLE_REJECTION,
      enableDelay: env.ADMISSION_ENABLE_DELAY,
      retryAfterSeconds: env.ADMISSION_RETRY_AFTER_SEC,
      delayMs: env.ADMISSION_DELAY_MS,
    },
    degradedMode: {
      p99LatencyThresholdMs: env.DEGRADED_P99_LATENCY_THRESHOLD_MS,
      p99LatencySustainedSeconds: env.DEGRADED_P99_SUSTAINED_SEC,
      queueLagThresholdSeconds: env.DEGRADED_QUEUE_LAG_THRESHOLD_SEC,
      queueLagSustainedSeconds: env.DEGRADED_QUEUE_LAG_SUSTAINED_SEC,
      retryStormThreshold: env.DEGRADED_RETRY_STORM_THRESHOLD,
      recoveryStableSeconds: env.DEGRADED_RECOVERY_STABLE_SEC,
      disableAnalytics: env.DEGRADED_DISABLE_ANALYTICS,
      pauseNonEssential: env.DEGRADED_PAUSE_NON_ESSENTIAL,
      slowPublishPacing: env.DEGRADED_SLOW_PUBLISH_PACING,
      aggressiveRateLimitBackoff: env.DEGRADED_AGGRESSIVE_BACKOFF,
    },
    monitoring: {
      backpressureCheckIntervalMs: env.BACKPRESSURE_CHECK_INTERVAL_MS,
      degradedModeCheckIntervalMs: env.DEGRADED_MODE_CHECK_INTERVAL_MS,
      metricsExportIntervalMs: env.METRICS_EXPORT_INTERVAL_MS,
    },
    controlLoop: {
      emaAlpha: env.CONTROL_LOOP_EMA_ALPHA,
      dwellTimeLowMs: env.CONTROL_LOOP_DWELL_TIME_LOW_MS,
      dwellTimeElevatedMs: env.CONTROL_LOOP_DWELL_TIME_ELEVATED_MS,
      dwellTimeHighMs: env.CONTROL_LOOP_DWELL_TIME_HIGH_MS,
      dwellTimeCriticalMs: env.CONTROL_LOOP_DWELL_TIME_CRITICAL_MS,
      transitionCooldownMs: env.CONTROL_LOOP_TRANSITION_COOLDOWN_MS,
      oscillationWindowMs: env.CONTROL_LOOP_OSCILLATION_WINDOW_MS,
      oscillationThreshold: env.CONTROL_LOOP_OSCILLATION_THRESHOLD,
      oscillationFreezeMs: env.CONTROL_LOOP_OSCILLATION_FREEZE_MS,
      rampIntervalMs: env.CONTROL_LOOP_RAMP_INTERVAL_MS,
      rampStepSize: env.CONTROL_LOOP_RAMP_STEP_SIZE,
    },
  },

  telemetry: {
    enabled: env.TELEMETRY_ENABLED,
    jaegerEndpoint: env.JAEGER_ENDPOINT,
  },

  workers: {
    enableMediaProcessing: env.ENABLE_MEDIA_PROCESSING,
    enableEmail: env.ENABLE_EMAIL,
    enableNotifications: env.ENABLE_NOTIFICATIONS,
    enableAnalytics: env.ENABLE_ANALYTICS,
    enableHealthChecks: env.ENABLE_HEALTH_CHECKS,
    enableBackups: env.ENABLE_BACKUPS,
  },

  sentry: {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    appVersion: env.APP_VERSION,
  },
} as const;

export type Config = typeof config;
