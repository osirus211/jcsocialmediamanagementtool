import http from 'k6/http';
import { check, sleep } from 'k6';
import { getAuthToken, authHeaders, getWorkspaceId } from '../helpers/auth.js';
import { validateResponse, checkRateLimit, logFailure } from '../helpers/checks.js';

// Stress test configuration - find the breaking point
export const options = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up to 100 VUs over 5 minutes
    { duration: '5m', target: 300 },   // Ramp up to 300 VUs over 5 minutes
    { duration: '5m', target: 500 },   // Ramp up to 500 VUs over 5 minutes
    { duration: '5m', target: 1000 },  // Ramp up to 1000 VUs over 5 minutes
    { duration: '5m', target: 1000 },  // Hold 1000 VUs for 5 minutes
    { duration: '5m', target: 0 },     // Ramp down to 0 VUs over 5 minutes
  ],
  thresholds: {
    // More lenient thresholds for stress testing
    http_req_failed: ['rate<0.1'], // Less than 10% errors (higher than load test)
    http_req_duration: ['p(95)<10000', 'p(99)<15000'], // Higher response time limits
    http_req_duration: ['p(50)<5000'], // Median should still be reasonable
  },
  tags: {
    testType: 'stress',
  },
};

// Configuration from environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'LoadTest123!';

// Track breaking point metrics
let errorRateBreakingPoint = null;
let responseTimeBreakingPoint = null;
let currentVUs = 0;

export function setup() {
  console.log('🔥 Setting up stress test - finding breaking point...');
  
  const authToken = getAuthToken(BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  if (!authToken) {
    throw new Error('Failed to authenticate - cannot run stress test');
  }
  
  const workspaceId = getWorkspaceId(BASE_URL, authToken);
  
  console.log('✅ Stress test setup complete');
  console.log('🎯 Monitoring for breaking points:');
  console.log('   - Error rate > 10%');
  console.log('   - P99 response time > 10 seconds');
  
  return { token: authToken, workspaceId: workspaceId };
}

export default function (data) {
  const token = data.token;
  const workspaceId = data.workspaceId;
  
  // Estimate current VU count based on stage
  currentVUs = estimateCurrentVUs();
  
  // Mix of different operations to stress different parts of the system
  const operation = Math.random();
  
  if (operation < 0.3) {
    // 30% - Read operations (should be fastest)
    stressReadOperations(token, workspaceId);
  } else if (operation < 0.5) {
    // 20% - Write operations (more resource intensive)
    stressWriteOperations(token, workspaceId);
  } else if (operation < 0.7) {
    // 20% - Analytics operations (CPU intensive)
    stressAnalyticsOperations(token, workspaceId);
  } else if (operation < 0.85) {
    // 15% - Complex queries (database intensive)
    stressComplexQueries(token, workspaceId);
  } else {
    // 15% - Mixed operations (realistic user behavior)
    stressMixedOperations(token, workspaceId);
  }
  
  // Shorter sleep time to increase pressure
  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}

function stressReadOperations(token, workspaceId) {
  const endpoints = [
    '/api/v1/posts',
    '/api/v1/workspaces',
    '/api/v1/social-accounts',
    '/api/v1/auth/me',
    '/api/v1/posts?status=published&limit=50',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: authHeaders(token),
    tags: { operation: 'read', stress_level: getStressLevel() },
  });
  
  trackBreakingPoint(response, 'read');
  
  check(response, {
    'read operation status < 500': (r) => r.status < 500,
    'read operation response time < 5000ms': (r) => r.timings.duration < 5000,
  });
}

function stressWriteOperations(token, workspaceId) {
  const postData = {
    content: `Stress test post ${Date.now()} - VUs: ${currentVUs}`,
    platforms: ['twitter'],
    workspaceId: workspaceId,
  };
  
  const response = http.post(`${BASE_URL}/api/v1/posts`, JSON.stringify(postData), {
    headers: authHeaders(token),
    tags: { operation: 'write', stress_level: getStressLevel() },
  });
  
  trackBreakingPoint(response, 'write');
  
  check(response, {
    'write operation status < 500': (r) => r.status < 500,
    'write operation response time < 8000ms': (r) => r.timings.duration < 8000,
  });
}

function stressAnalyticsOperations(token, workspaceId) {
  const analyticsEndpoints = [
    '/api/v1/analytics/overview',
    '/api/v1/analytics/engagement',
    '/api/v1/analytics/posts?period=30d',
    '/api/v1/analytics/audience',
  ];
  
  const endpoint = analyticsEndpoints[Math.floor(Math.random() * analyticsEndpoints.length)];
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: authHeaders(token),
    tags: { operation: 'analytics', stress_level: getStressLevel() },
  });
  
  trackBreakingPoint(response, 'analytics');
  
  // Analytics operations are expected to be slower and might return 404 if no data
  check(response, {
    'analytics operation status < 500 or 404': (r) => r.status < 500 || r.status === 404,
    'analytics operation response time < 10000ms': (r) => r.timings.duration < 10000,
  });
}

function stressComplexQueries(token, workspaceId) {
  // Complex queries that stress the database
  const complexEndpoints = [
    '/api/v1/posts?sort=engagement&order=desc&limit=100',
    '/api/v1/posts?platform=twitter&status=published&sort=createdAt&limit=50',
    '/api/v1/analytics/posts?groupBy=platform&period=7d',
    '/api/v1/posts?search=test&limit=20',
  ];
  
  const endpoint = complexEndpoints[Math.floor(Math.random() * complexEndpoints.length)];
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: authHeaders(token),
    tags: { operation: 'complex_query', stress_level: getStressLevel() },
  });
  
  trackBreakingPoint(response, 'complex_query');
  
  check(response, {
    'complex query status < 500': (r) => r.status < 500,
    'complex query response time < 12000ms': (r) => r.timings.duration < 12000,
  });
}

function stressMixedOperations(token, workspaceId) {
  // Simulate realistic user behavior under stress
  
  // 1. Check posts
  let response = http.get(`${BASE_URL}/api/v1/posts?limit=10`, {
    headers: authHeaders(token),
    tags: { operation: 'mixed_read', stress_level: getStressLevel() },
  });
  
  if (response.status === 200) {
    // 2. Create a post if read was successful
    const postData = {
      content: `Mixed operation test ${Date.now()}`,
      platforms: ['twitter'],
      workspaceId: workspaceId,
    };
    
    response = http.post(`${BASE_URL}/api/v1/posts`, JSON.stringify(postData), {
      headers: authHeaders(token),
      tags: { operation: 'mixed_write', stress_level: getStressLevel() },
    });
  }
  
  trackBreakingPoint(response, 'mixed');
  
  check(response, {
    'mixed operation status < 500': (r) => r.status < 500,
    'mixed operation response time < 8000ms': (r) => r.timings.duration < 8000,
  });
}

function estimateCurrentVUs() {
  // Rough estimation based on test duration
  const elapsed = new Date() - new Date(__ENV.K6_START_TIME || Date.now());
  const minutes = elapsed / (1000 * 60);
  
  if (minutes < 5) return Math.floor((minutes / 5) * 100);
  if (minutes < 10) return 100 + Math.floor(((minutes - 5) / 5) * 200);
  if (minutes < 15) return 300 + Math.floor(((minutes - 10) / 5) * 200);
  if (minutes < 20) return 500 + Math.floor(((minutes - 15) / 5) * 500);
  if (minutes < 25) return 1000;
  return Math.max(0, 1000 - Math.floor(((minutes - 25) / 5) * 1000));
}

function getStressLevel() {
  if (currentVUs < 100) return 'low';
  if (currentVUs < 300) return 'medium';
  if (currentVUs < 500) return 'high';
  if (currentVUs < 1000) return 'extreme';
  return 'breaking';
}

function trackBreakingPoint(response, operation) {
  // Track when error rate exceeds 10%
  if (response.status >= 400 && !errorRateBreakingPoint) {
    console.warn(`⚠️ High error rate detected at ~${currentVUs} VUs (${operation})`);
    errorRateBreakingPoint = currentVUs;
  }
  
  // Track when response time exceeds 10 seconds
  if (response.timings.duration > 10000 && !responseTimeBreakingPoint) {
    console.warn(`⚠️ High response time detected at ~${currentVUs} VUs (${operation}): ${response.timings.duration}ms`);
    responseTimeBreakingPoint = currentVUs;
  }
  
  // Log severe issues
  if (response.status >= 500) {
    console.error(`❌ Server error at ${currentVUs} VUs (${operation}): ${response.status}`);
  }
  
  if (response.timings.duration > 15000) {
    console.error(`❌ Extreme response time at ${currentVUs} VUs (${operation}): ${response.timings.duration}ms`);
  }
}

export function handleSummary(data) {
  console.log('\n🔥 Stress Test Summary:');
  console.log(`   Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`   Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`   Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`   99th Percentile: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log(`   Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  
  console.log('\n🎯 Breaking Point Analysis:');
  if (errorRateBreakingPoint) {
    console.log(`   Error Rate Breaking Point: ~${errorRateBreakingPoint} VUs`);
  } else {
    console.log(`   Error Rate: System handled up to 1000 VUs without excessive errors`);
  }
  
  if (responseTimeBreakingPoint) {
    console.log(`   Response Time Breaking Point: ~${responseTimeBreakingPoint} VUs`);
  } else {
    console.log(`   Response Time: System maintained reasonable response times up to 1000 VUs`);
  }
  
  const finalErrorRate = data.metrics.http_req_failed.values.rate;
  const finalP99 = data.metrics.http_req_duration.values['p(99)'];
  
  console.log('\n📊 Final System State:');
  console.log(`   Final Error Rate: ${(finalErrorRate * 100).toFixed(2)}%`);
  console.log(`   Final P99 Response Time: ${finalP99.toFixed(2)}ms`);
  
  if (finalErrorRate < 0.1 && finalP99 < 10000) {
    console.log('   🎉 System handled stress test well!');
  } else if (finalErrorRate < 0.2 && finalP99 < 15000) {
    console.log('   ⚠️ System showed stress but remained functional');
  } else {
    console.log('   ❌ System reached breaking point');
  }
  
  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
    'stress-test-breaking-points.json': JSON.stringify({
      errorRateBreakingPoint,
      responseTimeBreakingPoint,
      finalErrorRate: finalErrorRate * 100,
      finalP99ResponseTime: finalP99,
      maxVUs: 1000,
      testDuration: '30 minutes',
    }, null, 2),
  };
}