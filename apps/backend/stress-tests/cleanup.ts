import mongoose from 'mongoose';
import Redis from 'ioredis';

export async function cleanupStressTestData(): Promise<void> {
  console.log('🧹 Cleaning up stress test data...');
  
  try {
    // Connect to stress test database ONLY
    const STRESS_DB = 'jcsocial_stress_test';
    await mongoose.connect(`mongodb://localhost:27017/${STRESS_DB}`);
    console.log(`✅ Connected to database: ${STRESS_DB}`);

    const db = mongoose.connection.db;
    
    // Define collections to clean
    const collections = [
      'users',
      'workspaces', 
      'members',
      'posts',
      'activities',
      'notifications',
      'invitations'
    ];

    let totalDeleted = 0;

    // Delete all documents where name/email/slug starts with stress_test_
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        
        // Build query for stress_test_ prefixed documents
        const query = {
          $or: [
            { name: { $regex: /^stress_test_/ } },
            { email: { $regex: /^stress_test_/ } },
            { slug: { $regex: /^stress_test_/ } },
            { content: { $regex: /^stress_test_/ } }
          ]
        };

        const deleteResult = await collection.deleteMany(query);
        const deletedCount = deleteResult.deletedCount || 0;
        
        if (deletedCount > 0) {
          console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
          totalDeleted += deletedCount;
        }
      } catch (error) {
        console.error(`❌ Failed to clean ${collectionName}:`, error);
        console.log(`Manual cleanup command: db.${collectionName}.deleteMany({$or: [{name: /^stress_test_/}, {email: /^stress_test_/}, {slug: /^stress_test_/}, {content: /^stress_test_/}]})`);
      }
    }

    // Clean up Redis keys with stress_test: namespace
    try {
      const redis = new Redis({
        host: 'localhost',
        port: 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });

      const keys = await redis.keys('stress_test:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`✅ Deleted ${keys.length} Redis keys with stress_test: namespace`);
      }

      await redis.quit();
    } catch (error) {
      console.warn(`⚠️  Redis cleanup failed (Redis may not be running):`, error);
    }

    // Verify cleanup - count remaining stress_test documents
    let remainingDocs = 0;
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const query = {
          $or: [
            { name: { $regex: /^stress_test_/ } },
            { email: { $regex: /^stress_test_/ } },
            { slug: { $regex: /^stress_test_/ } },
            { content: { $regex: /^stress_test_/ } }
          ]
        };
        
        const count = await collection.countDocuments(query);
        remainingDocs += count;
      } catch (error) {
        console.error(`❌ Failed to verify cleanup for ${collectionName}:`, error);
      }
    }

    console.log(`🎉 Cleanup complete! Deleted ${totalDeleted} documents total.`);
    
    if (remainingDocs > 0) {
      console.warn(`⚠️  WARNING: ${remainingDocs} stress_test documents still remain!`);
      console.log('Manual cleanup commands:');
      for (const collectionName of collections) {
        console.log(`db.${collectionName}.deleteMany({$or: [{name: /^stress_test_/}, {email: /^stress_test_/}, {slug: /^stress_test_/}, {content: /^stress_test_/}]})`);
      }
    } else {
      console.log('✅ Verification passed: 0 stress_test documents remain');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}