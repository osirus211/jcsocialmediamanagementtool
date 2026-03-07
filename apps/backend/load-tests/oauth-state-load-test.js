/**
 * k6 Load Test for OAuth State Service
 * 
 * Tests system performance under load with 1000 concurrent virtual users.
 * Validates <2% failure rate and <2s p99 latency targets.
 * 
 * Run: k6 run oauth-state-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const oauthFailureRate = new Rate('oauth_failures');
const oauthDuration = new Trend('oauth_flow_duration');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 VUs
    { duration: '1m', target: 500 },    // Ramp up to 500 VUs
    { duration: '2m', target: 1000 },   // Ramp up to 1000 VUs
    { duration: '2m', target: 1000 },   // Stay at 1000 VUs
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    'oauth_failures': ['rate<0.02'],           // <2% failure rate
    'http_req_duration': ['p(99)<2000'],       // p99 < 2s
    'oauth_flow_duration': ['p(99)<2000'],     // p99 OAuth flow < 2s
    'http_req_failed': ['rate<0.02'],          // <2% HTTP errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const workspaceId = `workspace-${__VU}-${__ITER}`;
  const userId = `user-${__VU}-${__ITER}`;
  
  const flowStart = Date.now();

  // Step 1: Create OAuth state
  const createPayload = JSON.stringify({
    platform: 'twitter',
    workspaceId,
    userId,
  });

  const createResponse = http.post(`${BASE_URL}/api/oauth/state`, createPayload, {
    headers: { 
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.1',
      'User-Agent': 'k6-load-test/1.0',
    },
  });

  const createSuccess = check(createResponse, {
    'create state status is 200': (r) => r.status === 200,
    'create state returns state': (r) => {
      try {
        return r.json('state') !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (!createSuccess) {
    oauthFailureRate.add(1);
    oauthDuration.add(Date.now() - flowStart);
    return;
  }

  let state;
  try {
    state = createResponse.json('state');
  } catch (e) {
    oauthFailureRate.add(1);
    oauthDuration.add(Date.now() - flowStart);
    return;
  }

  // Simulate OAuth redirect delay (100-500ms)
  sleep(Math.random() * 0.4 + 0.1);

  // Step 2: Consume OAuth state
  const consumePayload = JSON.stringify({ state });

  const consumeResponse = http.post(`${BASE_URL}/api/oauth/state/consume`, consumePayload, {
    headers: { 
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.1',
      'User-Agent': 'k6-load-test/1.0',
    },
  });

  const consumeSuccess = check(consumeResponse, {
    'consume state status is 200': (r) => r.status === 200,
    'consume state is valid': (r) => {
      try {
        return r.json('valid') === true;
      } catch (e) {
        return false;
      }
    },
  });

  const flowDuration = Date.now() - flowStart;
  oauthDuration.add(flowDuration);

  if (!consumeSuccess) {
    oauthFailureRate.add(1);
  } else {
    oauthFailureRate.add(0);
  }
}

export function handleSummary(data) {
  const oauthFailures = data.metrics.oauth_failures?.values?.rate || 0;
  const p99Duration = data.metrics.oauth_flow_duration?.values['p(99)'] || 0;
  const httpP99 = data.metrics.http_req_duration?.values['p(99)'] || 0;

  console.log('\n=== OAuth State Load Test Results ===');
  console.log(`OAuth Failure Rate: ${(oauthFailures * 100).toFixed(2)}% (target: <2%)`);
  console.log(`OAuth Flow p99: ${p99Duration.toFixed(2)}ms (target: <2000ms)`);
  console.log(`HTTP Request p99: ${httpP99.toFixed(2)}ms (target: <2000ms)`);

  const passed = oauthFailures < 0.02 && p99Duration < 2000 && httpP99 < 2000;
  console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}: Load test ${passed ? 'passed' : 'failed'} all thresholds`);

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
