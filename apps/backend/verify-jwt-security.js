/**
 * JWT Security Verification Script
 * Tests:
 * 1. New login works with new secrets
 * 2. Old tokens are rejected
 * 3. Token rotation works
 * 4. Logout invalidates refresh token
 */

const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

// Enable cookie jar support
const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({ jar: cookieJar }));

const API_URL = 'http://localhost:5000/api/v1';

// Test credentials (assuming test user exists)
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test1234'
};

async function verifyJWTSecurity() {
  console.log('🔐 JWT Security Verification\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // TEST 1: New login should work
    console.log('TEST 1: New Login with New JWT Secrets');
    console.log('-'.repeat(60));
    
    let loginResponse;
    try {
      loginResponse = await axios.post(`${API_URL}/auth/login`, TEST_USER);
      console.log('✅ Login successful');
      console.log(`   Access Token: ${loginResponse.data.accessToken.substring(0, 20)}...`);
      console.log(`   Refresh Token: ${loginResponse.data.refreshToken.substring(0, 20)}...`);
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data?.message || error.message);
      console.log('   This might be expected if test user does not exist');
      console.log('   Trying to register new user...\n');
      
      // Try to register
      try {
        await axios.post(`${API_URL}/auth/register`, {
          email: TEST_USER.email,
          password: TEST_USER.password,
          firstName: 'Test',
          lastName: 'User'
        });
        console.log('✅ Registration successful');
        
        // Login again
        loginResponse = await axios.post(`${API_URL}/auth/login`, TEST_USER);
        console.log('✅ Login successful after registration');
        if (loginResponse.data.accessToken && loginResponse.data.refreshToken) {
          console.log(`   Access Token: ${loginResponse.data.accessToken.substring(0, 20)}...`);
          console.log(`   Refresh Token: ${loginResponse.data.refreshToken.substring(0, 20)}...`);
        }
      } catch (regError) {
        console.log('❌ Registration failed:', regError.response?.data?.message || regError.message);
        throw new Error('Cannot proceed without valid user');
      }
    }
    
    if (!loginResponse || !loginResponse.data.accessToken) {
      throw new Error('Login did not return valid tokens');
    }
    
    const { accessToken, refreshToken } = loginResponse.data;
    console.log('');

    // TEST 2: Access protected endpoint with new token
    console.log('TEST 2: Access Protected Endpoint');
    console.log('-'.repeat(60));
    try {
      const meResponse = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      console.log('✅ Protected endpoint accessible');
      console.log(`   User: ${meResponse.data.user.email}`);
    } catch (error) {
      console.log('❌ Protected endpoint failed:', error.response?.data?.message || error.message);
    }
    console.log('');

    // TEST 3: Token refresh works
    console.log('TEST 3: Token Refresh');
    console.log('-'.repeat(60));
    try {
      const refreshResponse = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken
      });
      console.log('✅ Token refresh successful');
      console.log(`   New Access Token: ${refreshResponse.data.accessToken.substring(0, 20)}...`);
      console.log(`   New Refresh Token: ${refreshResponse.data.refreshToken.substring(0, 20)}...`);
      
      const newAccessToken = refreshResponse.data.accessToken;
      const newRefreshToken = refreshResponse.data.refreshToken;
      
      // TEST 4: Old refresh token should be invalid after rotation
      console.log('');
      console.log('TEST 4: Old Refresh Token Rejected After Rotation');
      console.log('-'.repeat(60));
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

      // TEST 5: Logout invalidates refresh token
      console.log('TEST 5: Logout Invalidates Refresh Token');
      console.log('-'.repeat(60));
      try {
        await axios.post(`${API_URL}/auth/logout`, {
          refreshToken: newRefreshToken
        }, {
          headers: { Authorization: `Bearer ${newAccessToken}` }
        });
        console.log('✅ Logout successful');
        
        // Try to use the refresh token after logout
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
      } catch (error) {
        console.log('❌ Logout failed:', error.response?.data?.message || error.message);
      }
      
    } catch (error) {
      console.log('❌ Token refresh failed:', error.response?.data?.message || error.message);
    }
    console.log('');

    // TEST 6: Tampered token rejected
    console.log('TEST 6: Tampered Token Rejected');
    console.log('-'.repeat(60));
    const tamperedToken = accessToken.slice(0, -10) + 'tampered12';
    try {
      await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tamperedToken}` }
      });
      console.log('❌ SECURITY ISSUE: Tampered token accepted!');
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('✅ Tampered token correctly rejected');
      } else {
        console.log('⚠️  Unexpected error:', error.response?.data?.message || error.message);
      }
    }
    console.log('');

    console.log('=' .repeat(60));
    console.log('✅ JWT Security Verification Complete\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyJWTSecurity();
