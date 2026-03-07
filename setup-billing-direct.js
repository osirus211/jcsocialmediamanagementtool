import axios from 'axios';
import { MongoClient, ObjectId } from 'mongodb';

async function setupBillingDirect() {
  let workspaceId;
  
  // Step 1: Login and get workspace
  try {
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email: 'test-composer@example.com',
      password: 'TestPassword123!'
    });
    
    const workspacesRes = await axios.get('http://127.0.0.1:5000/api/v1/workspaces', {
      headers: { Authorization: `Bearer ${loginRes.data.accessToken}` }
    });
    workspaceId = workspacesRes.data.workspaces[0]._id;
    console.log(`✅ Workspace ID: ${workspaceId}`);
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }
  
  // Step 2: Connect to MongoDB
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('social-media-tool');
    
    // Get or create free plan
    const plansCollection = db.collection('plans');
    let freePlan = await plansCollection.findOne({ name: 'free' });
    
    if (!freePlan) {
      console.log('📝 Creating free plan...');
      const planDoc = {
        name: 'free',
        displayName: 'Free',
        description: 'Perfect for getting started',
        priceMonthly: 0,
        priceYearly: 0,
        limits: {
          maxSocialAccounts: 3,
          maxPostsPerMonth: 500, // Increased for load testing
          maxTeamMembers: 1,
          aiCreditsPerMonth: 100
        },
        features: [
          '3 social accounts',
          '500 posts per month',
          'Basic analytics',
          '100 AI credits per month'
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await plansCollection.insertOne(planDoc);
      freePlan = { ...planDoc, _id: result.insertedId };
      console.log(`✅ Free plan created: ${freePlan._id}`);
    } else {
      console.log(`✅ Free plan exists: ${freePlan._id}`);
    }
    
    // Create or update billing
    const billingsCollection = db.collection('billings');
    const existing = await billingsCollection.findOne({ workspaceId: new ObjectId(workspaceId) });
    
    if (existing) {
      console.log('✅ Billing already exists');
    } else {
      console.log('📝 Creating billing...');
      const billingDoc = {
        workspaceId: new ObjectId(workspaceId),
        planId: freePlan._id,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usage: {
          postsThisMonth: 0,
          aiCreditsUsed: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await billingsCollection.insertOne(billingDoc);
      console.log('✅ Billing created successfully!');
    }
    
    console.log('\n✅ Setup complete! Ready for load test.');
    
  } catch (error) {
    console.error('❌ MongoDB operation failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupBillingDirect();
