/**
 * Multi-Instance Validation Script
 * 
 * Validates that OAuth state works correctly across multiple backend instances
 * by simulating OAuth flows through a load balancer.
 */

const axios = require('axios');

const LOAD_BALANCER_URL = process.env.LOAD_BALANCER_URL || 'http://localhost:8080';
const TOTAL_FLOWS = parseInt(process.env.TOTAL_FLOWS || '100', 10);

async function validateMultiInstance() {
  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  console.log(`\n=== Multi-Instance Validation ===`);
  console.log(`Load Balancer: ${LOAD_BALANCER_URL}`);
  console.log(`Total Flows: ${TOTAL_FLOWS}`);
  console.log(`Starting validation...\n`);

  const startTime = Date.now();

  for (let i = 0; i < TOTAL_FLOWS; i++) {
    try {
      // Step 1: Create OAuth state (may hit any instance)
      const createResponse = await axios.post(`${LOAD_BALANCER_URL}/api/oauth/state`, {
        platform: 'twitter',
        workspaceId: `workspace-${i}`,
        userId: `user-${i}`,
      }, {
        headers: {
          'X-Forwarded-For': '192.168.1.1',
          'User-Agent': 'ValidationScript/1.0',
        },
      });

      const { state, correlationId } = createResponse.data;

      // Step 2: Consume OAuth state (may hit different instance)
      const consumeResponse = await axios.post(`${LOAD_BALANCER_URL}/api/oauth/state/consume`, {
        state,
      }, {
        headers: {
          'X-Forwarded-For': '192.168.1.1',
          'User-Agent': 'ValidationScript/1.0',
        },
      });

      if (consumeResponse.data.valid) {
        successCount++;
        if ((i + 1) % 10 === 0) {
          process.stdout.write('.');
        }
      } else {
        failureCount++;
        failures.push({
          flow: i,
          error: consumeResponse.data.error,
          correlationId,
        });
        process.stdout.write('F');
      }
    } catch (error) {
      failureCount++;
      failures.push({
        flow: i,
        error: error.message,
        status: error.response?.status,
      });
      process.stdout.write('E');
    }
  }

  const duration = Date.now() - startTime;
  const successRate = (successCount / TOTAL_FLOWS) * 100;
  const failureRate = (failureCount / TOTAL_FLOWS) * 100;

  console.log(`\n\n=== Validation Results ===`);
  console.log(`Duration: ${duration}ms (${(duration / TOTAL_FLOWS).toFixed(2)}ms avg per flow)`);
  console.log(`Total Flows: ${TOTAL_FLOWS}`);
  console.log(`Success: ${successCount} (${successRate.toFixed(2)}%)`);
  console.log(`Failure: ${failureCount} (${failureRate.toFixed(2)}%)`);

  if (failures.length > 0) {
    console.log(`\n=== Failures ===`);
    failures.slice(0, 10).forEach(f => {
      console.log(`Flow ${f.flow}: ${f.error} (correlationId: ${f.correlationId || 'N/A'})`);
    });
    if (failures.length > 10) {
      console.log(`... and ${failures.length - 10} more failures`);
    }
  }

  console.log(`\n=== Go/No-Go Decision ===`);
  if (failureRate === 0) {
    console.log(`✅ PASS: 0% callback failure rate`);
    console.log(`✅ Multi-instance horizontal scaling validated`);
    process.exit(0);
  } else {
    console.log(`❌ FAIL: ${failureRate.toFixed(2)}% callback failure rate`);
    console.log(`❌ Multi-instance horizontal scaling NOT validated`);
    process.exit(1);
  }
}

// Run validation
validateMultiInstance().catch(error => {
  console.error(`\n❌ Validation script error: ${error.message}`);
  process.exit(1);
});
