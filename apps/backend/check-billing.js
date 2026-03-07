import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function checkBilling() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Billing = mongoose.model('Billing', new mongoose.Schema({}, { strict: false }));
    const workspaceId = '6999a5e2500b5124e5a36706';

    const billing = await Billing.findOne({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });
    
    if (billing) {
      console.log('✓ Billing exists');
      console.log('  Plan:', billing.plan);
      console.log('  Status:', billing.status);
      console.log('  Current Period Start:', billing.currentPeriodStart);
      console.log('  Current Period End:', billing.currentPeriodEnd);
    } else {
      console.log('✗ Billing not found');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkBilling();
