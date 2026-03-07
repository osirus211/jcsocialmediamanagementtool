/**
 * Migration: Add Platform Integration Fields to SocialAccount
 * 
 * Adds new fields for real platform integrations:
 * - connectionOwner: Workspace that first connected the account
 * - platformAccountId: Unique ID from platform for duplicate detection
 * - capabilities: Platform capabilities metadata
 * - permissionStatus: Permission validation status
 * - missingPermissions: List of missing OAuth scopes
 * 
 * Backfills existing accounts with:
 * - connectionOwner = workspaceId (current workspace owns the account)
 * - platformAccountId = providerUserId (use existing provider user ID)
 */

import mongoose from 'mongoose';
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';

export async function up(): Promise<void> {
  logger.info('Starting migration: add-platform-integration-fields');

  try {
    // Get count of accounts to migrate
    const totalAccounts = await SocialAccount.countDocuments({
      $or: [
        { connectionOwner: { $exists: false } },
        { platformAccountId: { $exists: false } }
      ]
    });

    logger.info(`Found ${totalAccounts} accounts to migrate`);

    if (totalAccounts === 0) {
      logger.info('No accounts to migrate');
      return;
    }

    // Backfill connectionOwner and platformAccountId for existing accounts
    const result = await SocialAccount.updateMany(
      {
        $or: [
          { connectionOwner: { $exists: false } },
          { platformAccountId: { $exists: false } }
        ]
      },
      [
        {
          $set: {
            // Set connectionOwner to workspaceId if not set
            connectionOwner: {
              $cond: {
                if: { $not: ['$connectionOwner'] },
                then: '$workspaceId',
                else: '$connectionOwner'
              }
            },
            // Set platformAccountId to providerUserId if not set
            platformAccountId: {
              $cond: {
                if: { $not: ['$platformAccountId'] },
                then: '$providerUserId',
                else: '$platformAccountId'
              }
            }
          }
        }
      ]
    );

    logger.info('Migration completed successfully', {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    // Create unique index on (provider, platformAccountId)
    logger.info('Creating unique index on (provider, platformAccountId)');
    
    try {
      await SocialAccount.collection.createIndex(
        { provider: 1, platformAccountId: 1 },
        {
          unique: true,
          sparse: true,
          partialFilterExpression: { platformAccountId: { $exists: true, $ne: null } }
        }
      );
      logger.info('Unique index created successfully');
    } catch (error: any) {
      if (error.code === 11000) {
        logger.warn('Unique index already exists');
      } else {
        throw error;
      }
    }

  } catch (error: any) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
}

export async function down(): Promise<void> {
  logger.info('Starting rollback: add-platform-integration-fields');

  try {
    // Remove the unique index
    logger.info('Dropping unique index on (provider, platformAccountId)');
    
    try {
      await SocialAccount.collection.dropIndex('provider_1_platformAccountId_1');
      logger.info('Unique index dropped successfully');
    } catch (error: any) {
      if (error.code === 27) {
        logger.warn('Index does not exist');
      } else {
        throw error;
      }
    }

    // Remove the new fields
    const result = await SocialAccount.updateMany(
      {},
      {
        $unset: {
          connectionOwner: '',
          platformAccountId: '',
          capabilities: '',
          permissionStatus: '',
          missingPermissions: ''
        }
      }
    );

    logger.info('Rollback completed successfully', {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

  } catch (error: any) {
    logger.error('Rollback failed', { error: error.message });
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  const run = async () => {
    try {
      // Connect to MongoDB
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler';
      await mongoose.connect(mongoUri);
      logger.info('Connected to MongoDB');

      // Run migration
      await up();

      logger.info('Migration completed');
      process.exit(0);
    } catch (error: any) {
      logger.error('Migration failed', { error: error.message });
      process.exit(1);
    }
  };

  run();
}
