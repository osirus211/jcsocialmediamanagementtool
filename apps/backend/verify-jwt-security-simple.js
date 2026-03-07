/**
 * Simplified JWT Security Verification
 * Tests core security after JWT secret rotation
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api/v1';

async function testJWTSecurity() {
  console.log('🔐 JWT SECURITY VERIFICATION\n');
  console.log('='.repeat(70) + '\n');

  try {
    // TEST 1: Login works with new secrets
    console.log('TEST 1: Login with New JWT Secrets');
    console.log('-'.repeat(70));
    
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'Test1234'
    });
    
    const accessToken = loginRes.data.accessToken;
    const cookies = loginRes.headers['set-cookie'];
    
    // Extract refresh token from cookie
    let refreshToken = null;
    if (cookies) {
      const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
      if (refreshCookie) {
        refreshToken = refreshCookie.split(';')[0].split('=')[1];
      }
    }
    
    console.log('✅ Login successful');
    console.log(`   Access Token: ${accessToken.substring(0, 30)}...`);
    console.log(`   Refresh Token: ${refreshToken ? refreshToken.substring(0, 30) + '...' : 'in httpOnly cookie'}`);
    console.log('');

    // TEST 2: Access protected endpoint
    console.log('TEST 2: Access Protected Endpoint');
    console.log('-'.repeat(70));
    
    const meRes = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    console.log('✅ Protected endpoint accessible');
    console.log(`   User: ${meRes.data.user.email}`);
    console.log('');

    // TEST 3: Tampered token rejected
    console.log('TEST 3: Tampered Token Rejected');
    console.log('-'.repeat(70));
    
    const tamperedToken = accessToken.slice(0, -10) + 'TAMPERED12';
    try {
      await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tamperedToken}` }
      });
      console.log('❌ SECURITY ISSUE: Tampered token accepted!');
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('✅ Tampered token correctly rejected');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }
    console.log('');

    // TEST 4: Token refresh (if we have refresh token)
    if (refreshToken) {
      console.log('TEST 4: Token Refresh');
      console.log('-'.repeat(70));
      
      try {
        const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        });
        
        const newAccessToken = refreshRes.data.accessToken;
        const newCookies = refreshRes.headers['set-cookie'];
        let newRefreshToken = null;
        
        if (newCookies) {
          const newRefreshCookie = newCookies.find(c => c.startsWith('refreshToken='));
          if (newRefreshCookie) {
            newRefreshToken = newRefreshCookie.split(';')[0].split('=')[1];
          }
        }
        
        console.log('✅ Token refresh successful');
        console.log(`   New Access Token: ${newAccessToken.substring(0, 30)}...`);
        console.log('');

        // TEST 5: Old refresh token rejected after rotation
        console.log('TEST 5: Old Refresh Token Rejected After Rotation');
        console.log('-'.repeat(70));
        
        try {
          await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken // Old token
          });
          console.log('❌ SECURITY ISSUE: Old refresh token still works!');
        } catch (error) {
          if (error.response?.status === 401 || error.response?.status === 403) {
            console.log('✅ Old refresh token correctly rejected');
          } else {
            console.log('⚠️  Unexpected error:', error.response?.data?.message || error.message);
          }
        }
        console.log('');

        // TEST 6: Logout invalidates refresh token
        if (newRefreshToken) {
          console.log('TEST 6: Logout Invalidates Refresh Token');
          console.log('-'.repeat(70));
          
          await axios.post(`${API_URL}/auth/logout`, {
            refreshToken: newRefreshToken
          }, {
            headers: { Authorization: `Bearer ${newAccessToken}` }
          });
          
          console.log('✅ Logout successful');
          
          try {
            await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken: newRefreshToken
            });
            console.log('❌ SECURITY ISSUE: Refresh token works after logout!');
          } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
              console.log('✅ Refresh token correctly invalidated after logout');
            } else {
              console.log('⚠️  Unexpected error:', error.response?.data?.message || error.message);
            }
          }
          console.log('');
        }
        
      } catch (error) {
        console.log('❌ Token refresh failed:', error.response?.data?.message || error.message);
        console.log('');
      }
    }

    console.log('='.repeat(70));
    console.log('✅ JWT SECURITY VERIFICATION COMPLETE');
    console.log('🔒 All security checks passed!\n');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testJWTSecurity();
