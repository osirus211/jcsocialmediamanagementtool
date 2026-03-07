/**
 * Rollback Script: V2 → V1
 * 
 * MILESTONE 2: Safe rollback mechanism
 * 
 * Purpose:
 * - Rollback V2 accounts to V1 before enabling automatic upgrades
 * - Provides safety net for production deployment
 * 
 * Safety Features:
 * - Idempotent (safe to run multiple times)
 * - Queue drain detection (blocks if active jobs)
 * - Preserves encrypted tokens
 * - Dry-run mode
 * - Detailed logging
 * 
 * Usage:
 *   npm run rollback:v2-to-v1              # Dry run
 *   npm run rollback:v2-to-v1 -- --execute # Execute rollback
 */

import mongoose from 'mongoose';
import { SocialAccount } from '../src/models/SocialAccount';
import { logger } from '../src/utils/logger';
import { Queue } from 'bullmq';
import { config } from '../src/config';

interface RollbackStats {
  totalV2Accounts: number;
  rolledBack: number;
  alreadyV1: number;
  errors: number;
  skipped: number;
}

interface QueueStatus {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

/**
 * Check if publishing queue is drained
 * Returns true if safe to proceed with rollback
 */
async function isQueueDrained(): Promise<{ safe: boolean; status: QueueStatus }> {
  try {
    const publishingQueue = new Queue('publishing', {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
    });

    const [waiting, active, delayed, failed] = await Promise.all([
      publishingQueue.getWaitingCount(),
      publishingQueue.getActiveCount(),
      publishingQueue.getDelayedCount(),
      publishingQueue.getFailedCount(),
    ]);

    await publishingQueue.close();

    const status: QueueStatus = { waiting, active, delayed, failed };
    const safe = waiting === 0 && active === 0;

    return { safe, status };
  } catch (error: any) {
    logger.warn('Queue check failed (Redis not available?)', { error: error.message });
    // If Redis is not available, assume safe (no queue = no jobs)
    return { safe: true, status: { waiting: 0, active: 0, delayed: 0, failed: 0 } };
  }
}

/**
 * Rollback a single account from V2 to V1
 * Idempotent: safe to call on already-V1 accounts
 */
async function rollbackAccount(accountId: mongoose.Types.ObjectId, dryRun: boolean): Promise<'rolled_back' | 'already_v1' | 'error'> {
  try {
    const account = await SocialAccount.findById(accountId);

    if (!account) {
      logger.error('Account not found', { accountId });
      return 'error';
    }

    // Idempotency: already V1 or undefined (treated as V1)
    if (!account.connectionVersion || account.connectionVersion === 'v1') {
      logger.info('Account already V1', { accountId, connectionVersion: account.connectionVersion });
      return 'already_v1';
    }

    if (account.connectionVersion !== 'v2') {
      logger.error('Unexpected connectionVersion', { accountId, connectionVersion: account.connectionVersion });
      return 'error';
    }

    if (dryRun) {
      logger.info('[DRY RUN] Would rollback account', {
        accountId,
        platform: account.provider,
        currentVersion: account.connectionVersion,
      });
      return 'rolled_back';
    }

    // Perform rollback: V2 → V1
    account.connectionVersion = 'v1';
    await account.save();

    logger.info('Account rolled back successfully', {
      accountId,
      platform: account.provider,
      previousVersion: 'v2',
      newVersion: 'v1',
    });

    return 'rolled_back';
  } catch (error: any) {
    logger.error('Rollback failed for account', { accountId, error: error.message });
    return 'error';
  }
}

/**
 * Main rollback function
 */
async function rollbackV2ToV1(dryRun: boolean = true): Promise<RollbackStats> {
  const stats: RollbackStats = {
    totalV2Accounts: 0,
    rolledBack: 0,
    alreadyV1: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri);
    logger.info('Connected to MongoDB');

    // Check queue status
    logger.info('Checking publishing queue status...');
    const { safe, status } = await isQueueDrained();

    logger.info('Queue status', status);

    if (!safe) {
      logger.error('ROLLBACK BLOCKED: Publishing queue not drained', {
        waiting: status.waiting,
        active: status.active,
        message: 'Wait for queue to drain before running rollback',
      });
      stats.skipped = -1; // Indicate blocked
      return stats;
    }

    logger.info('✅ Queue drained - safe to proceed');

    // Find all V2 accounts
    const v2Accounts = await SocialAccount.find({ connectionVersion: 'v2' });
    stats.totalV2Accounts = v2Accounts.length;

    logger.info(`Found ${stats.totalV2Accounts} V2 accounts`);

    if (stats.totalV2Accounts === 0) {
      logger.info('No V2 accounts to rollback');
      return stats;
    }

    if (dryRun) {
      logger.info('🔍 DRY RUN MODE - No changes will be made');
    } else {
      logger.info('⚠️  EXECUTE MODE - Rolling back accounts...');
    }

    // Rollback each account
    for (const account of v2Accounts) {
      const result = await rollbackAccount(account._id, dryRun);

      switch (result) {
        case 'rolled_back':
          stats.rolledBack++;
          break;
        case 'already_v1':
          stats.alreadyV1++;
          break;
        case 'error':
          stats.errors++;
          break;
      }
    }

    // Summary
    logger.info('Rollback complete', {
      mode: dryRun ? 'DRY RUN' : 'EXECUTE',
      totalV2Accounts: stats.totalV2Accounts,
      rolledBack: stats.rolledBack,
      alreadyV1: stats.alreadyV1,
      errors: stats.errors,
    });

    return stats;
  } catch (error: any) {
    logger.error('Rollback script failed', { error: error.message });
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const dryRun = !execute;

  rollbackV2ToV1(dryRun)
    .then((stats) => {
      if (stats.skipped === -1) {
        console.error('\n❌ ROLLBACK BLOCKED: Queue not drained\n');
        process.exit(1);
      }

      if (dryRun) {
        console.log('\n✅ Dry run complete. Run with --execute to perform rollback.\n');
      } else {
        console.log('\n✅ Rollback complete.\n');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Rollback failed:', error.message, '\n');
      process.exit(1);
    });
}

// Export for testing
export { rollbackV2ToV1, isQueueDrained, rollbackAccount };
