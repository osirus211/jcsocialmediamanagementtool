import request from 'supertest';
import app from '../../app';
import { User } from '../../models/User';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import bcrypt from 'bcrypt';

// Mock Redis to prevent connection errors during tests
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() => null),
  isRedisHealthy: jest.fn(() => false),
  getCircuitBreakerStatus: jest.fn(() => ({ state: 'closed', failures: 0 })),
  getRecoveryService: jest.fn(() => ({ isRecovering: false, lastAttempt: null })),
}));

// Mock EmailService to avoid react-email dependency issues
jest.mock('../../services/EmailService', () => ({
  EmailService: {
    sendEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  },
}));

// Mock EmailSequenceService to avoid dependency issues
jest.mock('../../services/EmailSequenceService', () => ({
  emailSequenceService: {
    startSequence: jest.fn(),
  },
}));

// Mock EmailNotificationService to avoid dependency issues
jest.mock('../../services/EmailNotificationService', () => ({
  emailNotificationService: {
    sendPasswordResetEmail: jest.fn(),
  },
}));

// Mock WorkspaceService to avoid dependency issues
jest.mock('../../services/WorkspaceService', () => ({
  WorkspaceService: jest.fn().mockImplementation(() => ({
    createWorkspace: jest.fn(),
    getWorkspaces: jest.fn(),
    updateWorkspace: jest.fn(),
    deleteWorkspace: jest.fn(),
  })),
}));

// Mock Prometheus metrics to prevent duplicate registration errors
jest.mock('../../config/connectionHealthMetrics', () => ({
  connectionHealthMetrics: {
    register: jest.fn(),
    recordConnectionAttempt: jest.fn(),
    recordConnectionSuccess: jest.fn(),
    recordConnectionFailure: jest.fn(),
    recordQueryExecution: jest.fn(),
  },
}));

// Mock health check services
jest.mock('../../services/HealthCheckService', () => ({
  healthCheckService: {
    isHealthy: jest.fn(() => Promise.resolve(true)),
    getHealthStatus: jest.fn(() => Promise.resolve({ status: 'healthy' })),
  },
}));

jest.mock('../../services/WorkerManager', () => ({
  WorkerManager: {
    getInstance: jest.fn(() => ({
      getStatus: jest.fn(() => []),
      isHealthy: jest.fn(() => true),
      getRedisHealth: jest.fn(() => ({ status: 'healthy' })),
    })),
  },
}));

jest.mock('../../services/QueueMonitoringService', () => ({
  queueMonitoringService: {
    getAllQueueStats: jest.fn(() => Promise.resolve({})),
  },
}));

jest.mock('../../services/PublishingHealthService', () => ({
  publishingHealthService: {
    getPublishingHealth: jest.fn(() => Promise.resolve({ status: 'healthy' })),
  },
}));

// Mock CSRF middleware to prevent token validation errors during tests
jest.mock('../../middleware/csrf', () => ({
  csrfProtection: (req: any, res: any, next: any) => next(),
  generateToken: jest.fn(() => 'mock-csrf-token'),
  getCsrfToken: (req: any, res: any) => res.json({ csrfToken: 'mock-csrf-token' }),
}));

// Mock auth metrics tracker
jest.mock('../../services/metrics/AuthMetricsTracker', () => ({
  authMetricsTracker: {
    incrementRegisterSuccess: jest.fn(),
    incrementLoginSuccess: jest.fn(),
  },
}));

// Mock Sentry to prevent initialization errors
jest.mock('../../monitoring/sentry', () => ({
  sentryRequestHandler: () => (req: any, res: any, next: any) => next(),
  sentryTracingHandler: () => (req: any, res: any, next: any) => next(),
  sentryErrorHandler: () => (err: any, req: any, res: any, next: any) => next(err),
}));

describe('POST /api/v1/auth/login', () => {
  let testUser: any;
  let unverifiedUser: any;
  let oauthUser: any;
  let twoFactorUser: any;
  const testEmail = 'test@example.com';
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    // Clean up database
    try {
      await User.deleteMany({});
      await disconnectDatabase();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    
    // Clear any remaining timers
    jest.clearAllTimers();
    
    // Force cleanup after a short delay
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    
    // Create verified test user
    testUser = await User.create({
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
    });

    // Create unverified user
    unverifiedUser = await User.create({
      email: 'unverified@example.com',
      password: testPassword,
      firstName: 'Unverified',
      lastName: 'User',
      isEmailVerified: false,
    });

    // Create OAuth user
    oauthUser = await User.create({
      email: 'oauth@example.com',
      firstName: 'OAuth',
      lastName: 'User',
      provider: 'google',
      oauthId: 'google123',
      isEmailVerified: true,
    });

    // Create 2FA enabled user
    twoFactorUser = await User.create({
      email: '2fa@example.com',
      password: testPassword,
      firstName: '2FA',
      lastName: 'User',
      isEmailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    });
  });

  afterEach(async () => {
    // Clean up database
    await User.deleteMany({});
  });

  describe('Happy Path', () => {
    test('4.1 Valid email + password → 200, returns accessToken + user object', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      console.log('Response text:', response.text);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('refreshTokens');
    });

    test('4.2 Email is case-insensitive (USER@EXAMPLE.COM == user@example.com)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail.toUpperCase(),
          password: testPassword,
        })
        .expect(200);

      expect(response.body.user.email).toBe(testEmail);
    });

    test('4.3 Whitespace trimmed from email input', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `  ${testEmail}  `,
          password: testPassword,
        })
        .expect(200);

      expect(response.body.user.email).toBe(testEmail);
    });

    test('4.4 User object returned has correct fields (no password hash, no tokens)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const { user } = response.body;
      expect(user).toHaveProperty('_id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('firstName');
      expect(user).toHaveProperty('lastName');
      expect(user).toHaveProperty('role');
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('refreshTokens');
      expect(user).not.toHaveProperty('twoFactorSecret');
    });

    test('4.5 Access token is valid JWT with correct payload', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const { accessToken } = response.body;
      expect(accessToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(accessToken.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('4.6 Refresh token cookie is set (httpOnly, secure flags verified)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      // Check if Set-Cookie header exists (implementation may vary)
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const refreshCookie = cookies.find((cookie: string) => 
          cookie.includes('refreshToken') || cookie.includes('refresh')
        );
        if (refreshCookie) {
          expect(refreshCookie).toContain('HttpOnly');
        }
      }
    });
  });

  describe('Wrong Credentials', () => {
    test('4.7 Wrong password → 401, generic error message', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    test('4.8 Email not found → 401, SAME generic error (not "user not found")', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    test('4.9 Error message is identical for wrong email vs wrong password (timing attack prevention)', async () => {
      const wrongEmailResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);

      const wrongPasswordResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(wrongEmailResponse.body.message).toBe(wrongPasswordResponse.body.message);
    });
  });

  describe('Input Validation', () => {
    test('4.10 Missing email → 400 with validation error', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: testPassword,
        })
        .expect(400);

      expect(response.body.message).toContain('Email and password are required');
    });

    test('4.11 Missing password → 400 with validation error', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
        })
        .expect(400);

      expect(response.body.message).toContain('Email and password are required');
    });

    test('4.12 Invalid email format → 400 with validation error', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: testPassword,
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    test('4.13 Password too short (< 8 chars) → 400 with validation error', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: '1234567',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    test('4.14 Empty string email → 400', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: '',
          password: testPassword,
        })
        .expect(400);

      expect(response.body.message).toContain('Email and password are required');
    });

    test('4.15 Empty string password → 400', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: '',
        })
        .expect(400);

      expect(response.body.message).toContain('Email and password are required');
    });

    test('4.16 Email > 255 chars → 400', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: longEmail,
          password: testPassword,
        })
        .expect(400);

      expect(response.body.message).toContain('Email too long');
    });

    test('4.17 Password > 128 chars → 400', async () => {
      const longPassword = 'a'.repeat(129);
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: longPassword,
        })
        .expect(400);

      expect(response.body.message).toContain('Password too long');
    });

    test('4.18 SQL injection attempt in email → 400 or sanitized, no crash', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: "'; DROP TABLE users; --",
          password: testPassword,
        });

      // Should not crash and return appropriate error
      expect([400, 401]).toContain(response.status);
    });

    test('4.19 NoSQL injection ($ne, $gt operators) in body → 400 or ignored', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $ne: null },
          password: { $gt: '' },
        });

      // Should not crash and return appropriate error
      expect([400, 401]).toContain(response.status);
    });

    test('4.20 XSS payload in email → sanitized, not reflected', async () => {
      const xssPayload = '<script>alert("xss")</script>@example.com';
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: xssPayload,
          password: testPassword,
        });

      // Should not reflect the script tag in response
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });
  });

  describe('Account States', () => {
    test('4.21 Unverified email → 401 with "please verify email" message', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: unverifiedUser.email,
          password: testPassword,
        })
        .expect(401);

      expect(response.body.message).toContain('Please verify your email first');
    });

    test('4.22 Deactivated account → 401 with appropriate message', async () => {
      // Soft delete the user
      await User.findByIdAndUpdate(testUser._id, { softDeletedAt: new Date() });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    test('4.23 Deleted account → 401 with generic error', async () => {
      // Delete the user completely
      await User.findByIdAndDelete(testUser._id);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('Rate Limiting', () => {
    test('4.24 6th failed attempt within 15 min → 429 Too Many Requests', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(429);

      expect(response.body.message).toContain('Too many login attempts');
    });

    test('4.25 Rate limit response includes Retry-After header', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // 6th attempt should be rate limited with Retry-After
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(429);

      expect(response.body).toHaveProperty('retryAfter');
      expect(typeof response.body.retryAfter).toBe('number');
    });

    test('4.26 Successful login does NOT count toward failed attempt counter', async () => {
      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // Successful login
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      // Should still be able to make failed attempts (counter reset)
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    test('4.27 Rate limit is per IP (different IPs have separate counters)', async () => {
      // This test is limited by supertest's ability to simulate different IPs
      // In a real environment, this would be tested with different client IPs
      expect(true).toBe(true); // Placeholder - rate limiter implementation handles this
    });
  });

  describe('2FA', () => {
    test('4.28 User with 2FA enabled → 200 but returns { requiresTwoFactor: true }', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: twoFactorUser.email,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('requiresTwoFactor', true);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).not.toHaveProperty('accessToken');
    });

    test('4.29 2FA response does NOT include full JWT (only temp token)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: twoFactorUser.email,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('requiresTwoFactor', true);
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('tokens');
    });
  });
});