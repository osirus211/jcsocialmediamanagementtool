import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function createBilling() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Billing = mongoose.model('Billing', new mongoose.Schema({}, { strict: false }));
    const Plan = mongoose.model('Plan', new mongoose.Schema({}, { strict: false }));
    
    const workspaceId = new mongoose.Types.ObjectId('6999a5e2500b5124e5a36706');
    const freePlan = await Plan.findOne({ name: 'free' });

    if (!freePlan) {
      console.log('✗ FREE plan not found');
      process.exit(1);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await Billing.create({
      workspaceId,
      plan: freePlan._id,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      limits: freePlan.limits
    });

    console.log('✓ Billing record created');
    console.log('  Plan:', freePlan.name);
    console.log('  Period Start:', now);
    console.log('  Period End:', periodEnd);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createBilling();
