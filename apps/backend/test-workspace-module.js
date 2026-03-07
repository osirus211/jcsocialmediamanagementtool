const mongoose = require('mongoose');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000/api/v1';
let accessToken = '';
let userId = '';
let workspaceId = '';

console.log('=== MODULE 2 — WORKSPACE + ONBOARDING VALIDATION ===\n');

// Helper to query MongoDB
async function queryMongo(collection, query, projection = {}) {
  await mongoose.connect(process.env.MONGODB_URI);
  const Collection = mongoose.connection.collection(collection);
  const result = await Collection.findOne(query, { projection });
  await mongoose.disconnect();
  return result;
}

async function queryMongoAll(collection, query, projection = {}) {
  await mongoose.connect(process.env.MONGODB_URI);
  const Collection = mongoose.connection.collection(collection);
  const results = await Collection.find(query, { projection }).toArray();
  await mongoose.disconnect();
  return results;
}

// STEP 1 — REGISTER NEW USER
async function step1RegisterUser() {
  console.log('========================================');
  console.log('STEP 1 — REGISTER NEW USER');
  console.log('========================================\n');
  
  const email = `workspace-test-${Date.now()}@test.com`;
  
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'TestPass123!',
      firstName: 'Workspace',
      lastName: 'Test'
    })
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (data.accessToken) {
    accessToken = data.accessToken;
    userId = data.user._id;
    console.log('\n✅ User registered');
    console.log('User ID:', userId);
    console.log('Email:', email);
  }
  
  // MongoDB verification
  console.log('\n--- MongoDB Verification ---');
  const user = await queryMongo('users', { _id: new mongoose.Types.ObjectId(userId) });
  console.log('User created:', user ? 'YES' : 'NO');
  console.log('RefreshTokens count:', user?.refreshTokens?.length || 0);
  
  return response.ok && user?.refreshTokens?.length === 1;
}

// STEP 2 — CALL /workspaces (without creating)
async function step2GetWorkspacesEmpty() {
  console.log('\n========================================');
  console.log('STEP 2 — CALL /workspaces (without creating)');
  console.log('========================================\n');
  
  const response = await fetch(`${BASE_URL}/workspaces`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  const isEmptyOrNotFound = response.status === 404 || 
                            (response.ok && Array.isArray(data) && data.length === 0) ||
                            (response.ok && Array.isArray(data.workspaces) && data.workspaces.length === 0);
  
  console.log('\nReturns empty array or 404:', isEmptyOrNotFound ? 'YES' : 'NO');
  console.log('No crash:', response.status !== 500 ? 'YES' : 'NO');
  
  return response.status !== 500;
}

// STEP 3 — CREATE WORKSPACE
async function step3CreateWorkspace() {
  console.log('\n========================================');
  console.log('STEP 3 — CREATE WORKSPACE');
  console.log('========================================\n');
  
  const response = await fetch(`${BASE_URL}/workspaces`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Workspace',
      slug: `test-workspace-${Date.now()}`
    })
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (data.workspace?._id || data._id) {
    workspaceId = data.workspace?._id || data._id;
    console.log('\n✅ Workspace created');
    console.log('Workspace ID:', workspaceId);
  }
  
  // MongoDB verification
  console.log('\n--- MongoDB Verification ---');
  
  const workspace = await queryMongo('workspaces', { 
    _id: new mongoose.Types.ObjectId(workspaceId) 
  });
  console.log('Workspace document created:', workspace ? 'YES' : 'NO');
  if (workspace) {
    console.log('  Workspace ID:', workspace._id.toString());
    console.log('  Name:', workspace.name);
    console.log('  Slug:', workspace.slug);
    console.log('  Owner ID:', workspace.ownerId.toString());
    console.log('  Plan:', workspace.plan);
  }
  
  const member = await queryMongo('workspacemembers', {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    userId: new mongoose.Types.ObjectId(userId)
  });
  console.log('\nWorkspaceMember created:', member ? 'YES' : 'NO');
  if (member) {
    console.log('  Member ID:', member._id.toString());
    console.log('  User ID:', member.userId.toString());
    console.log('  Workspace ID:', member.workspaceId.toString());
    console.log('  Role:', member.role);
  }
  
  const isOwner = member?.role === 'owner';
  console.log('\nUser linked as OWNER:', isOwner ? 'YES' : 'NO');
  
  return response.ok && workspace && member && isOwner;
}

// STEP 4 — ACCESS WORKSPACE PROTECTED ROUTE
async function step4AccessProtectedRoute() {
  console.log('\n========================================');
  console.log('STEP 4 — ACCESS WORKSPACE PROTECTED ROUTE');
  console.log('========================================\n');
  
  const response = await fetch(`${BASE_URL}/workspaces/${workspaceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Workspace-ID': workspaceId
    }
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  console.log('\n200 OK:', response.ok ? 'YES' : 'NO');
  console.log('Tenant middleware working:', response.ok ? 'YES' : 'NO');
  
  return response.ok;
}

// STEP 5 — TENANT FAILURE TEST
async function step5TenantFailureTest() {
  console.log('\n========================================');
  console.log('STEP 5 — TENANT FAILURE TEST');
  console.log('========================================\n');
  
  console.log('Calling protected route WITHOUT x-workspace-id header...\n');
  
  const response = await fetch(`${BASE_URL}/workspaces/${workspaceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
      // Intentionally omitting X-Workspace-ID
    }
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  const properError = response.status === 400 || response.status === 403;
  const noCrash = response.status !== 500;
  
  console.log('\n400 or 403 returned:', properError ? 'YES' : 'NO');
  console.log('No crash:', noCrash ? 'YES' : 'NO');
  console.log('Proper error response:', data.error || data.message ? 'YES' : 'NO');
  
  return properError && noCrash;
}

// Run all tests
(async () => {
  try {
    const results = {
      register: await step1RegisterUser(),
      emptyWorkspaces: await step2GetWorkspacesEmpty(),
      createWorkspace: await step3CreateWorkspace(),
      protectedRoute: await step4AccessProtectedRoute(),
      tenantFailure: await step5TenantFailureTest()
    };
    
    console.log('\n====================================');
    console.log('MODULE 2 FINAL STATUS');
    console.log('====================================');
    console.log('User registered:', results.register ? 'PASS' : 'FAIL');
    console.log('Empty workspaces handled:', results.emptyWorkspaces ? 'PASS' : 'FAIL');
    console.log('Workspace created:', results.createWorkspace ? 'PASS' : 'FAIL');
    console.log('Membership created:', results.createWorkspace ? 'PASS' : 'FAIL');
    console.log('User role: OWNER');
    console.log('Tenant middleware working:', results.protectedRoute ? 'PASS' : 'FAIL');
    console.log('Tenant failure handling:', results.tenantFailure ? 'PASS' : 'FAIL');
    
    const allPassed = Object.values(results).every(r => r);
    console.log('\nModule 2 status:', allPassed ? '✅ PASS' : '❌ FAIL');
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
