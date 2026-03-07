import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function fixSubscription() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Subscription = mongoose.model('Subscription', new mongoose.Schema({}, { strict: false }));
    const Usage = mongoose.model('Usage', new mongoose.Schema({}, { strict: false }));
    const Plan = mongoose.model('Plan', new mongoose.Schema({}, { strict: false }));

    const workspaceId = new mongoose.Types.ObjectId('6999a5e2500b5124e5a36706');
    const freePlan = await Plan.findOne({ name: 'free' });

    if (!freePlan) {
      console.log('✗ FREE plan not found');
      process.exit(1);
    }

    // Update subscription
    await Subscription.updateOne(
      { workspaceId },
      { $set: { plan: freePlan._id } }
    );
    console.log('✓ Subscription updated with FREE plan');

    // Create usage record
    const usage = await Usage.findOne({ workspaceId });
    if (!usage) {
      await Usage.create({
        workspaceId,
        plan: freePlan._id,
        postsThisMonth: 0,
        aiCreditsUsed: 0,
        period: {
          start: new Date(),
          end: new Date(new Date().setMonth(new Date().getMonth() + 1))
        }
      });
      console.log('✓ Usage record created');
    } else {
      console.log('✓ Usage record already exists');
    }

    await mongoose.disconnect();
    console.log('\n✅ Subscription and usage fixed');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixSubscription();
