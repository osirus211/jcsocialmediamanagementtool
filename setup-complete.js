import axios from 'axios';

async function setupComplete() {
  let token, workspaceId;
  
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
    process.exit(1);
  }
  
  // Step 2: Get workspace
  try {
    console.log('📦 Fetching workspaces...');
    const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (workspacesRes.data.workspaces && workspacesRes.data.workspaces.length > 0) {
      workspaceId = workspacesRes.data.workspaces[0]._id;
      console.log(`✅ Using workspace: ${workspaceId}`);
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
    process.exit(1);
  }
  
  // Step 3: Setup billing with free plan
  try {
    console.log('💳 Setting up billing...');
    
    // First, get the free plan
    const plansRes = await axios.get('http://127.0.0.1:5000/api/v1/billing/plans', {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    
    const freePlan = plansRes.data.plans.find(p => p.name === 'free');
    if (!freePlan) {
      console.error('❌ Free plan not found. Run: node apps/backend/scripts/seed-simple.js');
      process.exit(1);
    }
    
    console.log(`✅ Found free plan: ${freePlan._id}`);
    
    // Check if billing already exists
    try {
      const billingRes = await axios.get('http://127.0.0.1:5000/api/v1/billing', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-workspace-id': workspaceId
        }
      });
      console.log('✅ Billing already exists');
    } catch (error) {
      if (error.response?.status === 404) {
        // Create billing - this might need to be done via database directly
        console.log('ℹ️  Billing not found - may need manual setup');
      }
    }
  } catch (error) {
    console.log('⚠️  Billing setup skipped:', error.message);
  }
  
  console.log('\n✅ Setup complete!');
  console.log('   Token:', token.substring(0, 20) + '...');
  console.log('   Workspace ID:', workspaceId);
}

setupComplete();
