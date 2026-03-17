/**
 * Migration: Add deletedAt field to Workspace collection
 * 
 * Adds deletedAt field for soft delete functionality and updates indexes
 */

import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace';
import { logger } from '../utils/logger';

export async function up(): Promise<void> {
  logger.info('Starting migration: add-workspace-deleted-at');

  try {
    // Add deletedAt field to existing workspaces (null by default)
    const result = await Workspace.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );

    logger.info('Added deletedAt field to workspaces', {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    // Create new indexes with deletedAt
    logger.info('Creating new indexes with deletedAt field');
    
    try {
      await Workspace.collection.createIndex(
        { ownerId: 1, isActive: 1, deletedAt: 1 },
        { background: true }
      );
      logger.info('Created index: ownerId_1_isActive_1_deletedAt_1');
    } catch (error: any) {
      if (error.code === 11000) {
        logger.warn('Index already exists: ownerId_1_isActive_1_deletedAt_1');
      } else {
        throw error;
      }
    }

    try {
      await Workspace.collection.createIndex(
        { plan: 1, isActive: 1, deletedAt: 1 },
        { background: true }
      );
      logger.info('Created index: plan_1_isActive_1_deletedAt_1');
    } catch (error: any) {
      if (error.code === 11000) {
        logger.warn('Index already exists: plan_1_isActive_1_deletedAt_1');
      } else {
        throw error;
      }
    }

    // Update unique slug index to include deletedAt
    try {
      // Drop old unique index
      await Workspace.collection.dropIndex('slug_1');
      logger.info('Dropped old slug index');
    } catch (error: any) {
      if (error.code === 27) {
        logger.warn('Old slug index does not exist');
      } else {
        logger.warn('Failed to drop old slug index:', error.message);
      }
    }

    try {
      await Workspace.collection.createIndex(
        { slug: 1, deletedAt: 1 },
        { unique: true, background: true }
      );
      logger.info('Created unique index: slug_1_deletedAt_1');
    } catch (error: any) {
      if (error.code === 11000) {
        logger.warn('Index already exists: slug_1_deletedAt_1');
      } else {
        throw error;
      }
    }

    logger.info('Migration completed successfully');

  } catch (error: any) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
}

export async function down(): Promise<void> {
  logger.info('Starting rollback: add-workspace-deleted-at');

  try {
    // Drop new indexes
    try {
      await Workspace.collection.dropIndex('ownerId_1_isActive_1_deletedAt_1');
      logger.info('Dropped index: ownerId_1_isActive_1_deletedAt_1');
    } catch (error: any) {
      if (error.code === 27) {
        logger.warn('Index does not exist: ownerId_1_isActive_1_deletedAt_1');
      }
    }

    try {
      await Workspace.collection.dropIndex('plan_1_isActive_1_deletedAt_1');
      logger.info('Dropped index: plan_1_isActive_1_deletedAt_1');
    } catch (error: any) {
      if (error.code === 27) {
        logger.warn('Index does not exist: plan_1_isActive_1_deletedAt_1');
      }
    }

    try {
      await Workspace.collection.dropIndex('slug_1_deletedAt_1');
      logger.info('Dropped index: slug_1_deletedAt_1');
    } catch (error: any) {
      if (error.code === 27) {
        logger.warn('Index does not exist: slug_1_deletedAt_1');
      }
    }

    // Recreate original slug index
    try {
      await Workspace.collection.createIndex(
        { slug: 1 },
        { unique: true, background: true }
      );
      logger.info('Recreated original slug index');
    } catch (error: any) {
      if (error.code === 11000) {
        logger.warn('Original slug index already exists');
      }
    }

    // Remove deletedAt field
    const result = await Workspace.updateMany(
      {},
      { $unset: { deletedAt: '' } }
    );

    logger.info('Removed deletedAt field from workspaces', {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    logger.info('Rollback completed successfully');

  } catch (error: any) {
    logger.error('Rollback failed', { error: error.message });
    throw error;
  }
}