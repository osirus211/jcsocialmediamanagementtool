import axios from 'axios';

async function runLoadTest() {
  const email = 'billing-test-1771698236603@example.com';
  const password = 'TestPassword123!';
  let token, workspaceId, socialAccountId;
  
  // Step 1: Login
  try {
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email,
      password
    });
    token = loginRes.data.accessToken;
    console.log('✅ Logged in successfully');
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
  
  // Step 2: Get workspace
  try {
    const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    workspaceId = workspacesRes.data.workspaces[0]._id;
    console.log(`✅ Workspace ID: ${workspaceId}`);
  } catch (error) {
    console.error('❌ Failed to get workspace:', error.message);
    process.exit(1);
  }
  
  // Step 3: Get social account
  try {
    const accountsRes = await axios.get('http://127.0.0.1:5000/api/v1/social/accounts', {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    socialAccountId = accountsRes.data.accounts[0]._id;
    console.log(`✅ Social Account ID: ${socialAccountId}`);
  } catch (error) {
    console.error('❌ Failed to get social account:', error.message);
    process.exit(1);
  }
  
  // Step 4: Create 300 posts
  try {
    console.log('\n🚀 Creating 300 scheduled posts for load test...');
    console.log('⏱️  Posts will be scheduled to publish in 10 seconds');
    
    const promises = [];
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const scheduledAt = new Date(Date.now() + 10000); // 10 seconds from now
    
    for (let i = 0; i < 300; i++) {
      promises.push(
        axios.post('http://127.0.0.1:5000/api/v1/posts', {
          socialAccountId,
          content: `Load test post ${i + 1} - Testing queue backpressure`,
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
          if (errors.length < 5) {
            errors.push(err.response?.data?.message || err.message);
          }
        })
      );
      
      // Batch requests
      if (i % 50 === 49) {
        await Promise.all(promises.splice(0, 50));
        console.log(`📝 Progress: ${i + 1}/300 (✅ ${successCount}, ❌ ${errorCount})`);
      }
    }
    
    await Promise.all(promises);
    
    console.log(`\n✅ Load test posts created!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Sample errors:`);
      errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
    
    console.log('\n📊 MONITORING INSTRUCTIONS:');
    console.log('   1. Check queue depth:');
    console.log('      redis-cli -h 127.0.0.1 -p 6379 LLEN bull:publish:wait');
    console.log('   2. Check active jobs:');
    console.log('      redis-cli -h 127.0.0.1 -p 6379 LLEN bull:publish:active');
    console.log('   3. Check metrics:');
    console.log('      curl -s http://127.0.0.1:5000/metrics | grep queue');
    console.log('   4. Check backend logs for backpressure triggers');
    console.log('\n⏳ Jobs will start processing in ~10 seconds...');
    
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

runLoadTest();
