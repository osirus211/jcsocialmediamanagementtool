import http from 'k6/http';
import { check, sleep } from 'k6';
import { getAuthToken, authHeaders, getWorkspaceId } from '../helpers/auth.js';
import { validateResponse, checkRateLimit, logFailure } from '../helpers/checks.js';

// Spike test configuration - sudden traffic burst
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Baseline: 10 VUs for 2 minutes
    { duration: '30s', target: 500 }, // Spike: 10→500 VUs in 30 seconds
    { duration: '2m', target: 500 },  // Hold spike: 500 VUs for 2 minutes
    { duration: '30s', target: 10 },  // Drop: 500→10 VUs in 30 seconds
    { duration: '2m', target: 10 },   // Recovery: 10 VUs for 2 minutes
  ],
  thresholds: {
    // Lenient thresholds during spike, strict during recovery
    http_req_failed: ['rate<0.15'], // Allow up to 15% errors during spike
    http_req_duration: ['p(95)<8000'], // Allow higher response times during spike
    'http_req_duration{phase:baseline}': ['p(95)<2000'], // Baseline should be fast
    'http_req_duration{phase:recovery}': ['p(95)<2000'], // Recovery should be fast
  },
  tags: {
    testType: 'spike',
  },
};

// Configuration from environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'LoadTest123!';

// Track system behavior during different phases
let spikeMetrics = {
  baseline: { errors: 0, requests: 0, totalResponseTime: 0 },
  spike: { errors: 0, requests: 0, totalResponseTime: 0 },
  recovery: { errors: 0, requests: 0, totalResponseTime: 0 },
};

export function setup() {
  console.log('⚡ Setting up spike test...');
  
  const authToken = getAuthToken(BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  if (!authToken) {
    throw new Error('Failed to authenticate - cannot run spike test');
  }
  
  const workspaceId = getWorkspaceId(BASE_URL, authToken);
  
  console.log('✅ Spike test setup complete');
  console.log('🎯 Testing system behavior during traffic spikes:');
  console.log('   - Baseline: 10 VUs for 2 minutes');
  console.log('   - Spike: 10→500 VUs in 30 seconds');
  console.log('   - Hold: 500 VUs for 2 minutes');
  console.log('   - Drop: 500→10 VUs in 30 seconds');
  console.log('   - Recovery: 10 VUs for 2 minutes');
  
  return { token: authToken, workspaceId: workspaceId };
}

export default function (data) {
  const token = data.token;
  const workspaceId = data.workspaceId;
  
  // Determine current phase based on execution time
  const phase = getCurrentPhase();
  
  // Different behavior based on phase
  if (phase === 'baseline' || phase === 'recovery') {
    // Normal user behavior during baseline and recovery
    normalUserBehavior(token, workspaceId, phase);
  } else if (phase === 'spike' || phase === 'hold') {
    // Aggressive behavior during spike
    aggressiveUserBehavior(token, workspaceId, phase);
  }
  
  // Adjust sleep time based on phase
  const sleepTime = phase === 'spike' || phase === 'hold' ? 
    Math.random() * 0.3 + 0.1 : // 0.1-0.4s during spike
    Math.random() * 1 + 0.5;     // 0.5-1.5s during normal phases
  
  sleep(sleepTime);
}

function getCurrentPhase() {
  // Estimate phase based on test duration
  const startTime = new Date(__ENV.K6_START_TIME || Date.now());
  const elapsed = (new Date() - startTime) / 1000; // seconds
  
  if (elapsed < 120) return 'baseline';      // 0-2 minutes
  if (elapsed < 150) return 'spike';         // 2-2.5 minutes
  if (elapsed < 270) return 'hold';          // 2.5-4.5 minutes
  if (elapsed < 300) return 'drop';          // 4.5-5 minutes
  return 'recovery';                         // 5+ minutes
}

function normalUserBehavior(token, workspaceId, phase) {
  // Typical user workflow during normal conditions
  const workflow = Math.random();
  
  if (workflow < 0.5) {
    // 50% - Browse posts
    browsePostsWorkflow(token, workspaceId, phase);
  } else if (workflow < 0.8) {
    // 30% - Create content workflow
    createContentWorkflow(token, workspaceId, phase);
  } else {
    // 20% - Analytics workflow
    analyticsWorkflow(token, workspaceId, phase);
  }
}

function aggressiveUserBehavior(token, workspaceId, phase) {
  // More intensive operations during spike
  const operation = Math.random();
  
  if (operation < 0.3) {
    // 30% - Rapid post creation
    rapidPostCreation(token, workspaceId, phase);
  } else if (operation < 0.6) {
    // 30% - Heavy read operations
    heavyReadOperations(token, workspaceId, phase);
  } else if (operation < 0.8) {
    // 20% - Complex queries
    complexQueryOperations(token, workspaceId, phase);
  } else {
    // 20% - Mixed intensive operations
    mixedIntensiveOperations(token, workspaceId, phase);
  }
}

function browsePostsWorkflow(token, workspaceId, phase) {
  // 1. Get posts list
  let response = http.get(`${BASE_URL}/api/v1/posts?limit=20`, {
    headers: authHeaders(token),
    tags: { operation: 'browse_posts', phase: phase },
  });
  
  trackPhaseMetrics(response, phase);
  
  if (response.status === 200) {
    // 2. Get post details (simulate user clicking on a post)
    const posts = response.json('data');
    if (posts && posts.length > 0) {
      const randomPost = posts[Math.floor(Math.random() * posts.length)];
      
      response = http.get(`${BASE_URL}/api/v1/posts/${randomPost.id}`, {
        headers: authHeaders(token),
        tags: { operation: 'get_post_details', phase: phase },
      });
      
      trackPhaseMetrics(response, phase);
    }
  }
}

function createContentWorkflow(token, workspaceId, phase) {
  // 1. Check workspace info
  let response = http.get(`${BASE_URL}/api/v1/workspaces`, {
    headers: authHeaders(token),
    tags: { operation: 'check_workspace', phase: phase },
  });
  
  trackPhaseMetrics(response, phase);
  
  if (response.status === 200) {
    // 2. Create a post
    const postData = {
      content: `Spike test post during ${phase} phase - ${Date.now()}`,
      platforms: ['twitter'],
      workspaceId: workspaceId,
    };
    
    response = http.post(`${BASE_URL}/api/v1/posts`, JSON.stringify(postData), {
      headers: authHeaders(token),
      tags: { operation: 'create_post', phase: phase },
    });
    
    trackPhaseMetrics(response, phase);
  }
}

function analyticsWorkflow(token, workspaceId, phase) {
  // Analytics operations that might be resource-intensive
  const analyticsEndpoints = [
    '/api/v1/analytics/overview',
    '/api/v1/analytics/engagement',
    '/api/v1/analytics/posts',
  ];
  
  for (const endpoint of analyticsEndpoints) {
    const response = http.get(`${BASE_URL}${endpoint}`, {
      headers: authHeaders(token),
      tags: { operation: 'analytics', phase: phase },
    });
    
    trackPhaseMetrics(response, phase);
    
    // Short pause between analytics calls
    sleep(0.2);
  }
}

function rapidPostCreation(token, workspaceId, phase) {
  // Create multiple posts rapidly during spike
  const postCount = Math.floor(Math.random() * 3) + 1; // 1-3 posts
  
  for (let i = 0; i < postCount; i++) {
    const postData = {
      content: `Rapid post ${i + 1} during ${phase} - ${Date.now()}`,
      platforms: ['twitter'],
      workspaceId: workspaceId,
    };
    
    const response = http.post(`${BASE_URL}/api/v1/posts`, JSON.stringify(postData), {
      headers: authHeaders(token),
      tags: { operation: 'rapid_create', phase: phase },
    });
    
    trackPhaseMetrics(response, phase);
    
    // Very short pause between rapid creations
    sleep(0.1);
  }
}

function heavyReadOperations(token, workspaceId, phase) {
  // Multiple read operations in quick succession
  const endpoints = [
    '/api/v1/posts?limit=50',
    '/api/v1/posts?status=published&limit=30',
    '/api/v1/posts?platform=twitter&limit=25',
    '/api/v1/social-accounts',
    '/api/v1/workspaces',
  ];
  
  for (const endpoint of endpoints) {
    const response = http.get(`${BASE_URL}${endpoint}`, {
      headers: authHeaders(token),
      tags: { operation: 'heavy_read', phase: phase },
    });
    
    trackPhaseMetrics(response, phase);
    
    // Minimal pause between reads
    sleep(0.05);
  }
}

function complexQueryOperations(token, workspaceId, phase) {
  // Complex queries that stress the database
  const complexQueries = [
    '/api/v1/posts?sort=engagement&order=desc&limit=100',
    '/api/v1/posts?search=test&platform=twitter&status=published',
    '/api/v1/analytics/posts?groupBy=platform&period=30d',
  ];
  
  for (const query of complexQueries) {
    const response = http.get(`${BASE_URL}${query}`, {
      headers: authHeaders(token),
      tags: { operation: 'complex_query', phase: phase },
    });
    
    trackPhaseMetrics(response, phase);
    
    sleep(0.1);
  }
}

function mixedIntensiveOperations(token, workspaceId, phase) {
  // Mix of read and write operations
  
  // 1. Heavy read
  let response = http.get(`${BASE_URL}/api/v1/posts?limit=50`, {
    headers: authHeaders(token),
    tags: { operation: 'mixed_read', phase: phase },
  });
  
  trackPhaseMetrics(response, phase);
  
  // 2. Create post
  const postData = {
    content: `Mixed operation post during ${phase} - ${Date.now()}`,
    platforms: ['twitter', 'linkedin'],
    workspaceId: workspaceId,
  };
  
  response = http.post(`${BASE_URL}/api/v1/posts`, JSON.stringify(postData), {
    headers: authHeaders(token),
    tags: { operation: 'mixed_write', phase: phase },
  });
  
  trackPhaseMetrics(response, phase);
  
  // 3. Analytics check
  response = http.get(`${BASE_URL}/api/v1/analytics/overview`, {
    headers: authHeaders(token),
    tags: { operation: 'mixed_analytics', phase: phase },
  });
  
  trackPhaseMetrics(response, phase);
}

function trackPhaseMetrics(response, phase) {
  if (!spikeMetrics[phase]) {
    spikeMetrics[phase] = { errors: 0, requests: 0, totalResponseTime: 0 };
  }
  
  spikeMetrics[phase].requests++;
  spikeMetrics[phase].totalResponseTime += response.timings.duration;
  
  if (response.status >= 400) {
    spikeMetrics[phase].errors++;
  }
  
  // Log significant issues during spike
  if (phase === 'spike' || phase === 'hold') {
    if (response.status >= 500) {
      console.error(`❌ Server error during ${phase}: ${response.status} - ${response.url}`);
    } else if (response.status === 429) {
      console.warn(`⚠️ Rate limited during ${phase}: ${response.url}`);
    } else if (response.timings.duration > 5000) {
      console.warn(`⚠️ Slow response during ${phase}: ${response.timings.duration}ms - ${response.url}`);
    }
  }
}

export function handleSummary(data) {
  console.log('\n⚡ Spike Test Summary:');
  console.log(`   Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`   Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`   Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`   99th Percentile: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log(`   Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  
  // Analyze phase-specific metrics
  console.log('\n📊 Phase Analysis:');
  
  Object.keys(spikeMetrics).forEach(phase => {
    const metrics = spikeMetrics[phase];
    if (metrics.requests > 0) {
      const errorRate = (metrics.errors / metrics.requests * 100).toFixed(2);
      const avgResponseTime = (metrics.totalResponseTime / metrics.requests).toFixed(2);
      
      console.log(`   ${phase.toUpperCase()}:`);
      console.log(`     Requests: ${metrics.requests}`);
      console.log(`     Error Rate: ${errorRate}%`);
      console.log(`     Avg Response Time: ${avgResponseTime}ms`);
    }
  });
  
  // System recovery analysis
  const baselineErrors = spikeMetrics.baseline ? spikeMetrics.baseline.errors / spikeMetrics.baseline.requests : 0;
  const recoveryErrors = spikeMetrics.recovery ? spikeMetrics.recovery.errors / spikeMetrics.recovery.requests : 0;
  
  console.log('\n🔄 Recovery Analysis:');
  if (recoveryErrors <= baselineErrors * 1.2) {
    console.log('   ✅ System recovered well after spike');
  } else {
    console.log('   ⚠️ System showing degraded performance after spike');
  }
  
  const finalErrorRate = data.metrics.http_req_failed.values.rate;
  const finalP95 = data.metrics.http_req_duration.values['p(95)'];
  
  console.log('\n🎯 Spike Test Results:');
  console.log(`   Error Rate < 15%: ${finalErrorRate < 0.15 ? '✅ PASS' : '❌ FAIL'} (${(finalErrorRate * 100).toFixed(2)}%)`);
  console.log(`   P95 < 8000ms: ${finalP95 < 8000 ? '✅ PASS' : '❌ FAIL'} (${finalP95.toFixed(2)}ms)`);
  
  if (finalErrorRate < 0.05 && finalP95 < 3000) {
    console.log('   🎉 System handled spike excellently!');
  } else if (finalErrorRate < 0.15 && finalP95 < 8000) {
    console.log('   ✅ System handled spike within acceptable limits');
  } else {
    console.log('   ❌ System struggled with traffic spike');
  }
  
  return {
    'spike-test-results.json': JSON.stringify(data, null, 2),
    'spike-test-phases.json': JSON.stringify(spikeMetrics, null, 2),
  };
}