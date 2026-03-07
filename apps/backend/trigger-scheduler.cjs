require('dotenv').config({ path: '.env.production' });
const { connectDatabase } = require('./dist/config/database');
const { connectRedis } = require('./dist/config/redis');
const { schedulerService } = require('./dist/services/SchedulerService');

async function triggerScheduler() {
  try {
    console.log('🔌 Connecting to databases...');
    await connectDatabase();
    await connectRedis();
    console.log('✅ Connected to databases');

    console.log('🚀 Triggering scheduler...');
    await schedulerService.forcePoll();
    console.log('✅ Scheduler triggered successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

triggerScheduler();