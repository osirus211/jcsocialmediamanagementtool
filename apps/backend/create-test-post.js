import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function createTestPost() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Post = mongoose.model('Post', new mongoose.Schema({}, { strict: false }));
    
    const workspaceId = new mongoose.Types.ObjectId('6999a5e2500b5124e5a36706');
    const userId = new mongoose.Types.ObjectId('6999a4a6500b5124e5a366d1');

    const post = await Post.create({
      workspaceId,
      userId,
      content: 'Test post for production validation - PUBLISH NOW',
      platforms: ['twitter'],
      status: 'pending',
      publishType: 'now',
      scheduledFor: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✓ Test post created');
    console.log('  Post ID:', post._id.toString());
    console.log('  Status:', post.status);
    console.log('  Publish Type:', post.publishType);
    console.log('\nNow you can test publishing this post');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createTestPost();
