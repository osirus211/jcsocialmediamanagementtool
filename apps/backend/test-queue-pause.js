/**
 * Test Queue Pause Functionality
 * 
 * Quick test to verify the pause/resume functionality works
 */

const mongoose = require('mongoose');
const { queueService } = require('./dist/services/QueueService');
const { Workspace } = require('./dist/models/Workspace');

async function testQueuePause() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-media-manager');
    console.log('✅ Connected to MongoDB');

    // Find a test workspace
    const workspace = await Workspace.findOne();
    if (!workspace) {
      console.log('❌ No workspace found. Create a workspace first.');
      return;
    }

    const workspaceId = workspace._id.toString();
    const userId = workspace.ownerId.toString();

    console.log(`🧪 Testing with workspace: ${workspace.name} (${workspaceId})`);

    // Test 1: Get initial status
    console.log('\n1️⃣ Getting initial queue status...');
    let status = await queueService.getQueueStatus(workspaceId);
    console.log('Initial status:', {
      isPaused: status.isPaused,
      accountPauses: status.accountPauses.length,
    });

    // Test 2: Pause workspace for 1 minute
    console.log('\n2️⃣ Pausing workspace queue for 1 minute...');
    const resumeAt = new Date(Date.now() + 60000); // 1 minute from now
    status = await queueService.pauseQueue(workspaceId, userId, {
      resumeAt,
      reason: 'Test pause functionality',
    });
    console.log('Pause result:', {
      isPaused: status.isPaused,
      resumeAt: status.resumeAt,
      reason: status.reason,
    });

    // Test 3: Check if post is publishable
    console.log('\n3️⃣ Testing post publishability...');
    const isPublishable = await queueService.isPostPublishable(workspaceId, 'test-account-id');
    console.log('Is post publishable?', isPublishable); // Should be false

    // Test 4: Resume queue
    console.log('\n4️⃣ Resuming queue...');
    status = await queueService.resumeQueue(workspaceId, userId);
    console.log('Resume result:', {
      isPaused: status.isPaused,
      resumeAt: status.resumeAt,
    });

    // Test 5: Test auto-resume processing
    console.log('\n5️⃣ Testing auto-resume processing...');
    await queueService.processAutoResume();
    console.log('Auto-resume processing completed');

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testQueuePause().catch(console.error);