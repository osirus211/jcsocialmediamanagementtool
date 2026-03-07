import dotenv from 'dotenv';
import { z } from 'zod';
import { validateOAuthConfigAtStartup } from './validateOAuthEnv';

dotenv.config();

// Production safety check: Prevent VALIDATION_MODE in production
if (process.env.VALIDATION_MODE === 'true' && process.env.NODE_ENV === 'production') {
  console.error('❌ FATAL: VALIDATION_MODE cannot be enabled in production');
  console.error('❌ This mode bypasses security checks and is only for testing');
  throw new Error('VALIDATION_MODE is not allowed in production environment');
}

// Log validation mode status
if (process.env.VALIDATION_MODE === 'true') {
  console.warn('⚠️  VALIDATION_MODE ENABLED - Security checks bypassed');
  console.warn('⚠️  This mode is NOT for production use');
  console.warn('⚠️  OAuth and MongoDB validation will be skipped');
}

// Validate OAuth configuration at startup (fail fast)
// Skip in VALIDATION_MODE to allow testing without credentials
if (!process.env.VALIDATION_MODE) {
  validateOAuthConfigAtStartup();
} else {
  console.log('[OAuth Config] ⚠️  Validation skipped (VALIDATION_MODE enabled)');
}

// Environment validation schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  API_URL: z.string().url().optional(),

  // Database
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  MONGODB_TEST_URI: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

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
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_CALLBACK_URL: z.string().url().optional(),
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  INSTAGRAM_CALLBACK_URL: z.string().url().optional(),
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

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be 64 hex characters (32 bytes)'),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@example.com'),

  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

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
});

// Validate environment variables
const validateEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

const env = validateEnv();

// Export typed configuration
export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  apiUrl: env.API_URL,

  database: {
    uri: env.MONGODB_URI,
    testUri: env.MONGODB_TEST_URI,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
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
    },
    linkedin: {
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
    },
    facebook: {
      appId: env.FACEBOOK_APP_ID,
      appSecret: env.FACEBOOK_APP_SECRET,
      callbackUrl: env.FACEBOOK_CALLBACK_URL,
    },
    instagram: {
      clientId: env.INSTAGRAM_CLIENT_ID,
      clientSecret: env.INSTAGRAM_CLIENT_SECRET,
      callbackUrl: env.INSTAGRAM_CALLBACK_URL,
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

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
    s3Bucket: env.AWS_S3_BUCKET,
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
} as const;

export type Config = typeof config;
