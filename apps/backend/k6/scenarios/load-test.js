import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { getAuthToken, authHeaders, getWorkspaceId } from '../helpers/auth.js';
import { validateResponse, checkRateLimit } from '../helpers/checks.js';

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 VUs over 2 minutes
    { duration: '5m', target: 50 },   // Stay at 50 VUs for 5 minutes
    { duration: '2m', target: 200 },  // Ramp up to 200 VUs over 2 minutes
    { duration: '3m', target: 200 },  // Stay at 200 VUs for 3 minutes
    { duration: '2m', target: 0 },    // Ramp down to 0 VUs over 2 minutes
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Less than 5% errors
    http_req_duration: ['p(95)<3000', 'p(99)<5000'], // Response time thresholds
    'http_req_duration{scenario:read_posts}': ['p(95)<1000'], // Read posts should be fast
    'http_req_duration{scenario:analytics}': ['p(95)<2000'], // Analytics can be slower
  },
  tags: {
    testType: 'load',
  },
};

// Configuration from environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'LoadTest123!';

// Shared test data
const testPosts = new SharedArray('test posts', function () {
  return [
    { content: 'Load test post #1 🚀', platforms: ['twitter'] },
    { content: 'Testing system performance with k6 💪', platforms: ['linkedin'] },
    { content: 'Social media automation at scale ⚡', platforms: ['twitter', 'linkedin'] },
    { content: 'Building robust APIs for social media management 🔧', platforms: ['instagram'] },
    { content: 'Performance testing is crucial for production readiness 📊', platforms: ['twitter'] },
  ];
});

// Global variables for authentication
let authToken = null;
let workspaceId = null;

export function setup() {
  console.log('🔧 Setting up load test...');
  
  // Authenticate once for all VUs
  authToken = getAuthToken(BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  if (!authToken) {
    throw new Error('Failed to authenticate - cannot run load test');
  }
  
  // Get workspace ID
  workspaceId = getWorkspaceId(BASE_URL, authToken);
  if (!workspaceId) {
    console.warn('⚠️ Could not get workspace ID - some tests may fail');
  }
  
  console.log('✅ Load test setup complete');
  return { token: authToken, workspaceId: workspaceId };
}

export default function (data) {
  const token = data.token;
  const workspaceId = data.workspaceId;
  
  // Weighted scenario selection (40% read, 20% create, 20% analytics, 10% media, 10% calendar)
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - Read posts scenario
    readPosts(token, workspaceId);
  } else if (scenario < 0.6) {
    // 20% - Create post scenario
    createPost(token, workspaceId);
  } else if (scenario < 0.8) {
    // 20% - Get analytics scenario
    getAnalytics(token, workspaceId);
  } else if (scenario < 0.9) {
    // 10% - Upload media scenario (simulated)
    uploadMedia(token, workspaceId);
  } else {
    // 10% - Get calendar scenario
    getCalendar(token, workspaceId);
  }
  
  sleep(1); // Think time between requests
}

function readPosts(token, workspaceId) {
  const filters = [
    '?status=published',
    '?status=scheduled',
    '?platform=twitter',
    '?platform=linkedin',
    '?limit=20',
    '?sort=createdAt&order=desc',
  ];
  
  const filter = filters[Math.floor(Math.random() * filters.length)];
  
  const response = http.get(`${BASE_URL}/api/v1/posts${filter}`, {
    headers: authHeaders(token),
    tags: { scenario: 'read_posts' },
  });
  
  validateResponse(response, 'Read Posts', {
    expectSuccess: true,
    maxResponseTime: 1000,
    expectJson: true,
  });
  
  checkRateLimit(response);
}

function createPost(token, workspaceId) {
  const testPost = testPosts[Math.floor(Math.random() * testPosts.length)];
  
  const postData = {
    content: testPost.content + ` (${new Date().getTime()})`, // Make unique
    platforms: testPost.platforms,
    workspaceId: workspaceId,
    scheduledAt: new Date(Date.now() + Math.random() * 86400000).toISOString(), // Random time in next 24h
  };
  
  const response = http.post(`${BASE_URL}/api/v1/posts`, JSON.stringify(postData), {
    headers: authHeaders(token),
    tags: { scenario: 'create_post' },
  });
  
  validateResponse(response, 'Create Post', {
    expectSuccess: true,
    maxResponseTime: 2000,
    expectJson: true,
  });
  
  checkRateLimit(response);
}

function getAnalytics(token, workspaceId) {
  const analyticsEndpoints = [
    '/api/v1/analytics/overview',
    '/api/v1/analytics/engagement',
    '/api/v1/analytics/posts',
    '/api/v1/analytics/audience',
  ];
  
  const endpoint = analyticsEndpoints[Math.floor(Math.random() * analyticsEndpoints.length)];
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: authHeaders(token),
    tags: { scenario: 'analytics' },
  });
  
  // Analytics might return 200 with data or 404 if no data available
  check(response, {
    'analytics status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'analytics response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  checkRateLimit(response);
}

function uploadMedia(token, workspaceId) {
  // Simulate media upload by creating a media record
  // In real scenario, this would be multipart form data
  const mediaData = {
    filename: `test-image-${Math.random().toString(36).substr(2, 9)}.jpg`,
    type: 'image/jpeg',
    size: Math.floor(Math.random() * 1000000) + 100000, // Random size 100KB-1MB
    workspaceId: workspaceId,
  };
  
  const response = http.post(`${BASE_URL}/api/v1/media`, JSON.stringify(mediaData), {
    headers: authHeaders(token),
    tags: { scenario: 'upload_media' },
  });
  
  // Media upload might fail if not properly configured, so be lenient
  check(response, {
    'media upload status < 500': (r) => r.status < 500,
    'media upload response time < 3000ms': (r) => r.timings.duration < 3000,
  });
  
  checkRateLimit(response);
}

function getCalendar(token, workspaceId) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const response = http.get(`${BASE_URL}/api/v1/posts?view=calendar&start=${startDate}&end=${endDate}`, {
    headers: authHeaders(token),
    tags: { scenario: 'calendar' },
  });
  
  validateResponse(response, 'Get Calendar', {
    expectSuccess: true,
    maxResponseTime: 1500,
    expectJson: true,
  });
  
  checkRateLimit(response);
}

export function handleSummary(data) {
  console.log('📊 Load Test Summary:');
  console.log(`   Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`   Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`   Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`   99th Percentile: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  
  // Check if thresholds were met
  const failedRate = data.metrics.http_req_failed.values.rate;
  const p95Duration = data.metrics.http_req_duration.values['p(95)'];
  const p99Duration = data.metrics.http_req_duration.values['p(99)'];
  
  console.log('\n🎯 Threshold Results:');
  console.log(`   Error Rate < 5%: ${failedRate < 0.05 ? '✅ PASS' : '❌ FAIL'} (${(failedRate * 100).toFixed(2)}%)`);
  console.log(`   P95 < 3000ms: ${p95Duration < 3000 ? '✅ PASS' : '❌ FAIL'} (${p95Duration.toFixed(2)}ms)`);
  console.log(`   P99 < 5000ms: ${p99Duration < 5000 ? '✅ PASS' : '❌ FAIL'} (${p99Duration.toFixed(2)}ms)`);
  
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.html': generateHtmlReport(data),
  };
}

function generateHtmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Load Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; }
        .pass { color: green; }
        .fail { color: red; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Load Test Results</h1>
    <h2>Summary</h2>
    <div class="metric">Total Requests: ${data.metrics.http_reqs.values.count}</div>
    <div class="metric">Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</div>
    <div class="metric">Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</div>
    <div class="metric">95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</div>
    <div class="metric">99th Percentile: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</div>
    
    <h2>Threshold Results</h2>
    <table>
        <tr><th>Metric</th><th>Threshold</th><th>Actual</th><th>Result</th></tr>
        <tr>
            <td>Error Rate</td>
            <td>&lt; 5%</td>
            <td>${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</td>
            <td class="${data.metrics.http_req_failed.values.rate < 0.05 ? 'pass' : 'fail'}">
                ${data.metrics.http_req_failed.values.rate < 0.05 ? 'PASS' : 'FAIL'}
            </td>
        </tr>
        <tr>
            <td>95th Percentile</td>
            <td>&lt; 3000ms</td>
            <td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td>
            <td class="${data.metrics.http_req_duration.values['p(95)'] < 3000 ? 'pass' : 'fail'}">
                ${data.metrics.http_req_duration.values['p(95)'] < 3000 ? 'PASS' : 'FAIL'}
            </td>
        </tr>
    </table>
</body>
</html>`;
}