/**
 * Continuous OAuth Flow Generator
 * 
 * Generates continuous OAuth flows for Redis failure simulation testing.
 * Tracks success, failure, and unavailable (503) responses.
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const FLOWS_PER_SECOND = parseInt(process.env.FLOWS_PER_SECOND || '10', 10);

let totalFlows = 0;
let successCount = 0;
let failureCount = 0;
let unavailableCount = 0;
let errorDetails = {};

async function runOAuthFlow() {
  const flowId = totalFlows++;
  
  try {
    // Step 1: Create OAuth state
    const createResponse = await axios.post(`${BASE_URL}/api/oauth/state`, {
      platform: 'twitter',
      workspaceId: `workspace-${flowId}`,
      userId: `user-${flowId}`,
    }, {
      headers: {
        'X-Forwarded-For': '192.168.1.1',
        'User-Agent': 'ContinuousFlowGenerator/1.0',
      },
      timeout: 5000,
    });

    const { state } = createResponse.data;

    // Step 2: Consume OAuth state
    const consumeResponse = await axios.post(`${BASE_URL}/api/oauth/state/consume`, {
      state,
    }, {
      headers: {
        'X-Forwarded-For': '192.168.1.1',
        'User-Agent': 'ContinuousFlowGenerator/1.0',
      },
      timeout: 5000,
    });

    if (consumeResponse.data.valid) {
      successCount++;
    } else {
      failureCount++;
      const error = consumeResponse.data.error || 'UNKNOWN';
      errorDetails[error] = (errorDetails[error] || 0) + 1;
    }
  } catch (error) {
    if (error.response?.status === 503) {
      unavailableCount++;
      errorDetails['SERVICE_UNAVAILABLE'] = (errorDetails['SERVICE_UNAVAILABLE'] || 0) + 1;
    } else if (error.code === 'ECONNREFUSED') {
      unavailableCount++;
      errorDetails['CONNECTION_REFUSED'] = (errorDetails['CONNECTION_REFUSED'] || 0) + 1;
    } else if (error.code === 'ETIMEDOUT') {
      unavailableCount++;
      errorDetails['TIMEOUT'] = (errorDetails['TIMEOUT'] || 0) + 1;
    } else {
      failureCount++;
      const errorType = error.code || error.message || 'UNKNOWN';
      errorDetails[errorType] = (errorDetails[errorType] || 0) + 1;
    }
  }
}

// Start continuous flow generation
console.log(`\n=== Continuous OAuth Flow Generator ===`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`Flows per second: ${FLOWS_PER_SECOND}`);
console.log(`Starting generation...\n`);

const flowInterval = setInterval(() => {
  runOAuthFlow();
}, 1000 / FLOWS_PER_SECOND);

// Print stats every 5 seconds
const statsInterval = setInterval(() => {
  const successRate = totalFlows > 0 ? (successCount / totalFlows * 100).toFixed(2) : '0.00';
  const failureRate = totalFlows > 0 ? (failureCount / totalFlows * 100).toFixed(2) : '0.00';
  const unavailableRate = totalFlows > 0 ? (unavailableCount / totalFlows * 100).toFixed(2) : '0.00';

  console.log(`[${new Date().toISOString()}] Total: ${totalFlows} | Success: ${successCount} (${successRate}%) | Failure: ${failureCount} (${failureRate}%) | Unavailable: ${unavailableCount} (${unavailableRate}%)`);
  
  if (Object.keys(errorDetails).length > 0) {
    console.log(`  Error breakdown: ${JSON.stringify(errorDetails)}`);
  }
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\n=== Final Statistics ===`);
  console.log(`Total Flows: ${totalFlows}`);
  console.log(`Success: ${successCount} (${(successCount / totalFlows * 100).toFixed(2)}%)`);
  console.log(`Failure: ${failureCount} (${(failureCount / totalFlows * 100).toFixed(2)}%)`);
  console.log(`Unavailable: ${unavailableCount} (${(unavailableCount / totalFlows * 100).toFixed(2)}%)`);
  console.log(`\nError Details:`);
  console.log(JSON.stringify(errorDetails, null, 2));
  
  clearInterval(flowInterval);
  clearInterval(statsInterval);
  process.exit(0);
});
