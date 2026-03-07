/**
 * Database Migration: Set All Accounts to V2
 * 
 * Purpose:
 * - Migrate all existing accounts to connectionVersion='v2'
 * - Part of single-version architecture cutover
 * 
 * Safety:
 * - Idempotent (safe to run multiple times)
 * - Dry-run mode (default)
 * - Preserves all account data
 * 
 * Usage:
 *   npm run migrate:all-to-v2              # Dry run
 *   npm run migrate:all-to-v2 -- --execute # Execute migration
 */

import mongoose from 'mongoose';
import { SocialAccount } from '../src/models/SocialAccount';
import { logger } from '../src/utils/logger';
import { config } from '../src/config';

interface MigrationStats {
  total: number;
  alreadyV2: number;
  migrated: number;
  errors: number;
}

async function migrateAllToV2(dryRun: boolean = true): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    alreadyV2: 0,
    migrated: 0,
    errors: 0,
  };

  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri);
    logger.info('Connected to MongoDB');

    // Get all accounts
    const allAccounts = await SocialAccount.find({});
    stats.total = allAccounts.length;

    logger.info(`Found ${stats.total} total accounts`);

    if (stats.total === 0) {
      logger.info('No accounts to migrate');
      return stats;
    }

    // Count by version
    const byVersion = await SocialAccount.aggregate([
      { $group: { _id: '$connectionVersion', count: { $sum: 1 } } },
    ]);

    logger.info('Current version distribution:', byVersion);

    if (dryRun) {
      logger.info('🔍 DRY RUN MODE - No changes will be made');
    } else {
      logger.info('⚠️  EXECUTE MODE - Migrating accounts...');
    }

    // Migrate each account
    for (const account of allAccounts) {
      try {
        if (account.connectionVersion === 'v2') {
          stats.alreadyV2++;
          continue;
        }

        if (dryRun) {
          logger.info('[DRY RUN] Would migrate account', {
            accountId: account._id,
            platform: account.provider,
            currentVersion: account.connectionVersion || 'undefined',
          });
          stats.migrated++;
        } else {
          account.connectionVersion = 'v2';
          await account.save();

          logger.info('Account migrated', {
            accountId: account._id,
            platform: account.provider,
            previousVersion: account.connectionVersion || 'undefined',
            newVersion: 'v2',
          });
          stats.migrated++;
        }
      } catch (error: any) {
        logger.error('Migration failed for account', {
          accountId: account._id,
          error: error.message,
        });
        stats.errors++;
      }
    }

    // Summary
    logger.info('Migration complete', {
      mode: dryRun ? 'DRY RUN' : 'EXECUTE',
      total: stats.total,
      alreadyV2: stats.alreadyV2,
      migrated: stats.migrated,
      errors: stats.errors,
    });

    // Verify if executed
    if (!dryRun) {
      const finalByVersion = await SocialAccount.aggregate([
        { $group: { _id: '$connectionVersion', count: { $sum: 1 } } },
      ]);

      logger.info('Final version distribution:', finalByVersion);

      const nonV2Count = await SocialAccount.countDocuments({
        connectionVersion: { $ne: 'v2' },
      });

      if (nonV2Count > 0) {
        logger.warn(`⚠️  ${nonV2Count} accounts are not V2`);
      } else {
        logger.info('✅ All accounts are now V2');
      }
    }

    return stats;
  } catch (error: any) {
    logger.error('Migration script failed', { error: error.message });
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

  migrateAllToV2(dryRun)
    .then((stats) => {
      if (dryRun) {
        console.log('\n✅ Dry run complete. Run with --execute to perform migration.\n');
        console.log(`Would migrate ${stats.migrated} accounts to V2`);
        console.log(`${stats.alreadyV2} accounts already V2\n`);
      } else {
        console.log('\n✅ Migration complete.\n');
        console.log(`Migrated ${stats.migrated} accounts to V2`);
        console.log(`${stats.alreadyV2} accounts were already V2`);
        console.log(`${stats.errors} errors\n`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error.message, '\n');
      process.exit(1);
    });
}

export { migrateAllToV2 };
