/**
 * Phase 1 Validation: Redis Monitor
 * 
 * Monitors Redis keys and queue activity in real-time
 */

require('dotenv').config();
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function monitorRedis() {
  let redis;
  let queue;
  let dlqQueue;

  try {
    console.log('🔧 Phase 1: Redis Monitor');
    console.log('==========================\n');

    // Connect to Redis
    console.log('📦 Connecting to Redis...');
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    console.log('✅ Redis connected\n');

    // Create queues
    queue = new Queue('token-refresh-queue', { connection: redis });
    dlqQueue = new Queue('token-refresh-dlq', { connection: redis });

    console.log('🔍 Monitoring (press Ctrl+C to stop)...\n');

    // Monitor loop
    setInterval(async () => {
      try {
        const timestamp = new Date().toISOString();
        console.clear();
        console.log('🔧 Phase 1: Redis Monitor');
        console.log('==========================');
        console.log(`Last Update: ${timestamp}\n`);

        // Queue stats
        console.log('📊 Token Refresh Queue:');
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        console.log(`   Waiting:   ${waiting}`);
        console.log(`   Active:    ${active}`);
        console.log(`   Completed: ${completed}`);
        console.log(`   Failed:    ${failed}`);
        console.log(`   Delayed:   ${delayed}`);

        // DLQ stats
        console.log('\n📊 Dead Letter Queue:');
        const [dlqWaiting, dlqCompleted, dlqFailed] = await Promise.all([
          dlqQueue.getWaitingCount(),
          dlqQueue.getCompletedCount(),
          dlqQueue.getFailedCount(),
        ]);

        console.log(`   Waiting:   ${dlqWaiting}`);
        console.log(`   Completed: ${dlqCompleted}`);
        console.log(`   Failed:    ${dlqFailed}`);

        // Active locks
        console.log('\n🔒 Active Locks:');
        const lockKeys = await redis.keys('oauth:refresh:lock:*');
        
        if (lockKeys.length > 0) {
          console.log(`   ${lockKeys.length} lock(s) held:`);
          for (const key of lockKeys.slice(0, 5)) {
            const value = await redis.get(key);
            const ttl = await redis.ttl(key);
            const connectionId = key.split(':').pop();
            console.log(`   - ${connectionId.substring(0, 8)}... (TTL: ${ttl}s, Worker: ${value})`);
          }
          if (lockKeys.length > 5) {
            console.log(`   ... and ${lockKeys.length - 5} more`);
          }
        } else {
          console.log('   No active locks');
        }

        // DLQ entries
        console.log('\n💀 DLQ Entries:');
        const dlqKeys = await redis.keys('oauth:refresh:dlq:*');
        
        if (dlqKeys.length > 0) {
          console.log(`   ${dlqKeys.length} entry(ies):`);
          for (const key of dlqKeys.slice(0, 3)) {
            const value = await redis.get(key);
            const data = JSON.parse(value);
            const connectionId = key.split(':').pop();
            console.log(`   - ${connectionId.substring(0, 8)}... (Error: ${data.error.substring(0, 40)}...)`);
          }
          if (dlqKeys.length > 3) {
            console.log(`   ... and ${dlqKeys.length - 3} more`);
          }
        } else {
          console.log('   No DLQ entries');
        }

        // Recent jobs
        console.log('\n📋 Recent Active Jobs:');
        const activeJobs = await queue.getActive(0, 5);
        
        if (activeJobs.length > 0) {
          for (const job of activeJobs) {
            const elapsed = Date.now() - (job.processedOn || job.timestamp);
            console.log(`   - Job ${job.id}: ${job.data.provider} (${Math.round(elapsed / 1000)}s)`);
          }
        } else {
          console.log('   No active jobs');
        }

        // Redis info
        console.log('\n💾 Redis Info:');
        const info = await redis.info('memory');
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        const peakMatch = info.match(/used_memory_peak_human:(.+)/);
        
        if (memoryMatch) {
          console.log(`   Memory Used: ${memoryMatch[1].trim()}`);
        }
        if (peakMatch) {
          console.log(`   Memory Peak: ${peakMatch[1].trim()}`);
        }

        const clientsInfo = await redis.info('clients');
        const connectedMatch = clientsInfo.match(/connected_clients:(\d+)/);
        
        if (connectedMatch) {
          console.log(`   Connected Clients: ${connectedMatch[1]}`);
        }

        console.log('\n(Refreshing every 2 seconds...)');

      } catch (error) {
        console.error('❌ Monitor error:', error.message);
      }
    }, 2000);

  } catch (error) {
    console.error('❌ Failed to start monitor:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Monitor stopped');
  process.exit(0);
});

monitorRedis();
