/**
 * Force scheduler to run by calling it directly
 */

const axios = require('axios');

async function forceRun() {
  try {
    // Try to hit an admin endpoint if it exists
    const response = await axios.post('http://127.0.0.1:5000/api/admin/scheduler/force-poll', {}, {
      headers: {
        'Authorization': 'Bearer test', // We'll need proper auth
      }
    });
    
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('❌ No admin endpoint found');
      console.log('   The scheduler should be running automatically');
      console.log('   Check the server logs for scheduler activity');
    } else {
      console.error('Error:', error.response?.data || error.message);
    }
  }
}

forceRun();
