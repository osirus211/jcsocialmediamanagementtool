/**
 * Phase 1B: Runtime Infrastructure Audit
 * 
 * Automatically collects runtime evidence and produces audit report
 * Does NOT run validation tests - only verifies infrastructure is ready
 */

require('dotenv').config();
const { execSync } = require('child_process');
const Redis = require('ioredis');
const mongoose = require('mongoose');

// Construct Redis URL from environment variables
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6380';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_URL = process.env.REDIS_URL || 
  (REDIS_PASSWORD 
    ? `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
    : `redis://${REDIS_HOST}:${REDIS_PORT}`);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', timeout: 5000 });
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

async function runInfrastructureAudit() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('PHASE 1B: RUNTIME INFRASTRUCTURE AUDIT');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Date:', new Date().toISOString());
  console.log('Objective: Verify Phase 1B components are active at runtime\n');

  const report = {
    backendStartup: {},
    redisConnectivity: {},
    redisKeyspace: {},
    bullmqQueues: {},
    workerStatus: {},
    schedulerStatus: {},
    overallHealth: 'UNKNOWN',
  };

  let redis;

  try {
    // ========================================
    // STEP 1: Backend Process Check
    // ========================================
    console.log('STEP 1: Backend Process Check');
    console.log('─────────────────────────────────────────────────────────\n');

    // Check if backend is running (look for node process)
    const psOutput = execCommand('ps aux | grep "node.*server" | grep -v grep || echo "NOT_RUNNING"');
    
    if (psOutput.includes('NOT_RUNNING') || psOutput.includes('ERROR')) {
      console.log('⚠️  Backend process not detected');
      console.log('   Please start backend: cd apps/backend && npm run dev\n');
      report.backendStartup.running = false;
      report.backendStartup.message = 'Backend not running';
    } else {
      console.log('✅ Backend process detected');
      report.backendStartup.running = true;
      
      // Try to read recent logs if available
      console.log('   Process info:');
      const lines = psOutput.split('\n').filter(l => l.trim());
      lines.slice(0, 3).forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 10) {
          console.log(`   PID: ${parts[1]}, Command: ${parts.slice(10).join(' ').substring(0, 60)}...`);
        }
      });
      console.log('');
    }

    // ========================================
    // STEP 2: Redis Connectivity
    // ========================================
    console.log('STEP 2: Redis Connectivity');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
      
      const pingResult = await redis.ping();
      
      if (pingResult === 'PONG') {
        console.log('✅ Redis connectivity: OK');
        console.log(`   URL: ${REDIS_URL}`);
        console.log(`   Response: ${pingResult}\n`);
        report.redisConnectivity.status = 'OK';
        report.redisConnectivity.url = REDIS_URL;
      } else {
        console.log('❌ Redis connectivity: FAILED');
        console.log(`   Unexpected response: ${pingResult}\n`);
        report.redisConnectivity.status = 'FAILED';
      }
    } catch (error) {
      console.log('❌ Redis connectivity: FAILED');
      console.log(`   Error: ${error.message}\n`);
      report.redisConnectivity.status = 'FAILED';
      report.redisConnectivity.error = error.message;
    }

    if (report.redisConnectivity.status !== 'OK') {
      console.log('Cannot proceed without Redis. Exiting audit.\n');
      process.exit(1);
    }

    // ========================================
    // STEP 3: Redis Keyspace Snapshot
    // ========================================
    console.log('STEP 3: Redis Keyspace Snapshot');
    console.log('─────────────────────────────────────────────────────────\n');

    const allKeys = await redis.keys('*');
    console.log(`Total keys in Redis: ${allKeys.length}\n`);

    // Categorize keys
    const categories = {
      oauthCircuit: allKeys.filter(k => k.startsWith('oauth:circuit:')),
      oauthRateLimit: allKeys.filter(k => k.startsWith('oauth:ratelimit:')),
      oauthRefreshLock: allKeys.filter(k => k.startsWith('oauth:refresh:lock:')),
      oauthRefreshDLQ: allKeys.filter(k => k.startsWith('oauth:refresh:dlq:')),
      oauthState: allKeys.filter(k => k.startsWith('oauth:state:') || k.startsWith('oauth_state:')),
      bullmq: allKeys.filter(k => k.startsWith('bull:')),
      other: allKeys.filter(k => 
        !k.startsWith('oauth:') && 
        !k.startsWith('bull:') &&
        !k.startsWith('oauth_state:')
      ),
    };

    console.log('Key Categories:');
    console.log(`   Circuit Breaker Keys (oauth:circuit:*): ${categories.oauthCircuit.length}`);
    if (categories.oauthCircuit.length > 0) {
      categories.oauthCircuit.slice(0, 5).forEach(k => console.log(`      - ${k}`));
      if (categories.oauthCircuit.length > 5) {
        console.log(`      ... and ${categories.oauthCircuit.length - 5} more`);
      }
    }
    console.log('');

    console.log(`   Rate Limiter Keys (oauth:ratelimit:*): ${categories.oauthRateLimit.length}`);
    if (categories.oauthRateLimit.length > 0) {
      categories.oauthRateLimit.slice(0, 5).forEach(k => console.log(`      - ${k}`));
      if (categories.oauthRateLimit.length > 5) {
        console.log(`      ... and ${categories.oauthRateLimit.length - 5} more`);
      }
    }
    console.log('');

    console.log(`   Distributed Lock Keys (oauth:refresh:lock:*): ${categories.oauthRefreshLock.length}`);
    if (categories.oauthRefreshLock.length > 0) {
      categories.oauthRefreshLock.slice(0, 5).forEach(k => console.log(`      - ${k}`));
      if (categories.oauthRefreshLock.length > 5) {
        console.log(`      ... and ${categories.oauthRefreshLock.length - 5} more`);
      }
    }
    console.log('');

    console.log(`   DLQ Keys (oauth:refresh:dlq:*): ${categories.oauthRefreshDLQ.length}`);
    if (categories.oauthRefreshDLQ.length > 0) {
      categories.oauthRefreshDLQ.slice(0, 5).forEach(k => console.log(`      - ${k}`));
    }
    console.log('');

    console.log(`   OAuth State Keys: ${categories.oauthState.length}`);
    console.log('');

    console.log(`   BullMQ Keys (bull:*): ${categories.bullmq.length}`);
    if (categories.bullmq.length > 0) {
      categories.bullmq.slice(0, 10).forEach(k => console.log(`      - ${k}`));
      if (categories.bullmq.length > 10) {
        console.log(`      ... and ${categories.bullmq.length - 10} more`);
      }
    }
    console.log('');

    report.redisKeyspace = categories;

    // ========================================
    // STEP 4: BullMQ Queue Verification
    // ========================================
    console.log('STEP 4: BullMQ Queue Verification');
    console.log('─────────────────────────────────────────────────────────\n');

    const bullKeys = await redis.keys('bull:*');
    const tokenRefreshKeys = bullKeys.filter(k => k.includes('token-refresh'));

    console.log(`Total BullMQ keys: ${bullKeys.length}`);
    console.log(`Token refresh queue keys: ${tokenRefreshKeys.length}\n`);

    // Check for expected queue structures
    const expectedStructures = ['wait', 'active', 'delayed', 'completed', 'failed', 'paused', 'meta', 'id', 'events'];
    const foundStructures = {};

    expectedStructures.forEach(structure => {
      const found = tokenRefreshKeys.some(k => k.includes(structure));
      foundStructures[structure] = found;
      const status = found ? '✅' : '⚠️ ';
      console.log(`   ${status} ${structure}: ${found ? 'EXISTS' : 'NOT FOUND'}`);
    });
    console.log('');

    // Get queue counts
    console.log('Queue Counts:');
    try {
      const waiting = await redis.llen('bull:token-refresh-queue:wait') || 0;
      const active = await redis.llen('bull:token-refresh-queue:active') || 0;
      const delayed = await redis.zcard('bull:token-refresh-queue:delayed') || 0;
      const completed = await redis.zcard('bull:token-refresh-queue:completed') || 0;
      const failed = await redis.zcard('bull:token-refresh-queue:failed') || 0;

      console.log(`   Waiting: ${waiting}`);
      console.log(`   Active: ${active}`);
      console.log(`   Delayed: ${delayed}`);
      console.log(`   Completed: ${completed}`);
      console.log(`   Failed: ${failed}`);
      console.log('');

      report.bullmqQueues = {
        structures: foundStructures,
        counts: { waiting, active, delayed, completed, failed },
      };
    } catch (error) {
      console.log(`   Error getting queue counts: ${error.message}\n`);
      report.bullmqQueues.error = error.message;
    }

    // ========================================
    // STEP 5: MongoDB Connectivity
    // ========================================
    console.log('STEP 5: MongoDB Connectivity');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ MongoDB connectivity: OK');
      console.log(`   URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
      console.log(`   Database: ${mongoose.connection.db.databaseName}\n`);
      report.mongodbConnectivity = {
        status: 'OK',
        database: mongoose.connection.db.databaseName,
      };
    } catch (error) {
      console.log('❌ MongoDB connectivity: FAILED');
      console.log(`   Error: ${error.message}\n`);
      report.mongodbConnectivity = {
        status: 'FAILED',
        error: error.message,
      };
    }

    // ========================================
    // STEP 6: Worker & Scheduler Status
    // ========================================
    console.log('STEP 6: Worker & Scheduler Status');
    console.log('─────────────────────────────────────────────────────────\n');

    console.log('⚠️  Worker and Scheduler status must be verified from backend logs');
    console.log('   Look for these log messages:');
    console.log('   - "Distributed token refresh worker started" (concurrency: 5)');
    console.log('   - "Token refresh scheduler started" (interval: 300000ms)\n');

    report.workerStatus = {
      message: 'Check backend logs for worker startup',
      expectedLog: 'Distributed token refresh worker started',
      expectedConcurrency: 5,
    };

    report.schedulerStatus = {
      message: 'Check backend logs for scheduler startup',
      expectedLog: 'Token refresh scheduler started',
      expectedInterval: '300000ms (5 minutes)',
    };

    // ========================================
    // STEP 7: Overall Health Assessment
    // ========================================
    console.log('STEP 7: Overall Health Assessment');
    console.log('─────────────────────────────────────────────────────────\n');

    const checks = {
      redis: report.redisConnectivity.status === 'OK',
      mongodb: report.mongodbConnectivity?.status === 'OK',
      bullmqQueues: Object.values(foundStructures).filter(Boolean).length >= 5,
      keyspace: categories.bullmq.length > 0,
    };

    console.log('Infrastructure Checks:');
    console.log(`   ${checks.redis ? '✅' : '❌'} Redis connectivity`);
    console.log(`   ${checks.mongodb ? '✅' : '❌'} MongoDB connectivity`);
    console.log(`   ${checks.bullmqQueues ? '✅' : '❌'} BullMQ queue structures`);
    console.log(`   ${checks.keyspace ? '✅' : '❌'} Redis keyspace populated`);
    console.log('');

    const allChecksPass = Object.values(checks).every(Boolean);

    if (allChecksPass) {
      report.overallHealth = 'READY';
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ INFRASTRUCTURE READY FOR PHASE 1B VALIDATION');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('Next Steps:');
      console.log('1. Verify backend logs show worker and scheduler started');
      console.log('2. Run: node phase1b-test-circuit-breaker.js');
      console.log('3. Run: node phase1b-test-rate-limiter.js');
      console.log('4. Run: node phase1b-test-storm-protection.js');
      console.log('5. Run: node phase1b-test-combined-failure.js\n');
    } else {
      report.overallHealth = 'NOT_READY';
      console.log('═══════════════════════════════════════════════════════════');
      console.log('❌ INFRASTRUCTURE NOT READY');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('Issues detected:');
      if (!checks.redis) console.log('   - Redis not connected');
      if (!checks.mongodb) console.log('   - MongoDB not connected');
      if (!checks.bullmqQueues) console.log('   - BullMQ queues not initialized');
      if (!checks.keyspace) console.log('   - Redis keyspace empty');
      console.log('');
      console.log('Action Required:');
      console.log('1. Ensure backend is running: cd apps/backend && npm run dev');
      console.log('2. Verify Redis is running: redis-cli ping');
      console.log('3. Verify MongoDB is running');
      console.log('4. Check backend logs for errors\n');
    }

    // ========================================
    // Summary Report
    // ========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('INFRASTRUCTURE AUDIT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(report, null, 2));
    console.log('');

  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  } finally {
    if (redis) redis.disconnect();
    await mongoose.disconnect();
  }
}

runInfrastructureAudit();
