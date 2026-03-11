/**
 * MongoDB Index Verification Script
 * 
 * Connects to MongoDB and lists all indexes on all collections
 * Reports missing recommended indexes and outputs a summary table
 * 
 * Usage: npx ts-node apps/backend/src/scripts/verify-indexes.ts
 */

import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

// Import all models to ensure they're registered
import '../models/User';
import '../models/Workspace';
import '../models/WorkspaceMember';
import '../models/SocialAccount';
import '../models/Post';
import '../models/ScheduledPost';
import '../models/PostAnalytics';
import '../models/Media';
import '../models/FollowerHistory';
import '../models/Campaign';
import '../models/Category';
import '../models/ClientReview';
import '../models/PostComment';
import '../models/AccountPermission';
import '../models/Notification';
import '../models/WorkspaceActivityLog';

interface IndexInfo {
  collection: string;
  name: string;
  key: Record<string, number>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
}

async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.database.uri);
    logger.info('Connected to MongoDB for index verification');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

async function getAllIndexes(): Promise<IndexInfo[]> {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const allIndexes: IndexInfo[] = [];

  for (const collection of collections) {
    const collectionName = collection.name;
    
    try {
      const indexes = await db.collection(collectionName).indexes();
      
      for (const index of indexes) {
        allIndexes.push({
          collection: collectionName,
          name: index.name,
          key: index.key,
          unique: index.unique,
          sparse: index.sparse,
          expireAfterSeconds: index.expireAfterSeconds,
        });
      }
    } catch (error) {
      logger.warn(`Failed to get indexes for collection ${collectionName}`, { error });
    }
  }

  return allIndexes;
}

function formatIndexKey(key: Record<string, number>): string {
  return Object.entries(key)
    .map(([field, direction]) => `${field}:${direction}`)
    .join(', ');
}

function printIndexSummary(indexes: IndexInfo[]): void {
  console.log('\n📊 MongoDB Index Summary');
  console.log('=' .repeat(80));
  
  const groupedByCollection = indexes.reduce((acc, index) => {
    if (!acc[index.collection]) {
      acc[index.collection] = [];
    }
    acc[index.collection].push(index);
    return acc;
  }, {} as Record<string, IndexInfo[]>);

  for (const [collection, collectionIndexes] of Object.entries(groupedByCollection)) {
    console.log(`\n🗂️  Collection: ${collection}`);
    console.log('-'.repeat(60));
    
    for (const index of collectionIndexes) {
      const keyStr = formatIndexKey(index.key);
      const flags = [];
      
      if (index.unique) flags.push('UNIQUE');
      if (index.sparse) flags.push('SPARSE');
      if (index.expireAfterSeconds) flags.push(`TTL:${index.expireAfterSeconds}s`);
      
      const flagsStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      console.log(`  • ${index.name}: ${keyStr}${flagsStr}`);
    }
  }
}

function checkRecommendedIndexes(indexes: IndexInfo[]): void {
  console.log('\n🔍 Recommended Index Analysis');
  console.log('=' .repeat(80));
  
  const recommendedIndexes = [
    { collection: 'posts', key: 'workspaceId:1, status:1' },
    { collection: 'posts', key: 'workspaceId:1, scheduledAt:1' },
    { collection: 'posts', key: 'status:1, scheduledAt:1' },
    { collection: 'media', key: 'workspaceId:1, createdAt:-1' },
    { collection: 'media', key: 'workspaceId:1, mediaType:1' },
    { collection: 'followerhistories', key: 'workspaceId:1, platform:1, recordedAt:-1' },
    { collection: 'postanalytics', key: 'workspaceId:1, platform:1, collectedAt:-1' },
    { collection: 'campaigns', key: 'workspaceId:1, status:1, createdAt:-1' },
    { collection: 'clientreviews', key: 'workspaceId:1, status:1, createdAt:-1' },
    { collection: 'postcomments', key: 'postId:1, isResolved:1' },
  ];

  const existingIndexKeys = new Set(
    indexes.map(idx => `${idx.collection}:${formatIndexKey(idx.key)}`)
  );

  let missingCount = 0;
  
  for (const recommended of recommendedIndexes) {
    const key = `${recommended.collection}:${recommended.key}`;
    
    if (!existingIndexKeys.has(key)) {
      console.log(`❌ Missing: ${recommended.collection} -> ${recommended.key}`);
      missingCount++;
    } else {
      console.log(`✅ Found: ${recommended.collection} -> ${recommended.key}`);
    }
  }
  
  console.log(`\n📈 Index Status: ${recommendedIndexes.length - missingCount}/${recommendedIndexes.length} recommended indexes found`);
  
  if (missingCount > 0) {
    console.log(`\n⚠️  ${missingCount} recommended indexes are missing. Run 'npm run db:indexes' to create them.`);
  } else {
    console.log('\n🎉 All recommended indexes are present!');
  }
}

async function main(): Promise<void> {
  try {
    await connectToDatabase();
    
    console.log('🔍 Scanning MongoDB indexes...');
    const indexes = await getAllIndexes();
    
    printIndexSummary(indexes);
    checkRecommendedIndexes(indexes);
    
    console.log(`\n📊 Total indexes found: ${indexes.length}`);
    console.log('✅ Index verification complete');
    
  } catch (error) {
    logger.error('Index verification failed', { error });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}