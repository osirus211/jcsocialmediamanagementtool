import http from 'k6/http';
import { check, sleep } from 'k6';
import { getAuthToken, authHeaders } from '../helpers/auth.js';
import { validateResponse, logFailure } from '../helpers/checks.js';

// Test configuration
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
  },
  tags: {
    testType: 'smoke',
  },
};

// Configuration from environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'LoadTest123!';

export default function () {
  console.log('🔥 Starting smoke test...');
  
  // Test 1: Health check
  console.log('1️⃣ Testing health check...');
  const healthResponse = http.get(`${BASE_URL}/api/v1/health`);
  
  const healthPassed = check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check has uptime': (r) => r.json('uptime') !== undefined,
  });
  
  if (!healthPassed) {
    logFailure(healthResponse, 'Health Check');
    return; // Exit early if health check fails
  }
  
  sleep(0.5);
  
  // Test 2: Authentication
  console.log('2️⃣ Testing authentication...');
  const token = getAuthToken(BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  
  if (!token) {
    console.error('❌ Authentication failed - cannot continue with remaining tests');
    return;
  }
  
  console.log('✅ Authentication successful');
  sleep(0.5);
  
  // Test 3: Get workspaces
  console.log('3️⃣ Testing workspaces endpoint...');
  const workspacesResponse = http.get(`${BASE_URL}/api/v1/workspaces`, {
    headers: authHeaders(token),
  });
  
  validateResponse(workspacesResponse, 'Get Workspaces', {
    expectSuccess: true,
    maxResponseTime: 2000,
    expectJson: true,
  });
  
  sleep(0.5);
  
  // Test 4: Get posts
  console.log('4️⃣ Testing posts endpoint...');
  const postsResponse = http.get(`${BASE_URL}/api/v1/posts`, {
    headers: authHeaders(token),
  });
  
  validateResponse(postsResponse, 'Get Posts', {
    expectSuccess: true,
    maxResponseTime: 2000,
    expectJson: true,
  });
  
  sleep(0.5);
  
  // Test 5: Get social accounts
  console.log('5️⃣ Testing social accounts endpoint...');
  const socialResponse = http.get(`${BASE_URL}/api/v1/social-accounts`, {
    headers: authHeaders(token),
  });
  
  validateResponse(socialResponse, 'Get Social Accounts', {
    expectSuccess: true,
    maxResponseTime: 2000,
    expectJson: true,
  });
  
  sleep(0.5);
  
  // Test 6: API v2 health (Zapier integration)
  console.log('6️⃣ Testing API v2 health...');
  const apiV2Response = http.get(`${BASE_URL}/api/v2/zapier/auth/test`, {
    headers: authHeaders(token),
  });
  
  const apiV2Passed = check(apiV2Response, {
    'API v2 health status is 200': (r) => r.status === 200,
  });
  
  if (!apiV2Passed) {
    logFailure(apiV2Response, 'API v2 Health');
  }
  
  sleep(0.5);
  
  // Test 7: Get user profile
  console.log('7️⃣ Testing user profile endpoint...');
  const profileResponse = http.get(`${BASE_URL}/api/v1/auth/me`, {
    headers: authHeaders(token),
  });
  
  validateResponse(profileResponse, 'Get User Profile', {
    expectSuccess: true,
    maxResponseTime: 1000,
    expectJson: true,
  });
  
  // Test 8: Get analytics (basic)
  console.log('8️⃣ Testing analytics endpoint...');
  const analyticsResponse = http.get(`${BASE_URL}/api/v1/analytics/overview`, {
    headers: authHeaders(token),
  });
  
  // Analytics might return 200 with empty data or 404 if no data
  check(analyticsResponse, {
    'analytics status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'analytics response time < 3000ms': (r) => r.timings.duration < 3000,
  });
  
  console.log('🎉 Smoke test completed!');
}

export function handleSummary(data) {
  console.log('📊 Smoke Test Summary:');
  console.log(`   Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`   Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%`);
  console.log(`   Average Response Time: ${data.metrics.http_req_duration.values.avg}ms`);
  console.log(`   95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms`);
  
  return {
    'smoke-test-results.json': JSON.stringify(data, null, 2),
  };
}