const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 MODULE 10 — CRASH RECOVERY TEST SUITE\n');
console.log('='.repeat(60));

const scripts = [
  { name: 'STEP 1 — Reset Test State', file: 'reset-test-state.cjs' },
  { name: 'STEP 2 — Reset Redis Queue', file: 'reset-redis.cjs' },
  { name: 'STEP 3 — Create Recovery Jobs', file: 'create-recovery-jobs.cjs' },
  { name: 'STEP 4 — Wait for Scheduler (60s)', file: null, wait: 60000 },
  { name: 'STEP 5 — Test Redis Reconnect', file: 'test-redis-reconnect.cjs' },
  { name: 'STEP 6 — Verify Recovery', file: 'verify-recovery.cjs' },
];

let currentStep = 0;

function runScript(scriptFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${scriptFile}`);
    console.log('='.repeat(60));
    
    const child = spawn('node', [path.join(__dirname, scriptFile)], {
      stdio: 'inherit',
      shell: true,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function runTests() {
  try {
    for (const step of scripts) {
      console.log(`\n\n${'█'.repeat(60)}`);
      console.log(`${step.name}`);
      console.log('█'.repeat(60));
      
      if (step.file) {
        await runScript(step.file);
      } else if (step.wait) {
        console.log(`\n⏰ Waiting ${step.wait / 1000} seconds for scheduler to process jobs...`);
        await new Promise(resolve => setTimeout(resolve, step.wait));
        console.log('✅ Wait complete');
      }
      
      currentStep++;
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('✅ MODULE 10 TEST SUITE COMPLETE');
    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('\n\n' + '='.repeat(60));
    console.error('❌ MODULE 10 TEST SUITE FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runTests();
