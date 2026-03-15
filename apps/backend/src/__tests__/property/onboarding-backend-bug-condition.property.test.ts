import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app';
import { User } from '../../models/User';
import { AuthTokenService } from '../../services/AuthTokenService';
import { OnboardingService } from '../../services/OnboardingService';

/**
 * Backend Bug Condition Exploration Test
 * 
 * **Validates: Requirements 2.3**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms backend bugs exist
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * GOAL: Surface counterexamples that demonstrate backend bugs exist
 * 
 * Expected Outcome: Test FAILS (this is correct - it proves backend bugs exist)
 * 
 * COUNTEREXAMPLES FOUND (Test Run Results):
 * 
 * 1. HTTP Status Code Issues:
 *    - GET /api/v1/onboarding/step returns 404 instead of 401 for unauthenticated requests
 *    - POST /api/v1/onboarding/progress returns 404 instead of 401 for unauthenticated requests
 *    - Some endpoints return incorrect status codes for various scenarios
 * 
 * 2. Validation Mismatch Issues:
 *    - Step validation allows step=0 when it should reject negative/invalid steps
 *    - Backend accepts step=-1 (returns 200) when frontend would reject it (should be 400)
 *    - Backend accepts step=10 (beyond max) when it should return 400
 *    - Backend accepts step=2.5 (non-integer) when it should return 400
 * 
 * 3. Progress Persistence Issues:
 *    - Step updates return 500 errors instead of successful persistence
 *    - Database save operations failing for valid step data
 * 
 * 4. Completion Flag Issues:
 *    - POST /complete returns 400 instead of 200 with completion flag
 *    - Completion service not properly setting user record flags
 * 
 * 5. JWT Claims Update Issues:
 *    - Token generation not being called with updated onboarding status
 *    - Claims not reflecting completion state after onboarding
 * 
 * 6. Authentication Issues:
 *    - Some endpoints return 404 instead of 401 for missing auth
 *    - Inconsistent authentication error handling across endpoints
 * 
 * 7. Environment Validation Issues:
 *    - JWT secret validation not throwing errors for weak/missing secrets
 *    - Missing environment variable validation
 * 
 * 8. Data Leakage Issues:
 *    - API responses returning 500 errors instead of sanitized data
 *    - Potential for sensitive data exposure in error responses
 * 
 * These counterexamples confirm multiple backend bugs exist across:
 * - HTTP status code correctness
 * - Frontend/backend validation consistency  
 * - Database persistence reliability
 * - Authentication and authorization
 * - Security and data protection
 * - Environment configuration validation
 */

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/AuthTokenService');
jest.mock('../../services/OnboardingService');
jest.mock('../../utils/logger');

// Mock CSRF middleware to avoid CSRF token issues in tests
jest.mock('../../middleware/csrf', () => ({
  csrfProtection: (req: any, res: any, next: any) => next(),
  generateCsrfToken: jest.fn(() => 'mock-csrf-token'),
  getCsrfToken: (req: any, res: any) => res.json({ csrfToken: 'mock-csrf-token' })
}));

const mockUser = {
  _id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'owner',
  isEmailVerified: true,
  provider: 'local',
  onboardingCompleted: false,
  onboardingStep: 0,
  save: jest.fn(),
  toJSON: jest.fn(),
};

const mockAuthTokenService = {
  verifyAccessToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
};

const mockOnboardingService = {
  getProgress: jest.fn(),
  updateStep: jest.fn(),
  completeOnboarding: jest.fn(),
  skipOnboarding: jest.fn(),
  needsOnboarding: jest.fn(),
};

describe('Backend Bug Condition Exploration - Property Tests', () => {
  let validToken: string;
  let invalidToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup valid token
    validToken = 'Bearer valid-jwt-token-12345';
    invalidToken = 'Bearer invalid-jwt-token-67890';
    
    // Setup default mocks
    (AuthTokenService.verifyAccessToken as jest.Mock) = mockAuthTokenService.verifyAccessToken;
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
    
    // Setup OnboardingService mocks
    Object.assign(OnboardingService, mockOnboardingService);
    
    // Default successful token verification
    mockAuthTokenService.verifyAccessToken.mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'owner',
    });
    
    // Default user lookup success
    mockUser.save.mockResolvedValue(mockUser);
    mockUser.toJSON.mockReturnValue({
      _id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      onboardingCompleted: false,
      onboardingStep: 0,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Property 1: Bug Condition - Backend Issues Detection', () => {
    
    test('HTTP status codes should be correct for all scenarios', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            endpoint: fc.constantFrom('/progress', '/step', '/complete', '/skip', '/needs-onboarding'),
            method: fc.constantFrom('GET', 'PUT', 'POST'),
            hasAuth: fc.boolean(),
            userExists: fc.boolean(),
            validData: fc.boolean(),
          }),
          async (scenario) => {
            // Setup auth scenario
            const authHeader = scenario.hasAuth ? validToken : undefined;
            
            if (!scenario.hasAuth) {
              mockAuthTokenService.verifyAccessToken.mockImplementation(() => {
                throw new Error('No token provided');
              });
            }
            
            // Setup user existence scenario
            if (!scenario.userExists) {
              (User.findOne as jest.Mock).mockResolvedValue(null);
            }
            
            // Setup data scenario for PUT/POST requests
            const requestData = scenario.validData ? 
              { step: 2 } : 
              { step: 'invalid' }; // Invalid step type
            
            let response;
            const endpoint = `/api/v1/onboarding${scenario.endpoint}`;
            
            // Make request based on method
            if (scenario.method === 'GET') {
              response = await request(app)
                .get(endpoint)
                .set('Authorization', authHeader || '');
            } else if (scenario.method === 'PUT') {
              response = await request(app)
                .put(endpoint)
                .set('Authorization', authHeader || '')
                .send(requestData);
            } else { // POST
              response = await request(app)
                .post(endpoint)
                .set('Authorization', authHeader || '')
                .send(requestData);
            }
            
            // EXPECTED TO FAIL: HTTP status codes should be correct
            // If this fails, it confirms HTTP status code bugs exist
            
            if (!scenario.hasAuth) {
              // Unauthenticated requests should return 401
              expect(response.status).toBe(401);
            } else if (!scenario.userExists) {
              // Non-existent user should return 401 or 404
              expect([401, 404]).toContain(response.status);
            } else if (!scenario.validData && (scenario.method === 'PUT' || scenario.method === 'POST')) {
              // Invalid data should return 400
              expect(response.status).toBe(400);
            } else {
              // Valid requests should return 200
              expect(response.status).toBe(200);
            }
          }
        ),
        { numRuns: 3 }
      );
    });

    test('frontend and backend validation should match exactly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            step: fc.oneof(
              fc.integer({ min: -10, max: -1 }), // Negative steps
              fc.integer({ min: 6, max: 100 }), // Steps beyond max
              fc.float(), // Non-integer steps
              fc.constant(null), // Null step
              fc.constant(undefined), // Undefined step
            ),
          }),
          async (invalidData) => {
            // Mock successful auth
            mockAuthTokenService.verifyAccessToken.mockReturnValue({
              userId: 'user-123',
              email: 'test@example.com',
              role: 'owner',
            });
            
            const response = await request(app)
              .put('/api/v1/onboarding/step')
              .set('Authorization', validToken)
              .send(invalidData);
            
            // EXPECTED TO FAIL: Backend should validate step data consistently with frontend
            // If this fails, it confirms validation mismatch bugs exist
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toMatch(/step.*invalid|step.*required|step.*number/i);
          }
        ),
        { numRuns: 3 }
      );
    });

    test('onboarding progress should persist to database correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 5 }),
          fc.record({
            role: fc.constantFrom('founder', 'marketer', 'agency', 'creator'),
            teamSize: fc.constantFrom('solo', 'small', 'medium', 'large'),
            primaryGoal: fc.constantFrom('grow-audience', 'save-time', 'manage-clients', 'increase-sales'),
          }),
          async (step, stepData) => {
            // Mock successful step update
            mockOnboardingService.updateStep.mockResolvedValue({
              userId: 'user-123',
              currentStep: step,
              completed: step === 5,
              completedSteps: Array.from({ length: step }, (_, i) => i),
            });
            
            const response = await request(app)
              .put('/api/v1/onboarding/step')
              .set('Authorization', validToken)
              .send({ step, data: stepData });
            
            // EXPECTED TO FAIL: Progress should be persisted to database
            // If this fails, it confirms progress persistence bugs exist
            expect(response.status).toBe(200);
            expect(mockOnboardingService.updateStep).toHaveBeenCalledWith('user-123', step);
            
            // Verify user model was updated
            expect(mockUser.save).toHaveBeenCalled();
          }
        ),
        { numRuns: 3 }
      );
    });

    test('completion flag should be set correctly on user record', () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom('complete', 'skip'), // Completion methods
          async (completionMethod) => {
            // Mock completion service
            const expectedResult = {
              userId: 'user-123',
              currentStep: 5,
              completed: true,
              completedSteps: [0, 1, 2, 3, 4],
            };
            
            if (completionMethod === 'complete') {
              mockOnboardingService.completeOnboarding.mockResolvedValue(expectedResult);
            } else {
              mockOnboardingService.skipOnboarding.mockResolvedValue(expectedResult);
            }
            
            const endpoint = completionMethod === 'complete' ? '/complete' : '/skip';
            const response = await request(app)
              .post(`/api/v1/onboarding${endpoint}`)
              .set('Authorization', validToken);
            
            // EXPECTED TO FAIL: Completion flag should be set on user record
            // If this fails, it confirms completion flag setting bugs exist
            expect(response.status).toBe(200);
            expect(response.body.data.completed).toBe(true);
            expect(response.body.data.currentStep).toBe(5);
            
            // Verify the correct service method was called
            if (completionMethod === 'complete') {
              expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledWith('user-123');
            } else {
              expect(mockOnboardingService.skipOnboarding).toHaveBeenCalledWith('user-123');
            }
          }
        ),
        { numRuns: 8 }
      );
    });

    test('JWT claims should be updated after onboarding completion', () => {
      fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Whether to complete or skip
          async (shouldComplete) => {
            // Mock user with updated onboarding status
            const updatedUser = {
              ...mockUser,
              onboardingCompleted: true,
              onboardingStep: 5,
            };
            
            if (shouldComplete) {
              mockOnboardingService.completeOnboarding.mockResolvedValue({
                userId: 'user-123',
                currentStep: 5,
                completed: true,
                completedSteps: [0, 1, 2, 3, 4],
              });
            } else {
              mockOnboardingService.skipOnboarding.mockResolvedValue({
                userId: 'user-123',
                currentStep: 5,
                completed: true,
                completedSteps: [0, 1, 2, 3, 4],
              });
            }
            
            (User.findById as jest.Mock).mockResolvedValue(updatedUser);
            
            const endpoint = shouldComplete ? '/complete' : '/skip';
            const response = await request(app)
              .post(`/api/v1/onboarding${endpoint}`)
              .set('Authorization', validToken);
            
            // EXPECTED TO FAIL: JWT claims should be updated with new onboarding status
            // If this fails, it confirms JWT claims update bugs exist
            expect(response.status).toBe(200);
            
            // Should generate new token with updated claims
            expect(mockAuthTokenService.generateAccessToken).toHaveBeenCalledWith(
              expect.objectContaining({
                userId: 'user-123',
                onboardingCompleted: true,
              })
            );
          }
        ),
        { numRuns: 3 }
      );
    });

    test('unauthenticated requests should be blocked on all endpoints', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            endpoint: fc.constantFrom('/progress', '/step', '/complete', '/skip', '/needs-onboarding'),
            method: fc.constantFrom('GET', 'PUT', 'POST'),
            authHeader: fc.oneof(
              fc.constant(undefined), // No header
              fc.constant(''), // Empty header
              fc.constant('Invalid token'), // Invalid format
              fc.constant('Bearer'), // Missing token
              fc.constant('Basic dGVzdA=='), // Wrong auth type
            ),
          }),
          async (scenario) => {
            // Mock auth failure
            mockAuthTokenService.verifyAccessToken.mockImplementation(() => {
              throw new Error('Invalid token');
            });
            
            let response;
            const fullEndpoint = `/api/v1/onboarding${scenario.endpoint}`;
            
            if (scenario.method === 'GET') {
              response = await request(app)
                .get(fullEndpoint)
                .set('Authorization', scenario.authHeader || '');
            } else if (scenario.method === 'PUT') {
              response = await request(app)
                .put(fullEndpoint)
                .set('Authorization', scenario.authHeader || '')
                .send({ step: 1 });
            } else { // POST
              response = await request(app)
                .post(fullEndpoint)
                .set('Authorization', scenario.authHeader || '');
            }
            
            // EXPECTED TO FAIL: All endpoints should require authentication
            // If this fails, it confirms unauthenticated request blocking bugs exist
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
          }
        ),
        { numRuns: 3 }
      );
    });

    test('sensitive data should not leak in API responses', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            includePassword: fc.boolean(),
            includeTokens: fc.boolean(),
            includeSecrets: fc.boolean(),
          }),
          async (sensitiveDataScenario) => {
            // Mock user with sensitive data
            const userWithSensitiveData = {
              ...mockUser,
              password: 'hashed-password-123',
              refreshTokens: ['token1', 'token2'],
              twoFactorSecret: 'secret-123',
              passwordResetToken: 'reset-token-123',
              magicLinkToken: 'magic-token-123',
            };
            
            (User.findById as jest.Mock).mockResolvedValue(userWithSensitiveData);
            
            mockOnboardingService.getProgress.mockResolvedValue({
              userId: 'user-123',
              currentStep: 2,
              completed: false,
              completedSteps: [0, 1],
              user: userWithSensitiveData, // Accidentally include user object
            });
            
            const response = await request(app)
              .get('/api/v1/onboarding/progress')
              .set('Authorization', validToken);
            
            // EXPECTED TO FAIL: Sensitive data should not be exposed
            // If this fails, it confirms sensitive data leakage bugs exist
            expect(response.status).toBe(200);
            
            const responseText = JSON.stringify(response.body);
            
            // Check for sensitive data leakage
            expect(responseText).not.toMatch(/password/i);
            expect(responseText).not.toMatch(/refreshTokens/i);
            expect(responseText).not.toMatch(/twoFactorSecret/i);
            expect(responseText).not.toMatch(/passwordResetToken/i);
            expect(responseText).not.toMatch(/magicLinkToken/i);
            expect(responseText).not.toMatch(/hashed-password/i);
            expect(responseText).not.toMatch(/secret-123/i);
            expect(responseText).not.toMatch(/reset-token/i);
            expect(responseText).not.toMatch(/magic-token/i);
          }
        ),
        { numRuns: 3 }
      );
    });

    test('token storage should be secure and not accessible', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 20, maxLength: 100 }), // Access token
          fc.string({ minLength: 20, maxLength: 100 }), // Refresh token
          async (accessToken, refreshToken) => {
            // Mock token generation
            mockAuthTokenService.generateAccessToken.mockReturnValue(accessToken);
            mockAuthTokenService.generateRefreshToken.mockReturnValue(refreshToken);
            
            const response = await request(app)
              .post('/api/v1/onboarding/complete')
              .set('Authorization', validToken);
            
            // EXPECTED TO FAIL: Tokens should not be stored insecurely
            // If this fails, it confirms insecure token storage bugs exist
            
            // Tokens should not be in response headers
            expect(response.headers['x-access-token']).toBeUndefined();
            expect(response.headers['x-refresh-token']).toBeUndefined();
            
            // Tokens should not be in response body (unless explicitly requested)
            const responseText = JSON.stringify(response.body);
            expect(responseText).not.toContain(accessToken);
            expect(responseText).not.toContain(refreshToken);
            
            // Should use httpOnly cookies or secure headers
            if (response.headers['set-cookie']) {
              const cookies = response.headers['set-cookie'];
              cookies.forEach((cookie: string) => {
                if (cookie.includes('token') || cookie.includes('auth')) {
                  expect(cookie).toMatch(/httpOnly/i);
                  expect(cookie).toMatch(/secure/i);
                }
              });
            }
          }
        ),
        { numRuns: 3 }
      );
    });

    test('environment variables should be validated and not hardcoded', () => {
      fc.assert(
        fc.property(
          fc.record({
            jwtSecret: fc.oneof(fc.constant(undefined), fc.constant(''), fc.string({ minLength: 1, maxLength: 10 })),
            dbUrl: fc.oneof(fc.constant(undefined), fc.constant(''), fc.constant('invalid-url')),
            frontendUrl: fc.oneof(fc.constant(undefined), fc.constant(''), fc.constant('http://localhost')),
          }),
          (envVars) => {
            // Mock environment variables
            const originalEnv = process.env;
            process.env = {
              ...originalEnv,
              JWT_SECRET: envVars.jwtSecret,
              DATABASE_URL: envVars.dbUrl,
              FRONTEND_URL: envVars.frontendUrl,
            };
            
            // EXPECTED TO FAIL: Environment validation should catch missing/invalid values
            // If this fails, it confirms environment validation bugs exist
            
            // Check for hardcoded values in the codebase (this would be a static analysis)
            // For now, we'll check that the service doesn't use hardcoded secrets
            try {
              // This should fail if JWT_SECRET is missing or too weak
              if (!envVars.jwtSecret || envVars.jwtSecret.length < 32) {
                expect(() => {
                  mockAuthTokenService.generateAccessToken({ userId: 'test' });
                }).toThrow(/jwt.*secret|secret.*required|secret.*weak/i);
              }
            } finally {
              process.env = originalEnv;
            }
          }
        ),
        { numRuns: 3 }
      );
    });

    // Concrete examples for sanity checks
    it('concrete example: GET /progress with valid auth should return 200', async () => {
      mockOnboardingService.getProgress.mockResolvedValue({
        userId: 'user-123',
        currentStep: 2,
        completed: false,
        completedSteps: [0, 1],
      });
      
      const response = await request(app)
        .get('/api/v1/onboarding/progress')
        .set('Authorization', validToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStep).toBe(2);
    });

    it('concrete example: PUT /step without auth should return 401', async () => {
      const response = await request(app)
        .put('/api/v1/onboarding/step')
        .send({ step: 2 });
      
      expect(response.status).toBe(401);
    });

    it('concrete example: PUT /step with invalid step should return 400', async () => {
      const response = await request(app)
        .put('/api/v1/onboarding/step')
        .set('Authorization', validToken)
        .send({ step: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/step.*number/i);
    });

    it('concrete example: POST /complete should set completion flag', async () => {
      mockOnboardingService.completeOnboarding.mockResolvedValue({
        userId: 'user-123',
        currentStep: 5,
        completed: true,
        completedSteps: [0, 1, 2, 3, 4],
      });
      
      const response = await request(app)
        .post('/api/v1/onboarding/complete')
        .set('Authorization', validToken);
      
      expect(response.status).toBe(200);
      expect(response.body.data.completed).toBe(true);
      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledWith('user-123');
    });

    it('concrete example: response should not contain sensitive user data', async () => {
      const userWithSecrets = {
        ...mockUser,
        password: 'secret-password',
        refreshTokens: ['token1', 'token2'],
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      };
      
      (User.findById as jest.Mock).mockResolvedValue(userWithSecrets);
      
      mockOnboardingService.getProgress.mockResolvedValue({
        userId: 'user-123',
        currentStep: 1,
        completed: false,
        completedSteps: [0],
      });
      
      const response = await request(app)
        .get('/api/v1/onboarding/progress')
        .set('Authorization', validToken);
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('secret-password');
      expect(responseText).not.toContain('token1');
      expect(responseText).not.toContain('JBSWY3DPEHPK3PXP');
    });

    it('concrete example: invalid auth header format should return 401', async () => {
      mockAuthTokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token format');
      });
      
      const response = await request(app)
        .get('/api/v1/onboarding/progress')
        .set('Authorization', 'InvalidFormat token123');
      
      expect(response.status).toBe(401);
    });

    it('concrete example: step validation should match frontend rules', async () => {
      // Test negative step
      const response1 = await request(app)
        .put('/api/v1/onboarding/step')
        .set('Authorization', validToken)
        .send({ step: -1 });
      
      expect(response1.status).toBe(400);
      
      // Test step beyond maximum
      const response2 = await request(app)
        .put('/api/v1/onboarding/step')
        .set('Authorization', validToken)
        .send({ step: 10 });
      
      expect(response2.status).toBe(400);
      
      // Test non-integer step
      const response3 = await request(app)
        .put('/api/v1/onboarding/step')
        .set('Authorization', validToken)
        .send({ step: 2.5 });
      
      expect(response3.status).toBe(400);
    });

    it('concrete example: needs-onboarding should check completion status', async () => {
      mockOnboardingService.needsOnboarding.mockResolvedValue(true);
      
      const response = await request(app)
        .get('/api/v1/onboarding/needs-onboarding')
        .set('Authorization', validToken);
      
      expect(response.status).toBe(200);
      expect(response.body.data.needsOnboarding).toBe(true);
      expect(mockOnboardingService.needsOnboarding).toHaveBeenCalledWith('user-123');
    });
  });
});