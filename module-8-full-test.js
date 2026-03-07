import axios from 'axios';

async function runFullTest() {
  let token, workspaceId, socialAccountId;
  
  // Step 1: Login
  try {
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email: 'test-composer@example.com',
      password: 'TestPassword123!'
    });
    token = loginRes.data.accessToken;
    console.log('✅ Logged in successfully');
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    console.log('\nℹ️  Please wait 60 seconds for rate limit to reset, then run:');
    console.log('   node setup-test-user.js');
    process.exit(1);
  }
  
  // Step 2: Get or create workspace
  try {
    console.log('📦 Fetching workspaces...');
    const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (workspacesRes.data.workspaces && workspacesRes.data.workspaces.length > 0) {
      workspaceId = workspacesRes.data.workspaces[0]._id;
      console.log(`✅ Using existing workspace: ${workspaceId}`);
    } else {
      console.log('📦 Creating workspace...');
      const createRes = await axios.post('http://127.0.0.1:5000/api/v1/workspaces', {
        name: 'Test Workspace',
        slug: 'test-workspace-' + Date.now()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      workspaceId = createRes.data.workspace._id;
      console.log(`✅ Workspace created: ${workspaceId}`);
    }
  } catch (error) {
    console.error('❌ Workspace setup failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
  
  // Step 3: Get or create social account
  try {
    console.log('🔗 Fetching social accounts...');
    const accountsRes = await axios.get('http://127.0.0.1:5000/api/v1/social/accounts', {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    
    if (accountsRes.data.accounts && accountsRes.data.accounts.length > 0) {
      socialAccountId = accountsRes.data.accounts[0]._id;
      console.log(`✅ Using existing social account: ${socialAccountId}`);
    } else {
      console.log('🔗 Creating social account via connect...');
      const createRes = await axios.post('http://127.0.0.1:5000/api/v1/social/connect/twitter', {
        accountName: 'TestAccount',
        accountId: 'test123',
        accessToken: 'mock_token',
        refreshToken: 'mock_refresh'
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-workspace-id': workspaceId
        }
      });
      socialAccountId = createRes.data.account._id;
      console.log(`✅ Social account created: ${socialAccountId}`);
    }
  } catch (error) {
    console.error('❌ Social account setup failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
  
  // Step 4: Create load (300 posts)
  try {
    console.log('\n🚀 Creating 300 scheduled posts...');
    const promises = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < 300; i++) {
      const scheduledAt = new Date(Date.now() + 10000); // 10 seconds from now
      
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
    console.log('\n⏳ Posts will be scheduled in ~10 seconds...');
    console.log('\n📊 Monitor with these commands:');
    console.log('   redis-cli -h 127.0.0.1 -p 6379 LLEN bull:publish:wait');
    console.log('   redis-cli -h 127.0.0.1 -p 6379 LLEN bull:publish:active');
    console.log('   curl http://127.0.0.1:5000/metrics | grep queue');
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

runFullTest();
