import axios from 'axios';

async function setupTestUser() {
  let token;
  
  try {
    console.log('📝 Registering test user...');
    const registerRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/register', {
      email: 'test-composer@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Composer'
    });
    
    console.log('✅ User registered successfully');
    token = registerRes.data.accessToken;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('ℹ️  User already exists, logging in...');
      const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
        email: 'test-composer@example.com',
        password: 'TestPassword123!'
      });
      token = loginRes.data.accessToken;
      console.log('✅ Logged in successfully');
    } else {
      console.error('❌ Registration failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      process.exit(1);
    }
  }
  
  try {
    // Create a workspace
    console.log('📦 Creating workspace...');
    const workspaceRes = await axios.post('http://127.0.0.1:5000/api/v1/workspaces', {
      name: 'Test Workspace',
      slug: 'test-workspace'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const workspaceId = workspaceRes.data.workspace._id;
    console.log(`✅ Workspace created: ${workspaceId}`);
    
    // Create a mock social account
    console.log('🔗 Creating social account...');
    const socialAccountRes = await axios.post('http://127.0.0.1:5000/api/v1/social/accounts', {
      platform: 'twitter',
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
    
    console.log('✅ Social account created');
    console.log('\n✅ Setup complete! Ready for load test.');
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('ℹ️  Resources already exist - ready for load test');
    } else {
      console.error('❌ Setup failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
  }
}

setupTestUser();
