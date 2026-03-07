#!/usr/bin/env node

/**
 * Simple runner for the retry test
 * Compiles and runs the TypeScript test script
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 PublishingWorker Retry State Machine Test');
console.log('============================================');
console.log('');

try {
  // Compile and run the TypeScript test
  const scriptPath = path.join(__dirname, 'scripts', 'testRetry.ts');
  
  console.log('📦 Compiling and running test...');
  console.log('');
  
  execSync(`npx ts-node ${scriptPath}`, {
    stdio: 'inherit',
    cwd: __dirname,
  });
  
} catch (error) {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
}