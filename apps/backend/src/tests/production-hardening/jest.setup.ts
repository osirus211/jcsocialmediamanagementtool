/**
 * Jest Setup for Production Hardening Tests
 * 
 * Configures test environment, extends timeouts for specific test types,
 * and sets up global test utilities.
 */

// Set VALIDATION_MODE to skip OAuth validation in tests
process.env.VALIDATION_MODE = 'true';

// Set required environment variables for tests
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media-test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars
process.env.NODE_ENV = 'test';

// Extend timeout for property-based tests
jest.setTimeout(120000); // 120 seconds for property tests

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

// Global test utilities (removed - not needed for these tests)

// Cleanup handler
afterAll(async () => {
  // Give time for async cleanup operations
  await new Promise((resolve) => setTimeout(resolve, 1000));
});
