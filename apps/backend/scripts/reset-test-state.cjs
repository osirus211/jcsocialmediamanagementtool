const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function cleanup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    const deleteResult = await postsCollection.deleteMany({
      status: { $in: ['scheduled', 'queued', 'failed'] }
    });
    console.log('🗑️  Deleted', deleteResult.deletedCount, 'non-published posts');
    
    const updateResult = await postsCollection.updateMany(
      { lock: { $exists: true } },
      { $unset: { lock: '' } }
    );
    console.log('🔓 Removed locks from', updateResult.modifiedCount, 'posts');
    
    const remaining = await postsCollection.countDocuments({
      status: { $in: ['scheduled', 'queued', 'failed'] }
    });
    console.log('📊 Remaining non-published posts:', remaining);
    
    await mongoose.connection.close();
    console.log('✅ Cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanup();
