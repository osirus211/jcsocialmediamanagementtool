#!/usr/bin/env node

/**
 * Run Authentication Test
 * Runs the login test with proper cleanup to avoid hanging
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running authentication tests...');

// Change to backend directory
process.chdir(path.join(__dirname));

// Run Jest with specific configuration for auth tests
const jestProcess = spawn('npx', [
  'jest',
  'src/__tests__/auth/login.test.ts',
  '--runInBand',
  '--detectOpenHandles',
  '--forceExit',
  '--verbose',
  '--testTimeout=30000'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
});

// Handle process events
jestProcess.on('close', (code) => {
  console.log(`\n🔚 Jest process exited with code ${code}`);
  
  if (code === 0) {
    console.log('✅ Authentication tests passed!');
  } else {
    console.log('❌ Authentication tests failed!');
  }
  
  process.exit(code);
});

jestProcess.on('error', (error) => {
  console.error('❌ Failed to start Jest process:', error);
  process.exit(1);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, terminating Jest process...');
  jestProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, terminating Jest process...');
  jestProcess.kill('SIGTERM');
});