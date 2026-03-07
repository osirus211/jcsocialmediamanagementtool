#!/usr/bin/env node
/**
 * Horizontal Scaling Validation Script
 * 
 * Tests OAuth state management across multiple backend instances
 * Validates atomic operations, random routing, and distributed correctness
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const NUM_FLOWS = parseInt(process.env.NUM_FLOWS || '500', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10);
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID || 'test-workspace-123';
const USER_ID = process.env.TEST_USER_ID || 'test-user-456';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;

// Metrics
const metrics = {
  total: 0,
  success: 0,
  failed: 0,
  stateCreated: 0,
  stateConsumed: 0,
  stateNotFound: 0,
  stateExpired: 0,
  ipMismatch: 0,
  replayAttempt: 0,
  errors: [],
  latencies: [],
  instanceRouting: {},
};

/**
 * Simulate OAuth authorization (state creation)
 */
async function createOAuthState(flowId) {
  const startTime = Date.now();
  
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/v1/oauth/twitter/authorize`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'X-Workspace-ID': WORKSPACE_ID,
          'X-User-ID': USER_ID,
          'X-Flow-ID': flowId,
        },
      }
    );

    const latency = Date.now() - startTime;
    metrics.latencies.push(latency);
    metrics.stateCreated++;

    // Track which instance handled the request
    const instanceId = response.headers['x-instance-id'];
    if (instanceId) {
      metrics.instanceRouting[instanceId] = (metrics.instanceRouting[instanceId] || 0) + 1;
    }

    return {
      success: true,
      state: response.data.state,
      authorizationUrl: response.data.authorizationUrl,
      instanceId,
      latency,
    };
  } catch (error) {
    metrics.failed++;
    metrics.errors.push({
      flowId,
      phase: 'authorization',
      error: error.message,
      status: error.response?.status,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Simulate OAuth callback (state consumption)
 */
async function consumeOAuthState(state, flowId, simulateIpChange = false) {
  const startTime = Date.now();
  
  try {
    const headers = {
      'X-Flow-ID': flowId,
    };

    // Simulate IP change for security testing
    if (simulateIpChange) {
      headers['X-Forwarded-For'] = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    const response = await axios.get(
      `${BACKEND_URL}/api/v1/oauth/twitter/callback`,
      {
        params: {
          code: 'test-code-' + crypto.randomBytes(16).toString('hex'),
          state,
        },
        headers,
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
      }
    );

    const latency = Date.now() - startTime;
    metrics.latencies.push(latency);
    metrics.stateConsumed++;
    metrics.success++;

    // Track which instance handled the callback
    const instanceId = response.headers['x-instance-id'];
    if (instanceId) {
      metrics.instanceRouting[instanceId] = (metrics.instanceRouting[instanceId] || 0) + 1;
    }

    return {
      success: true,
      instanceId,
      latency,
    };
  } catch (error) {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.message || error.message;

    if (errorMessage.includes('not found') || errorMessage.includes('expired')) {
      metrics.stateNotFound++;
    } else if (errorMessage.includes('IP mismatch')) {
      metrics.ipMismatch++;
    } else if (errorMessage.includes('replay')) {
      metrics.replayAttempt++;
    }

    metrics.failed++;
    metrics.errors.push({
      flowId,
      phase: 'callback',
      error: errorMessage,
      status,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}


/**
 * Run a single OAuth flow (authorization + callback)
 */
async function runOAuthFlow(flowId) {
  metrics.total++;

  // Step 1: Create state (authorization)
  const authResult = await createOAuthState(flowId);
  if (!authResult.success) {
    return { success: false, phase: 'authorization' };
  }

  // Step 2: Consume state (callback) - may route to different instance
  const callbackResult = await consumeOAuthState(authResult.state, flowId);
  
  return {
    success: callbackResult.success,
    phase: callbackResult.success ? 'complete' : 'callback',
    authInstance: authResult.instanceId,
    callbackInstance: callbackResult.instanceId,
    crossInstance: authResult.instanceId !== callbackResult.instanceId,
  };
}

/**
 * Run OAuth flows with controlled concurrency
 */
async function runFlowsWithConcurrency(numFlows, concurrency) {
  const results = [];
  const queue = [];

  for (let i = 0; i < numFlows; i++) {
    const flowId = `flow-${i}-${Date.now()}`;
    
    const promise = runOAuthFlow(flowId).then((result) => {
      results.push(result);
      
      // Progress indicator
      if (results.length % 50 === 0) {
        console.log(`Progress: ${results.length}/${numFlows} flows completed`);
      }
      
      return result;
    });

    queue.push(promise);

    // Control concurrency
    if (queue.length >= concurrency) {
      await Promise.race(queue);
      queue.splice(queue.findIndex((p) => p === promise), 1);
    }
  }

  // Wait for remaining flows
  await Promise.all(queue);

  return results;
}

/**
 * Test replay attack prevention
 */
async function testReplayAttack() {
  console.log('\n🔒 Testing Replay Attack Prevention...');
  
  const flowId = 'replay-test-' + Date.now();
  
  // Create state
  const authResult = await createOAuthState(flowId);
  if (!authResult.success) {
    console.log('❌ Failed to create state for replay test');
    return;
  }

  // First consumption (should succeed)
  const firstAttempt = await consumeOAuthState(authResult.state, flowId);
  
  // Second consumption (should fail - replay attack)
  const secondAttempt = await consumeOAuthState(authResult.state, flowId);

  if (firstAttempt.success && !secondAttempt.success) {
    console.log('✅ Replay attack prevented successfully');
  } else {
    console.log('❌ Replay attack prevention FAILED');
    console.log('  First attempt:', firstAttempt.success ? 'SUCCESS' : 'FAILED');
    console.log('  Second attempt:', secondAttempt.success ? 'SUCCESS (BAD!)' : 'FAILED (GOOD)');
  }
}

/**
 * Test IP binding
 */
async function testIpBinding() {
  console.log('\n🌐 Testing IP Binding...');
  
  const flowId = 'ip-test-' + Date.now();
  
  // Create state
  const authResult = await createOAuthState(flowId);
  if (!authResult.success) {
    console.log('❌ Failed to create state for IP test');
    return;
  }

  // Consume with different IP (should fail)
  const result = await consumeOAuthState(authResult.state, flowId, true);

  if (!result.success) {
    console.log('✅ IP binding working - different IP rejected');
  } else {
    console.log('❌ IP binding FAILED - different IP accepted');
  }
}

/**
 * Calculate statistics
 */
function calculateStats() {
  const successRate = (metrics.success / metrics.total) * 100;
  const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
  const p50 = metrics.latencies.sort((a, b) => a - b)[Math.floor(metrics.latencies.length * 0.5)];
  const p95 = metrics.latencies.sort((a, b) => a - b)[Math.floor(metrics.latencies.length * 0.95)];
  const p99 = metrics.latencies.sort((a, b) => a - b)[Math.floor(metrics.latencies.length * 0.99)];

  return {
    successRate,
    avgLatency,
    p50,
    p95,
    p99,
  };
}

/**
 * Print results
 */
function printResults(stats) {
  console.log('\n' + '='.repeat(80));
  console.log('HORIZONTAL SCALING VALIDATION RESULTS');
  console.log('='.repeat(80));
  
  console.log('\n📊 Overall Metrics:');
  console.log(`  Total Flows:        ${metrics.total}`);
  console.log(`  Successful:         ${metrics.success} (${stats.successRate.toFixed(2)}%)`);
  console.log(`  Failed:             ${metrics.failed}`);
  console.log(`  States Created:     ${metrics.stateCreated}`);
  console.log(`  States Consumed:    ${metrics.stateConsumed}`);
  
  console.log('\n⏱️  Latency:');
  console.log(`  Average:            ${stats.avgLatency.toFixed(2)}ms`);
  console.log(`  P50:                ${stats.p50}ms`);
  console.log(`  P95:                ${stats.p95}ms`);
  console.log(`  P99:                ${stats.p99}ms`);
  
  console.log('\n🖥️  Instance Routing:');
  Object.entries(metrics.instanceRouting).forEach(([instance, count]) => {
    const percentage = (count / (metrics.stateCreated + metrics.stateConsumed)) * 100;
    console.log(`  ${instance}:        ${count} requests (${percentage.toFixed(1)}%)`);
  });
  
  console.log('\n🔒 Security Metrics:');
  console.log(`  State Not Found:    ${metrics.stateNotFound}`);
  console.log(`  IP Mismatches:      ${metrics.ipMismatch}`);
  console.log(`  Replay Attempts:    ${metrics.replayAttempt}`);
  
  if (metrics.errors.length > 0) {
    console.log('\n❌ Errors (first 10):');
    metrics.errors.slice(0, 10).forEach((error, i) => {
      console.log(`  ${i + 1}. [${error.phase}] ${error.error} (status: ${error.status})`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Go/No-Go Decision
  const goNoGo = stats.successRate >= 99.9 && stats.p99 < 2000;
  console.log(goNoGo ? '✅ GO: Ready for Phase 0 Task P0-3' : '❌ NO-GO: Issues detected');
  console.log('='.repeat(80) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Horizontal Scaling Validation');
  console.log(`   Backend URL: ${BACKEND_URL}`);
  console.log(`   Flows: ${NUM_FLOWS}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log('');

  // Run OAuth flows
  console.log('📡 Running OAuth flows...');
  await runFlowsWithConcurrency(NUM_FLOWS, CONCURRENCY);

  // Security tests
  await testReplayAttack();
  await testIpBinding();

  // Calculate and print results
  const stats = calculateStats();
  printResults(stats);

  // Exit with appropriate code
  process.exit(stats.successRate >= 99.9 ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runOAuthFlow, testReplayAttack, testIpBinding };
