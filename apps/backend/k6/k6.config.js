// Shared k6 configuration
// This file contains common configuration settings used across all k6 test scenarios

// Environment variables with defaults
export const config = {
  // Base URL for the API
  BASE_URL: __ENV.BASE_URL || 'http://localhost:5000',
  
  // Test user credentials
  TEST_USER_EMAIL: __ENV.TEST_USER_EMAIL || 'loadtest@example.com',
  TEST_USER_PASSWORD: __ENV.TEST_USER_PASSWORD || 'LoadTest123!',
  
  // Test environment settings
  TEST_WORKSPACE_ID: __ENV.TEST_WORKSPACE_ID || null,
  TEST_API_KEY: __ENV.TEST_API_KEY || null,
  
  // Test data settings
  CREATE_TEST_DATA: __ENV.CREATE_TEST_DATA === 'true',
  CLEANUP_TEST_DATA: __ENV.CLEANUP_TEST_DATA === 'true',
  
  // Output settings
  OUTPUT_DIR: __ENV.OUTPUT_DIR || './k6/reports',
  ENABLE_HTML_REPORT: __ENV.ENABLE_HTML_REPORT !== 'false',
  
  // Performance settings
  MAX_VUS: parseInt(__ENV.MAX_VUS) || 1000,
  TEST_DURATION: __ENV.TEST_DURATION || '10m',
  
  // Debugging
  DEBUG: __ENV.DEBUG === 'true',
  VERBOSE: __ENV.VERBOSE === 'true',
};

// Default thresholds that can be used across tests
export const defaultThresholds = {
  // Error rate thresholds
  http_req_failed: ['rate<0.05'], // Less than 5% errors
  
  // Response time thresholds
  http_req_duration: ['p(95)<3000', 'p(99)<5000'], // 95th percentile under 3s, 99th under 5s
  http_req_duration: ['avg<1000'], // Average response time under 1s
  
  // Specific endpoint thresholds
  'http_req_duration{endpoint:health}': ['p(95)<500'], // Health check should be very fast
  'http_req_duration{endpoint:auth}': ['p(95)<1000'], // Auth should be fast
  'http_req_duration{endpoint:posts}': ['p(95)<2000'], // Posts can be slightly slower
  'http_req_duration{endpoint:analytics}': ['p(95)<5000'], // Analytics can be slower
};

// Common tags applied to all requests
export const defaultTags = {
  environment: __ENV.NODE_ENV || 'test',
  version: __ENV.API_VERSION || 'v1',
  region: __ENV.REGION || 'local',
};

// Rate limiting configuration (matches backend settings)
export const rateLimits = {
  // Per-user rate limits (requests per minute)
  userRateLimit: 1000,
  
  // Per-workspace rate limits
  workspaceRateLimit: 5000,
  
  // API key rate limits
  apiKeyRateLimit: 10000,
  
  // Burst limits
  burstLimit: 100,
};

// Test data templates
export const testData = {
  posts: [
    {
      content: 'Load test post #1 - Testing system performance 🚀',
      platforms: ['twitter'],
    },
    {
      content: 'Load test post #2 - Social media automation at scale ⚡',
      platforms: ['linkedin'],
    },
    {
      content: 'Load test post #3 - Building robust APIs 🔧',
      platforms: ['twitter', 'linkedin'],
    },
    {
      content: 'Load test post #4 - Performance testing with k6 💪',
      platforms: ['instagram'],
    },
    {
      content: 'Load test post #5 - Production-ready social media management 📊',
      platforms: ['twitter'],
    },
  ],
  
  users: [
    {
      email: 'loadtest1@example.com',
      password: 'LoadTest123!',
      firstName: 'Load',
      lastName: 'Test1',
    },
    {
      email: 'loadtest2@example.com',
      password: 'LoadTest123!',
      firstName: 'Load',
      lastName: 'Test2',
    },
  ],
};

// Utility functions for configuration
export function getStageConfig(testType) {
  const stages = {
    smoke: [
      { duration: '1m', target: 1 },
    ],
    
    load: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 200 },
      { duration: '3m', target: 200 },
      { duration: '2m', target: 0 },
    ],
    
    stress: [
      { duration: '5m', target: 100 },
      { duration: '5m', target: 300 },
      { duration: '5m', target: 500 },
      { duration: '5m', target: 1000 },
      { duration: '5m', target: 1000 },
      { duration: '5m', target: 0 },
    ],
    
    spike: [
      { duration: '2m', target: 10 },
      { duration: '30s', target: 500 },
      { duration: '2m', target: 500 },
      { duration: '30s', target: 10 },
      { duration: '2m', target: 10 },
    ],
    
    volume: [
      { duration: '10m', target: 100 },
      { duration: '30m', target: 100 },
      { duration: '10m', target: 0 },
    ],
  };
  
  return stages[testType] || stages.load;
}

export function getThresholds(testType) {
  const thresholds = {
    smoke: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<2000'],
    },
    
    load: {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    },
    
    stress: {
      http_req_failed: ['rate<0.1'],
      http_req_duration: ['p(95)<10000', 'p(99)<15000'],
    },
    
    spike: {
      http_req_failed: ['rate<0.15'],
      http_req_duration: ['p(95)<8000'],
    },
    
    api_key: {
      http_req_failed: ['rate<0.02'],
      http_req_duration: ['p(95)<2000'],
    },
  };
  
  return thresholds[testType] || thresholds.load;
}

// Logging utility
export function log(message, level = 'info') {
  if (config.DEBUG || config.VERBOSE || level === 'error') {
    const timestamp = new Date().toISOString();
    const prefix = level.toUpperCase();
    console.log(`[${timestamp}] ${prefix}: ${message}`);
  }
}

// Environment validation
export function validateEnvironment() {
  const required = ['BASE_URL'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate URL format
  try {
    new URL(config.BASE_URL);
  } catch (e) {
    throw new Error(`Invalid BASE_URL format: ${config.BASE_URL}`);
  }
  
  log(`Environment validated. BASE_URL: ${config.BASE_URL}`);
}

// Export default configuration
export default {
  config,
  defaultThresholds,
  defaultTags,
  rateLimits,
  testData,
  getStageConfig,
  getThresholds,
  log,
  validateEnvironment,
};