/**
 * Test script for Module 21 - Pending Invites Management endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';
const WORKSPACE_ID = 'your-workspace-id'; // Replace with actual workspace ID
const TOKEN = 'your-auth-token'; // Replace with actual auth token

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testInvitationEndpoints() {
  console.log('🧪 Testing Module 21 - Pending Invites Management endpoints...\n');

  try {
    // Test 1: Get invitation stats
    console.log('1. Testing GET /workspaces/:id/invitations/stats');
    try {
      const statsResponse = await api.get(`/workspaces/${WORKSPACE_ID}/invitations/stats`);
      console.log('✅ Stats endpoint working:', statsResponse.data.stats);
    } catch (error) {
      console.log('❌ Stats endpoint error:', error.response?.data?.error || error.message);
    }

    // Test 2: Get invitations with filters
    console.log('\n2. Testing GET /workspaces/:id/invitations with filters');
    try {
      const invitesResponse = await api.get(`/workspaces/${WORKSPACE_ID}/invitations`, {
        params: {
          status: 'pending',
          role: 'member',
          search: 'test',
          page: 1,
          limit: 10,
        },
      });
      console.log('✅ Filtered invitations endpoint working:', invitesResponse.data.invitations.length, 'invitations found');
    } catch (error) {
      console.log('❌ Filtered invitations endpoint error:', error.response?.data?.error || error.message);
    }

    // Test 3: Bulk cancel invitations (with empty array to avoid actual cancellation)
    console.log('\n3. Testing DELETE /workspaces/:id/invitations/bulk');
    try {
      const bulkResponse = await api.delete(`/workspaces/${WORKSPACE_ID}/invitations/bulk`, {
        data: { tokens: [] }, // Empty array to test validation
      });
      console.log('❌ Should have failed with empty tokens array');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('Tokens array is required')) {
        console.log('✅ Bulk cancel validation working correctly');
      } else {
        console.log('❌ Unexpected bulk cancel error:', error.response?.data?.error || error.message);
      }
    }

    console.log('\n🎉 Module 21 endpoint tests completed!');
    console.log('\nTo test the frontend:');
    console.log('1. Navigate to /workspaces/{workspaceId}/invites');
    console.log('2. Verify stats display correctly');
    console.log('3. Test search and filtering');
    console.log('4. Test bulk selection and actions');
    console.log('5. Test individual resend/cancel actions');

  } catch (error) {
    console.error('❌ Test setup error:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('⚠️  Please update WORKSPACE_ID and TOKEN variables before running tests');
  console.log('⚠️  Make sure the backend server is running on localhost:3001');
  console.log('⚠️  Uncomment the line below to run tests:\n');
  // testInvitationEndpoints();
}

module.exports = { testInvitationEndpoints };