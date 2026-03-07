/**
 * Simple test to verify retry logic works
 */

const { RetryManager } = require('./dist/reliability/RetryManager');
const { getRetryConfig } = require('./dist/reliability/ServiceRetryConfigs');

async function testRetryLogic() {
  console.log('Testing retry logic...');
  
  const retryManager = new RetryManager();
  const config = getRetryConfig('oauth');
  
  let callCount = 0;
  const operation = async () => {
    callCount++;
    console.log(`Operation attempt ${callCount}`);
    
    if (callCount < 3) {
      const error = new Error('Simulated failure');
      error.response = { status: 503 };
      throw error;
    }
    
    return 'Success!';
  };
  
  const result = await retryManager.executeWithRetry(operation, config, 'test-operation');
  
  console.log('Result:', {
    success: result.success,
    result: result.result,
    attempts: result.attempts,
    totalDuration: result.totalDuration
  });
  
  console.log('Retry log:');
  result.retryLog.forEach(log => {
    console.log(`  Attempt ${log.attempt}: ${log.success ? 'SUCCESS' : 'FAILED'} (${log.duration}ms)`);
    if (log.delayBeforeRetry) {
      console.log(`    Delay before retry: ${log.delayBeforeRetry}ms`);
    }
  });
}

// Compile first, then test
const { exec } = require('child_process');

console.log('Compiling TypeScript...');
exec('npx tsc', (error, stdout, stderr) => {
  if (error) {
    console.error('Compilation error:', error);
    return;
  }
  
  if (stderr) {
    console.error('Compilation warnings:', stderr);
  }
  
  console.log('Compilation successful!');
  testRetryLogic().catch(console.error);
});