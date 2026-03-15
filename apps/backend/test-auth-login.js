#!/usr/bin/env node

/**
 * Test script to verify Jest auth/login tests run without hanging
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Jest auth/login tests...');
console.log('📍 Working directory:', process.cwd());

// Set environment variables
const env = {
  ...process.env,
  NODE_ENV: 'test',
  // Disable Redis and other services for tests
  REDIS_URL: '',
  DISABLE_REDIS: 'true',
};

// Run Jest with specific test pattern
const jestArgs = [
  '--testPathPattern=auth/login',
  '--verbose',
  '--runInBand',
  '--detectOpenHandles',
  '--forceExit',
  '--maxWorkers=1'
];

console.log('🚀 Running command: npx jest', jestArgs.join(' '));

const jest = spawn('npx', ['jest', ...jestArgs], {
  cwd: path.join(__dirname),
  env,
  stdio: 'inherit'
});

// Set a timeout to kill the process if it hangs
const timeout = setTimeout(() => {
  console.log('\n❌ Test timed out after 60 seconds - killing process');
  jest.kill('SIGKILL');
  process.exit(1);
}, 60000);

jest.on('close', (code) => {
  clearTimeout(timeout);
  
  if (code === 0) {
    console.log('\n✅ Tests completed successfully!');
    process.exit(0);
  } else {
    console.log(`\n❌ Tests failed with exit code ${code}`);
    process.exit(code);
  }
});

jest.on('error', (error) => {
  clearTimeout(timeout);
  console.error('\n❌ Failed to start Jest:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT - terminating Jest process');
  clearTimeout(timeout);
  jest.kill('SIGTERM');
  setTimeout(() => {
    jest.kill('SIGKILL');
    process.exit(1);
  }, 5000);
});