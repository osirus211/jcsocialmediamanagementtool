// Jest setup file
import mongoose from 'mongoose';

// Set all required environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-that-is-at-least-32-characters-long';
// MongoDB URI will be set by globalSetup.ts
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.EMAIL_FROM = 'test@example.com';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.VALIDATION_MODE = 'true';

// Connect to the global MongoDB instance
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test');
  }
});

// Clean up after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// Mock all services that use setInterval or setTimeout
jest.mock('../services/OAuthStateService', () => {
  const mockInstance = {
    generateState: jest.fn(),
    validateState: jest.fn(),
    validateStateForWorkspace: jest.fn(),
    validateStateWithProviderType: jest.fn(),
    consumeState: jest.fn(),
    consumeStateForWorkspace: jest.fn(),
    deleteState: jest.fn(),
    getActiveStates: jest.fn(),
    cleanupExpiredStates: jest.fn(),
    startCleanupJob: jest.fn(),
    stopCleanupJob: jest.fn(),
    shutdown: jest.fn(),
    getStats: jest.fn(),
  };

  return {
    OAuthStateService: {
      getInstance: jest.fn(() => mockInstance),
    },
    oauthStateService: mockInstance,
  };
});

// Mock WorkerManager to prevent setInterval
jest.mock('../services/WorkerManager', () => ({
  WorkerManager: {
    getInstance: jest.fn(() => ({
      startAll: jest.fn(),
      stopAll: jest.fn(),
      isRunning: jest.fn(() => false),
      isHealthy: jest.fn(() => true),
      getStatus: jest.fn(() => []),
      getRedisHealth: jest.fn(() => ({ connected: true })),
    })),
  },
  workerManager: {
    startAll: jest.fn(),
    stopAll: jest.fn(),
    isRunning: jest.fn(() => false),
    isHealthy: jest.fn(() => true),
    getStatus: jest.fn(() => []),
    getRedisHealth: jest.fn(() => ({ connected: true })),
  },
}));

// Mock QueueMonitoringService to prevent setInterval
jest.mock('../services/QueueMonitoringService', () => ({
  queueMonitoringService: {
    start: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(() => ({ isRunning: false })),
    getAllQueueStats: jest.fn(() => []),
  },
}));

// Mock PublishingWorker to prevent setInterval
jest.mock('../workers/PublishingWorker', () => ({
  PublishingWorker: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn(() => false),
    getStats: jest.fn(() => ({})),
  })),
}));

// Mock all Bull workers to prevent Redis connections
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock Redis connections
jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => null),
  getRedisClientSafe: jest.fn(() => null),
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  isRedisHealthy: jest.fn(() => false),
  getCircuitBreakerStatus: jest.fn(() => ({
    state: 'closed',
    errorRate: 0,
    errors: 0,
    successes: 0,
    lastError: null,
    openedAt: null,
  })),
  getRecoveryService: jest.fn(() => null),
  recordCircuitBreakerSuccess: jest.fn(),
  recordCircuitBreakerError: jest.fn(),
}));

// Mock HealthCheckService to prevent async operations
jest.mock('../services/HealthCheckService', () => ({
  healthCheckService: {
    isHealthy: jest.fn(() => Promise.resolve(true)),
    getHealthStatus: jest.fn(() => Promise.resolve({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: 0,
      version: '1.0.0',
      components: {},
    })),
  },
}));

// Mock PublishingHealthService
jest.mock('../services/PublishingHealthService', () => ({
  publishingHealthService: {
    getPublishingHealth: jest.fn(() => Promise.resolve({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })),
  },
}));

// Mock all scheduler services
jest.mock('../services/SchedulerService', () => ({
  schedulerService: {
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn(() => false),
  },
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock SAML and OIDC services to prevent ESM module loading
jest.mock('../services/SAMLService', () => ({
  SAMLService: jest.fn().mockImplementation(() => ({
    generateAuthorizeUrl: jest.fn(),
    validateResponse: jest.fn(),
    generateMetadataXml: jest.fn(),
  })),
}));

jest.mock('../services/OIDCService', () => ({
  OIDCService: {
    create: jest.fn(() => Promise.resolve({
      generateAuthorizationUrl: jest.fn(),
      handleCallback: jest.fn(),
    })),
  },
}));

// Mock @node-saml/node-saml to prevent ESM loading
jest.mock('@node-saml/node-saml', () => ({
  SAML: jest.fn().mockImplementation(() => ({
    getAuthorizeUrlAsync: jest.fn(),
    validatePostResponseAsync: jest.fn(),
    generateServiceProviderMetadata: jest.fn(),
  })),
}));

// Mock openid-client to prevent ESM loading
jest.mock('openid-client', () => ({
  discovery: jest.fn(),
  randomState: jest.fn(() => 'mock-state'),
  randomNonce: jest.fn(() => 'mock-nonce'),
  randomPKCECodeVerifier: jest.fn(() => 'mock-verifier'),
  calculatePKCECodeChallenge: jest.fn(() => Promise.resolve('mock-challenge')),
  buildAuthorizationUrl: jest.fn(() => new URL('https://example.com/auth')),
  authorizationCodeGrant: jest.fn(),
  fetchUserInfo: jest.fn(),
}));