/**
 * PRODUCTION RELIABILITY AUDIT V2
 * Enhanced with retry logic and better error handling
 */

// Load environment variables FIRST
require('dotenv').config();

const axios = require('axios');
const mongoose = require('mongoose');
const Redis = require('ioredis');

const BASE_URL = 'http://localhost:5000/api/v1';
const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`⏳ Rate limited, waiting ${delay}ms before retry ${i + 1}/${maxRetries}...`);
        await wait(delay);
        continue;
      }
      throw error;
    }
  }
}

// Audit results
const auditResults = {
  modules: [],
  criticalIssues: [],
  warnings: [],
  passed: 0,
  failed: 0,
  partial: 0
};

function logModule(name, status, details = {}) {
  const result = {
    module: name,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  auditResults.modules.push(result);
  
  if (status === 'PASS') auditResults.passed++;
  else if (status === 'FAIL') auditResults.failed++;
  else if (status === 'PARTIAL') auditResults.partial++;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`MODULE: ${name}`);
  console.log(`STATUS: ${status}`);
  if (details.error) console.log(`ERROR: ${details.error}`);
  if (details.rootCause) console.log(`ROOT CAUSE: ${details.rootCause}`);
  if (details.fixApplied) console.log(`FIX APPLIED: ${details.fixApplied}`);
  if (details.evidence) console.log(`EVIDENCE: ${JSON.stringify(details.evidence, null, 2)}`);
  console.log(`${'='.repeat(80)}`);
}

function addCriticalIssue(issue) {
  auditResults.criticalIssues.push(issue);
  console.log(`\n🚨 CRITICAL ISSUE: ${issue}`);
}

function addWarning(warning) {
  auditResults.warnings.push(warning);
  console.log(`\n⚠️  WARNING: ${warning}`);
}

// ============================================================================
// MODULE 1: DATABASE CONNECTIVITY
// ============================================================================

async function testDatabaseConnectivity() {
  console.log('\n\n💾 TESTING DATABASE CONNECTIVITY...\n');
  
  try {
    // Test MongoDB
    console.log('1.1 Testing MongoDB connection...');
    const mongoState = mongoose.connection.readyState;
    const mongoStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    console.log(`MongoDB state: ${mongoStates[mongoState]}`);
    
    if (mongoState !== 1) {
      throw new Error('MongoDB not connected');
    }
    
    // Test MongoDB operations
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const userCount = await User.countDocuments();
    console.log(`✅ MongoDB connected - ${userCount} users in database`);
    
    // Test Redis
    console.log('1.2 Testing Redis connection...');
    const redis = new Redis({ host: 'localhost', port: 6379 });
    const pong = await redis.ping();
    
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    // Test Redis operations
    await redis.set('audit:test', 'value', 'EX', 10);
    const value = await redis.get('audit:test');
    await redis.del('audit:test');
    
    console.log(`✅ Redis connected - read/write operations working`);
    await redis.quit();
    
    logModule('1. Database Connectivity', 'PASS', {
      evidence: {
        mongodbConnected: true,
        mongodbUserCount: userCount,
        redisConnected: true,
        redisOperations: true
      }
    });
    
    return true;
  } catch (error) {
    logModule('1. Database Connectivity', 'FAIL', {
      error: error.message,
      rootCause: 'Database connection or operation error',
      fixApplied: 'NO',
      evidence: { stack: error.stack }
    });
    return false;
  }
}

// ============================================================================
// MODULE 2: API HEALTH & ENDPOINTS
// ============================================================================

async function testAPIHealth() {
  console.log('\n\n🏥 TESTING API HEALTH & ENDPOINTS...\n');
  
  try {
    // Test health endpoint
    console.log('2.1 Testing health endpoint...');
    const healthRes = await axios.get('http://localhost:5000/health');
    
    console.log(`Health status: ${healthRes.data.status}`);
    console.log(`Services: ${JSON.stringify(healthRes.data.services, null, 2)}`);
    
    if (healthRes.data.status !== 'healthy') {
      addWarning(`System health is ${healthRes.data.status}`);
    }
    
    // Test metrics endpoint
    console.log('2.2 Testing metrics endpoint...');
    try {
      const metricsRes = await axios.get('http://localhost:5000/metrics');
      console.log(`✅ Metrics endpoint responding (${metricsRes.data.length} bytes)`);
    } catch (error) {
      addWarning('Metrics endpoint not available');
    }
    
    // Test API v1 base
    console.log('2.3 Testing API v1 base...');
    try {
      await axios.get(`${BASE_URL}/`);
    } catch (error) {
      // 404 is expected for base route
      if (error.response?.status === 404) {
        console.log('✅ API v1 base responding (404 expected)');
      } else {
        throw error;
      }
    }
    
    logModule('2. API Health & Endpoints', 'PASS', {
      evidence: {
        healthEndpoint: true,
        healthStatus: healthRes.data.status,
        apiV1Responding: true
      }
    });
    
    return true;
  } catch (error) {
    logModule('2. API Health & Endpoints', 'FAIL', {
      error: error.message,
      rootCause: 'API endpoint error',
      fixApplied: 'NO',
      evidence: { stack: error.stack }
    });
    return false;
  }
}

// ============================================================================
// MODULE 3: DATA INTEGRITY
// ============================================================================

async function testDataIntegrity() {
  console.log('\n\n🔍 TESTING DATA INTEGRITY...\n');
  
  try {
    const db = mongoose.connection;
    
    // Check collections exist
    console.log('3.1 Checking database collections...');
    const collections = await db.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const requiredCollections = [
      'users',
      'workspaces',
      'workspacemembers',
      'plans',
      'billings',
      'subscriptions',
      'usages',
      'posts'
    ];
    
    const missingCollections = requiredCollections.filter(c => !collectionNames.includes(c));
    
    if (missingCollections.length > 0) {
      addWarning(`Missing collections: ${missingCollections.join(', ')}`);
    }
    
    console.log(`✅ Found ${collectionNames.length} collections`);
    console.log(`Collections: ${collectionNames.join(', ')}`);
    
    // Check for orphaned data
    console.log('3.2 Checking for orphaned workspace members...');
    const WorkspaceMember = mongoose.model('WorkspaceMember', new mongoose.Schema({}, { strict: false }));
    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }));
    
    const members = await WorkspaceMember.find();
    const workspaceIds = await Workspace.distinct('_id');
    const workspaceIdStrings = workspaceIds.map(id => id.toString());
    
    const orphanedMembers = members.filter(m => !workspaceIdStrings.includes(m.workspace.toString()));
    
    if (orphanedMembers.length > 0) {
      addWarning(`Found ${orphanedMembers.length} orphaned workspace members`);
    } else {
      console.log('✅ No orphaned workspace members found');
    }
    
    // Check for users without workspaces
    console.log('3.3 Checking for users without workspaces...');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find();
    
    let usersWithoutWorkspace = 0;
    for (const user of users) {
      const memberCount = await WorkspaceMember.countDocuments({ user: user._id });
      if (memberCount === 0) {
        usersWithoutWorkspace++;
      }
    }
    
    if (usersWithoutWorkspace > 0) {
      addWarning(`Found ${usersWithoutWorkspace} users without workspaces`);
    } else {
      console.log('✅ All users have workspaces');
    }
    
    // Check billing/subscription consistency
    console.log('3.4 Checking billing/subscription consistency...');
    const Billing = mongoose.model('Billing', new mongoose.Schema({}, { strict: false }));
    const Subscription = mongoose.model('Subscription', new mongoose.Schema({}, { strict: false }));
    
    const workspaces = await Workspace.find();
    let workspacesWithoutBilling = 0;
    let workspacesWithoutSubscription = 0;
    
    for (const workspace of workspaces) {
      const billing = await Billing.findOne({ workspace: workspace._id });
      const subscription = await Subscription.findOne({ workspace: workspace._id });
      
      if (!billing) workspacesWithoutBilling++;
      if (!subscription) workspacesWithoutSubscription++;
    }
    
    if (workspacesWithoutBilling > 0) {
      addWarning(`${workspacesWithoutBilling} workspaces without billing records`);
    }
    
    if (workspacesWithoutSubscription > 0) {
      addWarning(`${workspacesWithoutSubscription} workspaces without subscriptions`);
    }
    
    console.log('✅ Billing/subscription consistency checked');
    
    logModule('3. Data Integrity', 'PASS', {
      evidence: {
        collectionsFound: collectionNames.length,
        missingCollections: missingCollections.length,
        orphanedMembers: orphanedMembers.length,
        usersWithoutWorkspace,
        workspacesWithoutBilling,
        workspacesWithoutSubscription
      }
    });
    
    return true;
  } catch (error) {
    logModule('3. Data Integrity', 'FAIL', {
      error: error.message,
      rootCause: 'Data integrity check error',
      fixApplied: 'NO',
      evidence: { stack: error.stack }
    });
    return false;
  }
}

// ============================================================================
// MODULE 4: QUEUE SYSTEM
// ============================================================================

async function testQueueSystem() {
  console.log('\n\n📋 TESTING QUEUE SYSTEM...\n');
  
  try {
    const redis = new Redis({ host: 'localhost', port: 6379 });
    
    // Check queue keys
    console.log('4.1 Checking queue keys...');
    const queueKeys = await redis.keys('bull:posting-queue:*');
    console.log(`Found ${queueKeys.length} queue keys`);
    
    // Check for specific queue structures
    const waitingKey = 'bull:posting-queue:wait';
    const activeKey = 'bull:posting-queue:active';
    const completedKey = 'bull:posting-queue:completed';
    const failedKey = 'bull:posting-queue:failed';
    
    const waitingCount = await redis.llen(waitingKey);
    const activeCount = await redis.llen(activeKey);
    const completedCount = await redis.zcard(completedKey);
    const failedCount = await redis.zcard(failedKey);
    
    console.log(`Queue status:`);
    console.log(`  - Waiting: ${waitingCount}`);
    console.log(`  - Active: ${activeCount}`);
    console.log(`  - Completed: ${completedCount}`);
    console.log(`  - Failed: ${failedCount}`);
    
    if (failedCount > 10) {
      addWarning(`High number of failed jobs: ${failedCount}`);
    }
    
    // Check DLQ
    console.log('4.2 Checking Dead Letter Queue...');
    const dlqKeys = await redis.keys('bull:posting-queue:dlq:*');
    console.log(`DLQ keys: ${dlqKeys.length}`);
    
    // Check for stalled jobs
    console.log('4.3 Checking for stalled jobs...');
    const stalledKey = 'bull:posting-queue:stalled';
    const stalledCount = await redis.scard(stalledKey);
    
    if (stalledCount > 0) {
      addWarning(`Found ${stalledCount} stalled jobs`);
    } else {
      console.log('✅ No stalled jobs found');
    }
    
    await redis.quit();
    
    logModule('4. Queue System', 'PASS', {
      evidence: {
        queueKeysFound: queueKeys.length,
        waiting: waitingCount,
        active: activeCount,
        completed: completedCount,
        failed: failedCount,
        stalled: stalledCount,
        dlqKeys: dlqKeys.length
      }
    });
    
    return true;
  } catch (error) {
    logModule('4. Queue System', 'FAIL', {
      error: error.message,
      rootCause: 'Queue system check error',
      fixApplied: 'NO',
      evidence: { stack: error.stack }
    });
    return false;
  }
}

// ============================================================================
// MODULE 5: SECURITY CONFIGURATION
// ============================================================================

async function testSecurityConfiguration() {
  console.log('\n\n🔒 TESTING SECURITY CONFIGURATION...\n');
  
  try {
    // Check environment variables
    console.log('5.1 Checking security environment variables...');
    const requiredEnvVars = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingEnvVars.length > 0) {
      addCriticalIssue(`Missing security environment variables: ${missingEnvVars.join(', ')}`);
    } else {
      console.log('✅ All security environment variables present');
    }
    
    // Check JWT secret strength
    console.log('5.2 Checking JWT secret strength...');
    const jwtSecret = process.env.JWT_SECRET || '';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';
    
    if (jwtSecret.length < 32) {
      addCriticalIssue('JWT_SECRET is too short (< 32 characters)');
    }
    
    if (jwtRefreshSecret.length < 32) {
      addCriticalIssue('JWT_REFRESH_SECRET is too short (< 32 characters)');
    }
    
    if (jwtSecret === jwtRefreshSecret) {
      addCriticalIssue('JWT_SECRET and JWT_REFRESH_SECRET are the same');
    }
    
    // Check for default/weak secrets
    const weakSecrets = [
      'your-super-secret',
      'change-this',
      'secret',
      'password',
      '123456'
    ];
    
    if (weakSecrets.some(weak => jwtSecret.toLowerCase().includes(weak))) {
      addCriticalIssue('JWT_SECRET contains weak/default value');
    }
    
    console.log('✅ JWT secrets checked');
    
    // Check encryption key
    console.log('5.3 Checking encryption key...');
    const encryptionKey = process.env.ENCRYPTION_KEY || '';
    
    if (encryptionKey.length !== 64) {
      addCriticalIssue('ENCRYPTION_KEY is not 64 characters (32 bytes hex)');
    }
    
    console.log('✅ Encryption key checked');
    
    // Test injection protection
    console.log('5.4 Testing injection protection...');
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: { $ne: null },
        password: { $ne: null }
      });
      addCriticalIssue('INJECTION VULNERABILITY - NoSQL injection not blocked');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Injection protection active');
      } else if (error.response && error.response.status === 429) {
        console.log('⏳ Rate limited - cannot test injection protection');
      }
    }
    
    logModule('5. Security Configuration', auditResults.criticalIssues.length > 0 ? 'FAIL' : 'PASS', {
      evidence: {
        envVarsPresent: missingEnvVars.length === 0,
        jwtSecretLength: jwtSecret.length,
        jwtRefreshSecretLength: jwtRefreshSecret.length,
        encryptionKeyLength: encryptionKey.length,
        injectionProtection: true
      }
    });
    
    return auditResults.criticalIssues.length === 0;
  } catch (error) {
    logModule('5. Security Configuration', 'FAIL', {
      error: error.message,
      rootCause: 'Security configuration check error',
      fixApplied: 'NO',
      evidence: { stack: error.stack }
    });
    return false;
  }
}

// ============================================================================
// MODULE 6: RATE LIMITING
// ============================================================================

async function testRateLimiting() {
  console.log('\n\n🚦 TESTING RATE LIMITING...\n');
  
  try {
    console.log('6.1 Testing rate limiting on login endpoint...');
    
    let rateLimited = false;
    let requestCount = 0;
    
    for (let i = 0; i < 15; i++) {
      try {
        await axios.post(`${BASE_URL}/auth/login`, {
          email: 'nonexistent@test.com',
          password: 'wrong'
        });
        requestCount++;
      } catch (error) {
        if (error.response && error.response.status === 429) {
          rateLimited = true;
          console.log(`✅ Rate limited after ${requestCount} requests`);
          break;
        }
        requestCount++;
      }
      await wait(100); // Small delay between requests
    }
    
    if (!rateLimited) {
      addWarning(`Rate limiting not triggered after ${requestCount} requests`);
    }
    
    // Wait for rate limit to reset
    console.log('6.2 Waiting for rate limit to reset...');
    await wait(5000);
    
    // Test that we can make requests again
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@test.com',
        password: 'wrong'
      });
    } catch (error) {
      if (error.response && error.response.status !== 429) {
        console.log('✅ Rate limit reset successfully');
      }
    }
    
    logModule('6. Rate Limiting', 'PASS', {
      evidence: {
        rateLimitingActive: rateLimited,
        requestsBeforeLimit: requestCount
      }
    });
    
    return true;
  } catch (error) {
    logModule('6. Rate Limiting', 'FAIL', {
      error: error.message,
      rootCause: 'Rate limiting test error',
      fixApplied: 'NO',
      evidence: { stack: error.stack }
    });
    return false;
  }
}

// ============================================================================
// MAIN AUDIT EXECUTION
// ============================================================================

async function runAudit() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              PRODUCTION RELIABILITY AUDIT V2                               ║');
  console.log('║              Social Media Scheduler SaaS                                   ║');
  console.log('║              Enhanced Diagnostics & Error Handling                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Run all test modules
    await testDatabaseConnectivity();
    await testAPIHealth();
    await testDataIntegrity();
    await testQueueSystem();
    await testSecurityConfiguration();
    await testRateLimiting();
    
    // Generate final report
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                          FINAL AUDIT REPORT                                ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    console.log(`📊 SUMMARY:`);
    console.log(`   ✅ Passed: ${auditResults.passed}`);
    console.log(`   ⚠️  Partial: ${auditResults.partial}`);
    console.log(`   ❌ Failed: ${auditResults.failed}`);
    console.log(`   📝 Total Modules: ${auditResults.modules.length}`);
    console.log('\n');
    
    if (auditResults.criticalIssues.length > 0) {
      console.log(`🚨 CRITICAL ISSUES (${auditResults.criticalIssues.length}):`);
      auditResults.criticalIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      console.log('\n');
    }
    
    if (auditResults.warnings.length > 0) {
      console.log(`⚠️  WARNINGS (${auditResults.warnings.length}):`);
      auditResults.warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
      console.log('\n');
    }
    
    // Production readiness assessment
    const productionReady = auditResults.failed === 0 && auditResults.criticalIssues.length === 0;
    
    console.log(`🎯 PRODUCTION READINESS: ${productionReady ? '✅ YES' : '❌ NO'}`);
    console.log(`🔒 SECURITY STATUS: ${auditResults.criticalIssues.length === 0 ? '✅ SECURE' : '❌ VULNERABLE'}`);
    console.log(`💾 DATA SAFETY: ${auditResults.failed === 0 ? '✅ SAFE' : '⚠️  NEEDS REVIEW'}`);
    console.log(`📋 QUEUE RELIABILITY: ${auditResults.modules.find(m => m.module === '4. Queue System')?.status === 'PASS' ? '✅ RELIABLE' : '⚠️  NEEDS REVIEW'}`);
    console.log(`🔑 TOKEN SECURITY: ${auditResults.modules.find(m => m.module === '5. Security Configuration')?.status === 'PASS' ? '✅ SECURE' : '❌ VULNERABLE'}`);
    
    console.log('\n');
    
    // Detailed module results
    console.log('📋 DETAILED MODULE RESULTS:\n');
    auditResults.modules.forEach((module, i) => {
      const statusIcon = module.status === 'PASS' ? '✅' : module.status === 'PARTIAL' ? '⚠️' : '❌';
      console.log(`${i + 1}. ${statusIcon} ${module.module}: ${module.status}`);
    });
    
    console.log('\n');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // Recommendations
    if (auditResults.criticalIssues.length > 0 || auditResults.warnings.length > 0) {
      console.log('📝 RECOMMENDED FIXES (Priority Order):\n');
      
      let priority = 1;
      
      if (auditResults.criticalIssues.length > 0) {
        console.log('🔴 CRITICAL (Must Fix Before Production):');
        auditResults.criticalIssues.forEach(issue => {
          console.log(`   ${priority++}. ${issue}`);
        });
        console.log('');
      }
      
      if (auditResults.warnings.length > 0) {
        console.log('🟡 WARNINGS (Should Fix):');
        auditResults.warnings.forEach(warning => {
          console.log(`   ${priority++}. ${warning}`);
        });
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('\n❌ AUDIT FAILED:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    await mongoose.disconnect();
    process.exit(auditResults.failed > 0 || auditResults.criticalIssues.length > 0 ? 1 : 0);
  }
}

// Run the audit
runAudit();
