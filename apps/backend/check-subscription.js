import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function checkSubscription() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Subscription = mongoose.model('Subscription', new mongoose.Schema({}, { strict: false }));
    const Usage = mongoose.model('Usage', new mongoose.Schema({}, { strict: false }));

    const workspaceId = '6999a5e2500b5124e5a36706';

    console.log('=== SUBSCRIPTION ===');
    const subscription = await Subscription.findOne({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });
    if (subscription) {
      console.log('✓ Subscription exists');
      console.log('  Plan:', subscription.plan);
      console.log('  Status:', subscription.status);
    } else {
      console.log('✗ Subscription not found');
    }

    console.log('\n=== USAGE ===');
    const usage = await Usage.findOne({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });
    if (usage) {
      console.log('✓ Usage exists');
      console.log('  Posts this month:', usage.postsThisMonth);
      console.log('  AI credits used:', usage.aiCreditsUsed);
    } else {
      console.log('✗ Usage not found');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSubscription();
