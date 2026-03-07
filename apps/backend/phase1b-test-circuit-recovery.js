/**
 * Phase 1B: Circuit Breaker Recovery Test
 * 
 * Tests HALF_OPEN transition and recovery
 */

require('dotenv').config();
const Redis = require('ioredis');

// Construct Redis URL from environment variables
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6380';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_URL = process.env.REDIS_URL || 
  (REDIS_PASSWORD 
    ? `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
    : `redis://${REDIS_HOST}:${REDIS_PORT}`);

async function testCircuitRecovery() {
  let redis;

  try {
    console.log('🔧 Phase 1B: Circuit Recovery Test');
    console.log('====================================\n');

    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

    // Check all circuit states
    console.log('Checking circuit states for all providers...\n');

    const providers = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube'];
    
    for (const provider of providers) {
      const circuitKey = `oauth:circuit:${provider}`;
      const circuitData = await redis.get(circuitKey);
      
      if (circuitData) {
        const state = JSON.parse(circuitData);
        console.log(`Provider: ${provider}`);
        console.log(`   State: ${state.state}`);
        console.log(`   Failure Count: ${state.failureCount}`);
        console.log(`   Success Count: ${state.successCount}`);
        
        if (state.openedAt) {
          const openedAt = new Date(state.openedAt);
          const elapsed = Math.floor((Date.now() - state.openedAt) / 1000);
          console.log(`   Opened At: ${openedAt.toISOString()}`);
          console.log(`   Elapsed: ${elapsed} seconds`);
        }
        
        if (state.nextAttemptAt) {
          const nextAttempt = new Date(state.nextAttemptAt);
          const remaining = Math.ceil((state.nextAttemptAt - Date.now()) / 1000);
          console.log(`   Next Attempt: ${nextAttempt.toISOString()}`);
          console.log(`   Remaining: ${remaining} seconds`);
          
          if (remaining <= 0) {
            console.log(`   ✅ Ready for HALF_OPEN transition`);
          } else {
            console.log(`   ⏳ Wait ${remaining} more seconds`);
          }
        }
        
        console.log('');
      } else {
        console.log(`Provider: ${provider} - No circuit state (CLOSED)\n`);
      }
    }

    console.log('Instructions:');
    console.log('1. If circuit is OPEN and cooldown expired:');
    console.log('   - Next refresh attempt will transition to HALF_OPEN');
    console.log('   - If refresh succeeds → CLOSED');
    console.log('   - If refresh fails → OPEN (120s extended)\n');
    console.log('2. Trigger a refresh job and watch backend logs\n');
    console.log('3. Check circuit state after:');
    console.log('   redis-cli GET oauth:circuit:{provider}\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (redis) redis.disconnect();
  }
}

testCircuitRecovery();
