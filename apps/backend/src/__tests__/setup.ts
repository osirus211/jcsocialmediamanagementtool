/**
 * Jest Test Setup
 * 
 * Global setup for all tests
 */

// Set NODE_ENV to test BEFORE any imports
process.env.NODE_ENV = 'test';

// Increase timeout for property-based tests
jest.setTimeout(60000);

// Mock all background services to prevent them from starting during tests
jest.mock('../services/SchedulerService', () => ({
  schedulerService: {
    start: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(() => ({ isRunning: false })),
  },
  SchedulerService: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(() => ({ isRunning: false })),
  })),
}));

// Mock PlatformHealthService to prevent Redis usage
jest.mock('../services/PlatformHealthService', () => ({
  PlatformHealthService: jest.fn().mockImplementation(() => ({
    checkPlatformHealth: jest.fn(),
    getHealthStatus: jest.fn(() => ({ status: 'healthy' })),
  })),
}));

// Mock PlatformRateLimitService to prevent Redis usage
jest.mock('../services/PlatformRateLimitService', () => ({
  PlatformRateLimitService: jest.fn().mockImplementation(() => ({
    checkRateLimit: jest.fn(),
    getRateLimitStatus: jest.fn(() => ({ allowed: true })),
  })),
}));

// Mock OAuthStateService to prevent setInterval cleanup job
jest.mock('../services/OAuthStateService', () => ({
  OAuthStateService: {
    getInstance: jest.fn(() => ({
      generateState: jest.fn(),
      validateState: jest.fn(),
      cleanupExpiredStates: jest.fn(),
    })),
  },
}));

// Mock Redis connections to prevent hanging
jest.mock('../config/redis', () => ({
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  getRedisClient: jest.fn(() => ({
    // Mock Redis client methods
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(() => []),
    flushall: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    ping: jest.fn(() => 'PONG'),
    // Mock for BullMQ
    duplicate: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(() => []),
      flushall: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      ping: jest.fn(() => 'PONG'),
    })),
  })),
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
}));

// Mock all workers to prevent them from starting
jest.mock('../workers/PublishingWorker', () => ({
  PublishingWorker: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(() => ({ isRunning: false })),
  })),
}));

// Mock all schedulers and background services
jest.mock('../services/PostSchedulerService', () => ({
  PostSchedulerService: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

jest.mock('../services/AnalyticsSchedulerService', () => ({
  analyticsSchedulerService: {
    start: jest.fn(),
    stop: jest.fn(),
  },
  AnalyticsSchedulerService: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Mock queue manager
jest.mock('../queue/QueueManager', () => ({
  QueueManager: {
    getInstance: jest.fn(() => ({
      closeAll: jest.fn(),
      isShutdown: jest.fn(() => false),
      getQueue: jest.fn(() => ({
        add: jest.fn(),
        process: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
      })),
    })),
  },
}));

// Mock all queue classes to prevent BullMQ from starting
jest.mock('../queue/NotificationQueue', () => ({
  NotificationQueue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    process: jest.fn(),
    close: jest.fn(),
  })),
  notificationQueue: {
    add: jest.fn(),
    process: jest.fn(),
    close: jest.fn(),
  },
}));

// Mock nanoid to prevent ES module issues
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id-12345'),
}));

// Mock Prometheus client to prevent metric registration conflicts
jest.mock('prom-client', () => ({
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
    labels: jest.fn(() => ({
      set: jest.fn(),
      inc: jest.fn(),
      dec: jest.fn(),
    })),
  })),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
    labels: jest.fn(() => ({
      inc: jest.fn(),
    })),
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    labels: jest.fn(() => ({
      observe: jest.fn(),
    })),
  })),
  Registry: jest.fn().mockImplementation(() => ({
    metrics: jest.fn(() => ''),
    clear: jest.fn(),
    registerMetric: jest.fn(),
    setDefaultLabels: jest.fn(),
  })),
  register: {
    metrics: jest.fn(() => ''),
    clear: jest.fn(),
    registerMetric: jest.fn(),
    setDefaultLabels: jest.fn(),
  },
  collectDefaultMetrics: jest.fn(),
}));

// Mock zod-to-openapi to prevent OpenAPI schema issues
jest.mock('@asteasolutions/zod-to-openapi', () => ({
  OpenAPIRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    registerComponent: jest.fn(),
    registerPath: jest.fn(),
    generateComponents: jest.fn(() => ({})),
  })),
  OpenApiGeneratorV3: jest.fn().mockImplementation(() => ({
    generateDocument: jest.fn(() => ({})),
  })),
  extendZodWithOpenApi: jest.fn((z) => {
    // Add openapi method to all zod types
    const originalString = z.string;
    z.string = (...args: any[]) => {
      const result = originalString(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalObject = z.object;
    z.object = (...args: any[]) => {
      const result = originalObject(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalArray = z.array;
    z.array = (...args: any[]) => {
      const result = originalArray(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalNumber = z.number;
    z.number = (...args: any[]) => {
      const result = originalNumber(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalBoolean = z.boolean;
    z.boolean = (...args: any[]) => {
      const result = originalBoolean(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalRecord = z.record;
    z.record = (...args: any[]) => {
      const result = originalRecord(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalAny = z.any;
    z.any = (...args: any[]) => {
      const result = originalAny(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalEnum = z.enum;
    z.enum = (...args: any[]) => {
      const result = originalEnum(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalUnion = z.union;
    z.union = (...args: any[]) => {
      const result = originalUnion(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
    
    const originalOptional = z.optional;
    z.optional = (...args: any[]) => {
      const result = originalOptional(...args);
      result.openapi = jest.fn(() => result);
      return result;
    };
  }),
}));

// Mock the entire openapi.ts file to prevent zod-to-openapi issues
jest.mock('../api/v2/openapi', () => ({
  registry: {
    register: jest.fn(),
    registerComponent: jest.fn(),
    registerPath: jest.fn(),
    generateComponents: jest.fn(() => ({})),
  },
  generator: {
    generateDocument: jest.fn(() => ({})),
  },
}));

// Mock Sentry Node SDK to avoid initialization issues during tests
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  Handlers: {
    requestHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
    tracingHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
    errorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
  },
  Integrations: {
    OnUncaughtException: jest.fn(),
    OnUnhandledRejection: jest.fn(),
  },
}));

// Mock Sentry monitoring module to avoid initialization issues during tests
jest.mock('../monitoring/sentry', () => ({
  initSentry: jest.fn(),
  initializeSentry: jest.fn(),
  sentryRequestHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
  sentryTracingHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
  sentryErrorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  flushSentry: jest.fn(),
}));

// Mock WorkspaceMember model to provide WorkspaceRole and MemberRole enums
jest.mock('../models/WorkspaceMember', () => ({
  WorkspaceMember: jest.fn(),
  WorkspaceRole: {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
  },
  MemberRole: {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
  },
  MemberStatus: {
    ACTIVE: 'active',
    PENDING: 'pending',
    SUSPENDED: 'suspended',
  },
}));

// Mock Workspace model
jest.mock('../models/Workspace', () => ({
  Workspace: jest.fn(),
}));

// Mock OAuth providers to avoid compilation issues during infrastructure tests
jest.mock('../services/oauth/FacebookOAuthProvider', () => ({
  FacebookOAuthProvider: jest.fn(),
}));

jest.mock('../services/oauth/InstagramBusinessProvider', () => ({
  InstagramBusinessProvider: jest.fn(),
}));

jest.mock('../services/oauth/LinkedInOAuthProvider', () => ({
  LinkedInOAuthProvider: jest.fn(),
}));

jest.mock('../services/oauth/TikTokProvider', () => ({
  TikTokProvider: jest.fn(),
}));

jest.mock('../services/oauth/TwitterOAuthProvider', () => ({
  TwitterOAuthProvider: jest.fn(),
}));

// Mock OAuth Manager
jest.mock('../services/oauth/OAuthManager', () => ({
  oauthManager: {
    getAvailablePlatforms: jest.fn(() => []),
  },
}));

// Mock AuthService to avoid EmailNotificationService dependency issues
jest.mock('../services/AuthService', () => ({
  AuthService: jest.fn(),
}));

// Mock secrets loading
jest.mock('../config/secrets', () => ({
  loadSecrets: jest.fn(),
}));

// Mock Socket.io initialization
jest.mock('../services/DraftCollaborationSocket', () => ({
  initializeDraftSocket: jest.fn(),
}));

// Global cleanup after each test
afterEach(async () => {
  // Clear all timers to prevent hanging
  jest.clearAllTimers();
  
  // Clear any pending timeouts/intervals
  if ((global.setTimeout as any).mock) {
    (global.setTimeout as any).mock.calls.forEach(call => {
      if (call[0] && typeof call[0] === 'function') {
        clearTimeout(call[0]);
      }
    });
  }
});

// Global cleanup after all tests
afterAll(async () => {
  // Force cleanup of any remaining handles
  jest.clearAllTimers();
  
  // Close any open database connections
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
  
  // Close any Redis connections
  try {
    const { disconnectRedis } = require('../config/redis');
    await disconnectRedis();
  } catch (error) {
    // Ignore errors during cleanup
  }
  
  // Small delay to allow cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
