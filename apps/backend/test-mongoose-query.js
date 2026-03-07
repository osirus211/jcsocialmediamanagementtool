import mongoose from 'mongoose';

// Connect to MongoDB
await mongoose.connect('mongodb://127.0.0.1:27017/social-media-tool');

// Define a simple schema
const PostSchema = new mongoose.Schema({}, { strict: false, collection: 'posts' });
const Post = mongoose.model('TestPost', PostSchema);

const now = new Date();
console.log('Current time:', now);

// Run the same query as the scheduler
const posts = await Post.find({
  status: 'scheduled',
  scheduledAt: { $lte: now },
})
  .limit(100)
  .sort({ scheduledAt: 1 });

console.log(`\nFound ${posts.length} posts`);

// Check recovery test posts specifically
const recoveryPosts = await Post.find({
  status: 'scheduled',
  scheduledAt: { $lte: now },
  'metadata.testType': 'recovery_test'
})
  .limit(100)
  .sort({ scheduledAt: 1 });

console.log(`Found ${recoveryPosts.length} recovery test posts`);

if (recoveryPosts.length > 0) {
  console.log('\nFirst recovery post:');
  console.log('  Status:', recoveryPosts[0].status);
  console.log('  ScheduledAt:', recoveryPosts[0].scheduledAt);
  console.log('  SocialAccountId populated?', !!recoveryPosts[0].socialAccountId);
}

await mongoose.disconnect();
