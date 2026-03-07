const axios = require('axios');

async function createCrashTestPost() {
  const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
    email: 'test-composer@example.com',
    password: 'TestPassword123!'
  });
  
  const token = loginRes.data.accessToken;
  
  const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const workspaceId = workspacesRes.data.workspaces[0]._id;
  
  const accountsRes = await axios.get('http://127.0.0.1:5000/api/v1/social/accounts', {
    headers: { 
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId
    }
  });
  
  const socialAccountId = accountsRes.data.accounts[0]._id;
  
  const postRes = await axios.post('http://127.0.0.1:5000/api/v1/posts', {
    socialAccountId,
    content: 'Worker crash test post',
    scheduledAt: new Date(Date.now() + 5000)
  }, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId
    }
  });
  
  console.log('✅ Crash test post created:', postRes.data.post._id);
  console.log('⏳ Will be processed in 5 seconds');
  console.log('🔴 RESTART BACKEND NOW to simulate worker crash');
}

createCrashTestPost().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
