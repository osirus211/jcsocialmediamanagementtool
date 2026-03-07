import axios from 'axios';
import { MongoClient } from 'mongodb';

async function createBillingDirectly() {
  let token, workspaceId, planId;
  
  // Step 1: Login and get workspace
  try {
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email: 'test-composer@example.com',
      password: 'TestPassword123!'
    });
    token = loginRes.data.accessToken;
    
    const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    });
    workspaceId = workspacesRes.data.workspaces[0]._id;
    console.log(`✅ Workspace ID: ${workspaceId}`);
    
    // Get free plan
    const plansRes = await axios.get('http://127.0.0.1:5000/api/v1/billing/plans', {
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceId
      }
    });
    
    const freePlan = plansRes.data.plans.find(p => p.name === 'free');
    if (!freePlan) {
      console.error('❌ Free plan not found');
      process.exit(1);
    }
    planId = freePlan._id;
    console.log(`✅ Free Plan ID: ${planId}`);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
  
  // Step 2: Connect to MongoDB and create billing
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('social-media-tool');
    const billings = db.collection('billings');
    
    // Check if billing exists
    const existing = await billings.findOne({ workspaceId });
    if (existing) {
      console.log('✅ Billing already exists');
      return;
    }
    
    // Create billing
    const billing = {
      workspaceId,
      planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      usage: {
        postsThisMonth: 0,
        aiCreditsUsed: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await billings.insertOne(billing);
    console.log('✅ Billing created successfully!');
    
  } catch (error) {
    console.error('❌ MongoDB operation failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createBillingDirectly();
