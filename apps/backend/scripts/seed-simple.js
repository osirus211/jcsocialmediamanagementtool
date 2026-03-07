const { Plan } = require('../dist/models/Plan');
const { connectDatabase } = require('../dist/config/database');

async function seedFreePlan() {
  try {
    console.log('🌱 Seeding FREE plan...');
    
    await connectDatabase();
    console.log('✅ Database connected');

    const existing = await Plan.findOne({ name: 'free' });
    
    if (existing) {
      console.log('✅ FREE plan already exists - skipping');
      console.log(`   Plan ID: ${existing._id}`);
      console.log(`   Posts/Month: ${existing.limits.maxPostsPerMonth}`);
      console.log(`   AI Credits: ${existing.limits.aiCreditsPerMonth}`);
      return;
    }

    const plan = new Plan({
      name: 'free',
      displayName: 'Free',
      description: 'Perfect for getting started',
      priceMonthly: 0,
      priceYearly: 0,
      limits: {
        maxSocialAccounts: 3,
        maxPostsPerMonth: 50,
        maxTeamMembers: 1,
        aiCreditsPerMonth: 20
      },
      features: [
        '3 social accounts',
        '50 posts per month', 
        'Basic analytics',
        '20 AI credits per month'
      ],
      isActive: true
    });

    await plan.save();
    console.log('✅ FREE plan created!');
    console.log(`   Plan ID: ${plan._id}`);
    console.log(`   Posts/Month: ${plan.limits.maxPostsPerMonth}`);
    console.log(`   AI Credits: ${plan.limits.aiCreditsPerMonth}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedFreePlan();