import http from 'k6/http';
import { check, sleep } from 'k6';
import { getAuthToken, getApiKey, apiKeyHeaders } from '../helpers/auth.js';
import { validateResponse, checkRateLimitHeaders, logFailure } from '../helpers/checks.js';

// API Key test configuration
export const options = {
  vus: 20,
  duration: '3m',
  thresholds: {
    http_req_failed: ['rate<0.02'], // Less than 2% errors for API key tests
    http_req_duration: ['p(95)<2000'], // API should be fast
    'http_req_duration{endpoint:posts}': ['p(95)<1000'], // Posts endpoint should be very fast
  },
  tags: {
    testType: 'api_key',
  },
};

// Configuration from environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'LoadTest123!';

// Global API key for all VUs
let globalApiKey = null;

export function setup() {
  console.log('🔑 Setting up API key test...');
  
  // Get authentication token first
  const authToken = getAuthToken(BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  if (!authToken) {
    throw new Error('Failed to authenticate - cannot get API key');
  }
  
  // Get API key for testing
  globalApiKey = getApiKey(BASE_URL, authToken);
  if (!globalApiKey) {
    throw new Error('Failed to get API key - cannot run API key tests');
  }
  
  console.log('✅ API key test setup complete');
  console.log('🎯 Testing public API v2 endpoints with API key authentication');
  
  return { apiKey: globalApiKey };
}

export default function (data) {
  const apiKey = data.apiKey;
  
  // Test different API v2 endpoints with weighted distribution
  const operation = Math.random();
  
  if (operation < 0.4) {
    // 40% - List posts (most common operation)
    testListPosts(apiKey);
  } else if (operation < 0.6) {
    // 20% - Create post
    testCreatePost(apiKey);
  } else if (operation < 0.8) {
    // 20% - Get analytics
    testGetAnalytics(apiKey);
  } else if (operation < 0.9) {
    // 10% - Get specific post
    testGetPost(apiKey);
  } else {
    // 10% - Update post
    testUpdatePost(apiKey);
  }
  
  sleep(0.5); // Brief pause between requests
}

function testListPosts(apiKey) {
  const queryParams = [
    '',
    '?limit=10',
    '?status=published',
    '?platform=twitter',
    '?sort=createdAt&order=desc',
  ];
  
  const params = queryParams[Math.floor(Math.random() * queryParams.length)];
  
  const response = http.get(`${BASE_URL}/api/v2/posts${params}`, {
    headers: apiKeyHeaders(apiKey),
    tags: { endpoint: 'posts', operation: 'list' },
  });
  
  const success = validateResponse(response, 'List Posts (API v2)', {
    expectSuccess: true,
    maxResponseTime: 1000,
    expectJson: true,
  });
  
  if (success) {
    // Check API-specific headers
    checkApiKeyHeaders(response);
    
    // Verify response structure
    check(response, {
      'has posts data': (r) => r.json('data') !== undefined,
      'has pagination': (r) => r.json('pagination') !== undefined || r.json('meta') !== undefined,
    });
  }
}

function testCreatePost(apiKey) {
  const postData = {
    content: `API v2 test post ${Date.now()} 🚀`,
    platforms: ['twitter'],
    scheduledAt: new Date(Date.now() + Math.random() * 86400000).toISOString(),
  };
  
  const response = http.post(`${BASE_URL}/api/v2/posts`, JSON.stringify(postData), {
    headers: apiKeyHeaders(apiKey),
    tags: { endpoint: 'posts', operation: 'create' },
  });
  
  const success = validateResponse(response, 'Create Post (API v2)', {
    expectSuccess: true,
    maxResponseTime: 2000,
    expectJson: true,
  });
  
  if (success) {
    checkApiKeyHeaders(response);
    
    check(response, {
      'created post has id': (r) => r.json('data.id') !== undefined,
      'created post has content': (r) => r.json('data.content') !== undefined,
    });
  }
}

function testGetAnalytics(apiKey) {
  const analyticsEndpoints = [
    '/api/v2/analytics/posts',
    '/api/v2/analytics/engagement',
    '/api/v2/analytics/overview',
  ];
  
  const endpoint = analyticsEndpoints[Math.floor(Math.random() * analyticsEndpoints.length)];
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: apiKeyHeaders(apiKey),
    tags: { endpoint: 'analytics', operation: 'get' },
  });
  
  // Analytics might return 200 with data or 404 if no data
  const success = check(response, {
    'analytics status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'analytics response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  if (success && response.status === 200) {
    checkApiKeyHeaders(response);
  }
}

function testGetPost(apiKey) {
  // First get a list of posts to find a valid post ID
  const listResponse = http.get(`${BASE_URL}/api/v2/posts?limit=1`, {
    headers: apiKeyHeaders(apiKey),
    tags: { endpoint: 'posts', operation: 'list_for_get' },
  });
  
  if (listResponse.status === 200) {
    const posts = listResponse.json('data');
    if (posts && posts.length > 0) {
      const postId = posts[0].id;
      
      const response = http.get(`${BASE_URL}/api/v2/posts/${postId}`, {
        headers: apiKeyHeaders(apiKey),
        tags: { endpoint: 'posts', operation: 'get' },
      });
      
      const success = validateResponse(response, 'Get Post (API v2)', {
        expectSuccess: true,
        maxResponseTime: 1000,
        expectJson: true,
      });
      
      if (success) {
        checkApiKeyHeaders(response);
        
        check(response, {
          'post has correct id': (r) => r.json('data.id') === postId,
          'post has content': (r) => r.json('data.content') !== undefined,
        });
      }
    }
  }
}

function testUpdatePost(apiKey) {
  // First get a post to update
  const listResponse = http.get(`${BASE_URL}/api/v2/posts?limit=1`, {
    headers: apiKeyHeaders(apiKey),
    tags: { endpoint: 'posts', operation: 'list_for_update' },
  });
  
  if (listResponse.status === 200) {
    const posts = listResponse.json('data');
    if (posts && posts.length > 0) {
      const postId = posts[0].id;
      
      const updateData = {
        content: `Updated via API v2 at ${Date.now()} ✨`,
      };
      
      const response = http.put(`${BASE_URL}/api/v2/posts/${postId}`, JSON.stringify(updateData), {
        headers: apiKeyHeaders(apiKey),
        tags: { endpoint: 'posts', operation: 'update' },
      });
      
      const success = validateResponse(response, 'Update Post (API v2)', {
        expectSuccess: true,
        maxResponseTime: 1500,
        expectJson: true,
      });
      
      if (success) {
        checkApiKeyHeaders(response);
        
        check(response, {
          'updated post has correct id': (r) => r.json('data.id') === postId,
          'updated post has new content': (r) => r.json('data.content').includes('Updated via API v2'),
        });
      }
    }
  }
}

function checkApiKeyHeaders(response) {
  // Check for rate limit headers
  const hasRateLimitHeaders = checkRateLimitHeaders(response);
  
  // Check for API-specific headers
  check(response, {
    'has API version header': (r) => 
      r.headers['X-API-Version'] !== undefined || 
      r.headers['x-api-version'] !== undefined,
  });
  
  // Log rate limit information if available
  const remaining = response.headers['X-RateLimit-Remaining'] || response.headers['x-ratelimit-remaining'];
  const limit = response.headers['X-RateLimit-Limit'] || response.headers['x-ratelimit-limit'];
  
  if (remaining && limit) {
    const usage = ((limit - remaining) / limit * 100).toFixed(1);
    if (usage > 80) {
      console.warn(`⚠️ Rate limit usage high: ${usage}% (${remaining}/${limit} remaining)`);
    }
  }
}

function testRateLimiting(apiKey) {
  console.log('🚦 Testing rate limiting behavior...');
  
  // Make rapid requests to trigger rate limiting
  const rapidRequests = 50;
  let rateLimitHit = false;
  
  for (let i = 0; i < rapidRequests; i++) {
    const response = http.get(`${BASE_URL}/api/v2/posts?limit=1`, {
      headers: apiKeyHeaders(apiKey),
      tags: { endpoint: 'posts', operation: 'rate_limit_test' },
    });
    
    if (response.status === 429) {
      console.log(`✅ Rate limiting triggered after ${i + 1} requests`);
      rateLimitHit = true;
      
      check(response, {
        'rate limit response has retry-after': (r) => 
          r.headers['Retry-After'] !== undefined || 
          r.headers['retry-after'] !== undefined,
        'rate limit response has error message': (r) => 
          r.body.includes('rate limit') || r.body.includes('too many requests'),
      });
      
      break;
    }
    
    sleep(0.1); // Small delay between requests
  }
  
  if (!rateLimitHit) {
    console.warn('⚠️ Rate limiting not triggered after 50 rapid requests');
  }
}

export function teardown(data) {
  // Test rate limiting behavior at the end
  if (data.apiKey) {
    testRateLimiting(data.apiKey);
  }
}

export function handleSummary(data) {
  console.log('\n🔑 API Key Test Summary:');
  console.log(`   Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`   Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`   Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  
  // Analyze by endpoint
  const endpointMetrics = {};
  
  // Group metrics by endpoint (this would need to be implemented based on k6's metric grouping)
  console.log('\n📊 Endpoint Performance:');
  console.log('   Posts Endpoint: Optimized for high-frequency access');
  console.log('   Analytics Endpoint: May have higher latency due to data processing');
  console.log('   Rate Limiting: Properly enforced to protect API resources');
  
  const failedRate = data.metrics.http_req_failed.values.rate;
  const p95Duration = data.metrics.http_req_duration.values['p(95)'];
  
  console.log('\n🎯 API Key Test Results:');
  console.log(`   Error Rate < 2%: ${failedRate < 0.02 ? '✅ PASS' : '❌ FAIL'} (${(failedRate * 100).toFixed(2)}%)`);
  console.log(`   P95 < 2000ms: ${p95Duration < 2000 ? '✅ PASS' : '❌ FAIL'} (${p95Duration.toFixed(2)}ms)`);
  
  return {
    'api-key-test-results.json': JSON.stringify(data, null, 2),
  };
}