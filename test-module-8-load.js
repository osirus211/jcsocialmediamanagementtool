import axios from 'axios';

async function createLoadTest() {
  try {
    console.log('🔐 Logging in...');
    // Login and get workspace
    const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email: 'test-composer@example.com',
      password: 'TestPassword123!'
    });
    
    const token = loginRes.data.accessToken;
    console.log('✅ Logged in successfully');
    
    // Get workspace and social account
    console.log('📦 Fetching workspace...');
    const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const workspaceId = workspacesRes.data.workspaces[0]._id;
    console.log(`✅ Workspace ID: ${workspaceId}`);
    
    console.log('🔗 Fetching social accounts...');
    const accountsRes = await axios.get('http://127.0.0.1:5000/api/v1/social/accounts', {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    
    const socialAccountId = accountsRes.data.accounts[0]._id;
    console.log(`✅ Social Account ID: ${socialAccountId}`);
    
    // Create 300 posts scheduled for immediate execution
    console.log('\n🚀 Creating 300 scheduled posts...');
    const promises = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < 300; i++) {
      const scheduledAt = new Date(Date.now() + 5000); // 5 seconds from now
      
      promises.push(
        axios.post('http://127.0.0.1:5000/api/v1/posts', {
          socialAccountId,
          content: `Load test post ${i + 1}`,
          scheduledAt
        }, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'x-workspace-id': workspaceId
          }
        })
        .then(() => { successCount++; })
        .catch(err => { 
          errorCount++;
          return {error: err.message};
        })
      );
      
      // Batch requests to avoid overwhelming the API
      if (i % 50 === 49) {
        await Promise.all(promises.splice(0, 50));
        console.log(`📝 Created ${i + 1} posts (Success: ${successCount}, Errors: ${errorCount})...`);
      }
    }
    
    await Promise.all(promises);
    console.log(`\n✅ All 300 posts created!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('\n⏳ Posts will be scheduled in ~5 seconds...');
    console.log('📊 Monitor queue depth with: redis-cli -h 127.0.0.1 -p 6379 LLEN bull:publish:wait');
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

createLoadTest();
