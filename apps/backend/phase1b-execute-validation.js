/**
 * Phase 1B: Validation Execution Script
 * 
 * Executes all Phase 1B validation tests and produces a comprehensive report
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function execCommand(command, description) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${description}`);
  console.log(`${'═'.repeat(60)}\n`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'inherit',
      cwd: __dirname,
    });
    return { success: true, output };
  } catch (error) {
    console.error(`\n❌ ${description} FAILED\n`);
    return { success: false, error: error.message };
  }
}

async function runValidation() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║         PHASE 1B: PROVIDER PROTECTION LAYER               ║');
  console.log('║              RUNTIME VALIDATION SUITE                     ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('Objective: Validate circuit breaker, rate limiter, and storm protection\n');

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // Test 1: Circuit Breaker
  console.log('\n📍 TEST 1: CIRCUIT BREAKER VALIDATION');
  const circuitResult = execCommand(
    'node phase1b-test-circuit-breaker.js',
    'Circuit Breaker Test'
  );
  results.tests.push({
    name: 'Circuit Breaker',
    passed: circuitResult.success,
    error: circuitResult.error,
  });

  if (!circuitResult.success) {
    console.log('\n⚠️  Circuit breaker test failed. Continuing with other tests...\n');
  }

  // Wait between tests
  console.log('\n⏳ Waiting 5 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 2: Rate Limiter
  console.log('\n📍 TEST 2: RATE LIMITER VALIDATION');
  const rateLimitResult = execCommand(
    'node phase1b-test-rate-limiter.js',
    'Rate Limiter Test'
  );
  results.tests.push({
    name: 'Rate Limiter',
    passed: rateLimitResult.success,
    error: rateLimitResult.error,
  });

  if (!rateLimitResult.success) {
    console.log('\n⚠️  Rate limiter test failed. Continuing with other tests...\n');
  }

  // Wait between tests
  console.log('\n⏳ Waiting 5 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 3: Storm Protection
  console.log('\n📍 TEST 3: STORM PROTECTION VALIDATION');
  const stormResult = execCommand(
    'node phase1b-test-storm-protection.js',
    'Storm Protection Test'
  );
  results.tests.push({
    name: 'Storm Protection',
    passed: stormResult.success,
    error: stormResult.error,
  });

  if (!stormResult.success) {
    console.log('\n⚠️  Storm protection test failed. Continuing with other tests...\n');
  }

  // Wait between tests
  console.log('\n⏳ Waiting 5 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 4: Combined Failure
  console.log('\n📍 TEST 4: COMBINED FAILURE SCENARIO');
  const combinedResult = execCommand(
    'node phase1b-test-combined-failure.js',
    'Combined Failure Test'
  );
  results.tests.push({
    name: 'Combined Failure',
    passed: combinedResult.success,
    error: combinedResult.error,
  });

  if (!combinedResult.success) {
    console.log('\n⚠️  Combined failure test failed.\n');
  }

  // Generate summary report
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║              PHASE 1B VALIDATION SUMMARY                  ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log('Test Results:\n');
  
  const passedTests = results.tests.filter(t => t.passed).length;
  const totalTests = results.tests.length;

  for (const test of results.tests) {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status}  ${test.name}`);
    if (test.error) {
      console.log(`           Error: ${test.error}`);
    }
  }

  console.log('\n');
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  console.log('\n');

  // Overall status
  const allPassed = passedTests === totalTests;
  
  if (allPassed) {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ PHASE 1B PROTECTION LAYER: VALIDATION PASSED         ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    console.log('All protection mechanisms validated successfully:');
    console.log('  ✅ Circuit breaker state transitions');
    console.log('  ✅ Rate limiter blocking and delays');
    console.log('  ✅ Storm protection jitter distribution');
    console.log('  ✅ Combined failure resilience\n');
  } else {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ⚠️  PHASE 1B PROTECTION LAYER: VALIDATION INCOMPLETE    ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    console.log(`${passedTests} of ${totalTests} tests passed.`);
    console.log('Review failed tests and backend logs for details.\n');
  }

  // Save results to file
  const reportPath = path.join(__dirname, 'PHASE_1B_VALIDATION_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Detailed results saved to: ${reportPath}\n`);

  process.exit(allPassed ? 0 : 1);
}

runValidation().catch(error => {
  console.error('\n❌ Validation execution failed:', error);
  process.exit(1);
});
