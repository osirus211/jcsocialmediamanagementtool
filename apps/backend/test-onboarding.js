const mongoose = require('mongoose');
const { User } = require('./src/models/User');
const { OnboardingService } = require('./src/services/OnboardingService');

async function testOnboarding() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler');
    console.log('✅ Connected to MongoDB');

    // Create a test user
    const testUser = new User({
      email: 'test-onboarding@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'TestPassword123',
      provider: 'local',
      onboardingCompleted: false,
      onboardingStep: 0,
    });

    await testUser.save();
    console.log('✅ Created test user:', testUser._id);

    // Test 1: Get initial progress
    const initialProgress = await OnboardingService.getProgress(testUser._id);
    console.log('✅ Initial progress:', initialProgress);

    // Test 2: Update step
    const updatedProgress = await OnboardingService.updateStep(testUser._id, 2);
    console.log('✅ Updated to step 2:', updatedProgress);

    // Test 3: Complete onboarding
    const completedProgress = await OnboardingService.completeOnboarding(testUser._id);
    console.log('✅ Completed onboarding:', completedProgress);

    // Test 4: Check if needs onboarding
    const needsOnboarding = await OnboardingService.needsOnboarding(testUser._id);
    console.log('✅ Needs onboarding:', needsOnboarding);

    // Cleanup
    await User.findByIdAndDelete(testUser._id);
    console.log('✅ Cleaned up test user');

    console.log('\n🎉 All onboarding tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

testOnboarding();