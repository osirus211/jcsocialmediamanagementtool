import axios from 'axios';

async function triggerScheduler() {
  try {
    console.log('Triggering scheduler poll...');
    const response = await axios.post('http://127.0.0.1:5000/api/v1/admin/scheduler/poll', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('❌ Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

triggerScheduler();
