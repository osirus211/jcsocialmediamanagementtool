/**
 * MongoDB Index Creation Script
 * 
 * Connects to MongoDB and calls Model.syncIndexes() on all models
 * Reports created vs existing indexes and is safe to run multiple times
 * 
 * Usage: npx ts-node apps/backend/src/scripts/create-indexes.ts
 */

import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

// Import all models to ensure they're registered
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { WorkspaceMember } from '../models/WorkspaceMember';
import { SocialAccount } from '../models/SocialAccount';
import { Post } from '../models/Post';
import { ScheduledPost } from '../models/ScheduledPost';
import { PostAnalytics } from '../models/PostAnalytics';
import { Media } from '../models/Media';
import { FollowerHistory } from '../models/FollowerHistory';
import { Campaign } from '../models/Campaign';
import { Category } from '../models/Category';
import { ClientReview } from '../models/ClientReview';
import { PostComment } from '../models/PostComment';
import { AccountPermission } from '../models/AccountPermission';
import { Notification } from '../models/Notification';
import { WorkspaceActivityLog } from '../models/WorkspaceActivityLog';
import { Subscription } from '../models/Subscription';
import { Usage } from '../models/Usage';
import { TrendMetric } from '../models/TrendMetric';
import { TikTokPost } from '../models/TikTokPost';
import { Webhook } from '../models/Webhook';
import { WebhookEvent } from '../models/WebhookEvent';
import { Workflow } from '../models/Workflow';
import { WorkflowRun } from '../models/WorkflowRun';

interface ModelInfo {
  name: string;
  model: mongoose.Model<any>;
}

const models: ModelInfo[] = [
  { name: 'User', model: User },
  { name: 'Workspace', model: Workspace },
  { name: 'WorkspaceMember', model: WorkspaceMember },
  { name: 'SocialAccount', model: SocialAccount },
  { name: 'Post', model: Post },
  { name: 'ScheduledPost', model: ScheduledPost },
  { name: 'PostAnalytics', model: PostAnalytics },
  { name: 'Media', model: Media },
  { name: 'FollowerHistory', model: FollowerHistory },
  { name: 'Campaign', model: Campaign },
  { name: 'Category', model: Category },
  { name: 'ClientReview', model: ClientReview },
  { name: 'PostComment', model: PostComment },
  { name: 'AccountPermission', model: AccountPermission },
  { name: 'Notification', model: Notification },
  { name: 'WorkspaceActivityLog', model: WorkspaceActivityLog },
  { name: 'Subscription', model: Subscription },
  { name: 'Usage', model: Usage },
  { name: 'TrendMetric', model: TrendMetric },
  { name: 'TikTokPost', model: TikTokPost },
  { name: 'Webhook', model: Webhook },
  { name: 'WebhookEvent', model: WebhookEvent },
  { name: 'Workflow', model: Workflow },
  { name: 'WorkflowRun', model: WorkflowRun },
];

async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.database.uri);
    logger.info('Connected to MongoDB for index creation');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

async function syncModelIndexes(modelInfo: ModelInfo): Promise<{
  created: string[];
  existing: string[];
  errors: string[];
}> {
  const result = {
    created: [] as string[],
    existing: [] as string[],
    errors: [] as string[],
  };

  try {
    // Get existing indexes before sync
    const existingIndexes = await modelInfo.model.collection.indexes();
    const existingIndexNames = new Set(existingIndexes.map(idx => idx.name));

    // Sync indexes (creates missing ones)
    await modelInfo.model.syncIndexes();

    // Get indexes after sync
    const newIndexes = await modelInfo.model.collection.indexes();
    
    for (const index of newIndexes) {
      if (existingIndexNames.has(index.name)) {
        result.existing.push(index.name);
      } else {
        result.created.push(index.name);
      }
    }

  } catch (error: any) {
    result.errors.push(error.message);
    logger.error(`Failed to sync indexes for ${modelInfo.name}`, { error });
  }

  return result;
}

function formatIndexKey(key: Record<string, number>): string {
  return Object.entries(key)
    .map(([field, direction]) => `${field}:${direction}`)
    .join(', ');
}

async function main(): Promise<void> {
  try {
    await connectToDatabase();
    
    console.log('🔧 Creating MongoDB indexes...');
    console.log('=' .repeat(80));
    
    let totalCreated = 0;
    let totalExisting = 0;
    let totalErrors = 0;

    for (const modelInfo of models) {
      console.log(`\n📋 Processing ${modelInfo.name}...`);
      
      const result = await syncModelIndexes(modelInfo);
      
      if (result.created.length > 0) {
        console.log(`  ✅ Created ${result.created.length} new indexes:`);
        result.created.forEach(name => console.log(`    • ${name}`));
        totalCreated += result.created.length;
      }
      
      if (result.existing.length > 0) {
        console.log(`  ℹ️  ${result.existing.length} indexes already existed`);
        totalExisting += result.existing.length;
      }
      
      if (result.errors.length > 0) {
        console.log(`  ❌ ${result.errors.length} errors:`);
        result.errors.forEach(error => console.log(`    • ${error}`));
        totalErrors += result.errors.length;
      }
    }
    
    console.log('\n📊 Index Creation Summary');
    console.log('=' .repeat(80));
    console.log(`✅ Created: ${totalCreated} new indexes`);
    console.log(`ℹ️  Existing: ${totalExisting} indexes already present`);
    console.log(`❌ Errors: ${totalErrors} failed operations`);
    
    if (totalErrors === 0) {
      console.log('\n🎉 All indexes created successfully!');
    } else {
      console.log('\n⚠️  Some indexes failed to create. Check the logs above.');
    }
    
  } catch (error) {
    logger.error('Index creation failed', { error });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}