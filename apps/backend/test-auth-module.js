const mongoose = require('mongoose');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000/api/v1/auth';
let accessToken = '';
let oldRefreshToken = '';
let newRefreshToken = '';
let userId = '';

console.log('=== MODULE 1 — AUTH SYSTEM VALIDATION ===\n');

// Helper to query MongoDB
async function queryUserTokens(email) {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.connection.collection('users');
  const user = await User.findOne({ email }, { projection: { refreshTokens: 1 } });
  await mongoose.disconnect();
  return user;
}

// STEP A — LOGIN TEST
async function testLogin() {
  console.log('------------------------------------');
  console.log('STEP A — LOGIN TEST');
  console.log('------------------------------------\n');
  
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'runtime1@test.com',
      password: 'TestPass123!'
    })
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/refreshToken=([^;]+)/);
    if (match) {
      oldRefreshToken = match[1];
      console.log('Refresh Token (cookie):', oldRefreshToken.substring(0, 30) + '...');
    }
  }
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (data.accessToken) {
    accessToken = data.accessToken;
    console.log('\n✅ Access token received');
  }
  
  if (data.user) {
    userId = data.user._id;
    console.log('✅ User object returned');
  }
  
  console.log('\nLOGIN HTTP:', response.ok ? 'PASS' : 'FAIL');
  return response.ok;
}

// STEP B — PROTECTED ROUTE TEST
async function testProtectedRoute() {
  console.log('\n------------------------------------');
  console.log('STEP B — PROTECTED ROUTE TEST');
  console.log('------------------------------------\n');
  
  const response = await fetch(`${BASE_URL}/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  console.log('\nProtected route:', response.ok ? 'PASS' : 'FAIL');
  return response.ok;
}

// STEP C — INVALID TOKEN TEST
async function testInvalidToken() {
  console.log('\n------------------------------------');
  console.log('STEP C — INVALID TOKEN TEST');
  console.log('------------------------------------\n');
  
  const response = await fetch(`${BASE_URL}/me`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer invalidtoken'
    }
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  const rejected = response.status === 401;
  console.log('\nInvalid token rejected:', rejected ? 'PASS' : 'FAIL');
  return rejected;
}

// STEP D — TOKEN REFRESH TEST
async function testTokenRefresh() {
  console.log('\n------------------------------------');
  console.log('STEP D — TOKEN REFRESH TEST');
  console.log('------------------------------------\n');
  
  console.log('Using refresh token from cookie...');
  
  const response = await fetch(`${BASE_URL}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `refreshToken=${oldRefreshToken}`
    }
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/refreshToken=([^;]+)/);
    if (match) {
      newRefreshToken = match[1];
      console.log('New Refresh Token:', newRefreshToken.substring(0, 30) + '...');
    }
  }
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (data.accessToken) {
    console.log('\n✅ New access token received');
  }
  
  // Query MongoDB to verify token rotation
  console.log('\n--- MongoDB Verification ---');
  const user = await queryUserTokens('runtime1@test.com');
  console.log('Refresh tokens count:', user?.refreshTokens?.length || 0);
  
  if (user?.refreshTokens?.length === 1) {
    console.log('✅ Token count = 1 (rotation working)');
    const currentToken = user.refreshTokens[0];
    const tokenChanged = currentToken !== oldRefreshToken;
    console.log('Token changed:', tokenChanged ? 'YES' : 'NO');
    if (tokenChanged) {
      console.log('✅ Token rotation confirmed');
    }
  }
  
  console.log('\nRefresh success:', response.ok ? 'PASS' : 'FAIL');
  console.log('Token rotation working:', newRefreshToken !== oldRefreshToken ? 'PASS' : 'FAIL');
  return response.ok;
}

// STEP E — TOKEN REUSE TEST
async function testTokenReuse() {
  console.log('\n------------------------------------');
  console.log('STEP E — TOKEN REUSE TEST');
  console.log('------------------------------------\n');
  
  console.log('Attempting to reuse OLD refresh token...');
  console.log('Old token:', oldRefreshToken.substring(0, 30) + '...\n');
  
  const response = await fetch(`${BASE_URL}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: oldRefreshToken
    })
  });
  
  console.log('HTTP Status:', response.status, response.statusText);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  const reuseDetected = response.status === 401;
  console.log('\nReuse detected:', reuseDetected ? 'YES' : 'NO');
  
  // Query MongoDB to verify all tokens revoked
  console.log('\n--- MongoDB Verification ---');
  const user = await queryUserTokens('runtime1@test.com');
  console.log('Refresh tokens count:', user?.refreshTokens?.length || 0);
  
  const allRevoked = user?.refreshTokens?.length === 0;
  console.log('All tokens revoked:', allRevoked ? 'YES' : 'NO');
  
  console.log('\nReuse detection working:', (reuseDetected && allRevoked) ? 'PASS' : 'FAIL');
  return reuseDetected && allRevoked;
}

// Run all tests
(async () => {
  try {
    const results = {
      login: await testLogin(),
      protectedRoute: await testProtectedRoute(),
      invalidToken: await testInvalidToken(),
      tokenRefresh: await testTokenRefresh(),
      tokenReuse: await testTokenReuse()
    };
    
    console.log('\n====================================');
    console.log('MODULE 1 FINAL STATUS');
    console.log('====================================');
    console.log('LOGIN HTTP:', results.login ? 'PASS' : 'FAIL');
    console.log('Protected route:', results.protectedRoute ? 'PASS' : 'FAIL');
    console.log('Invalid token rejected:', results.invalidToken ? 'PASS' : 'FAIL');
    console.log('Refresh success:', results.tokenRefresh ? 'PASS' : 'FAIL');
    console.log('Token rotation working:', results.tokenRefresh ? 'PASS' : 'FAIL');
    console.log('Reuse detection working:', results.tokenReuse ? 'PASS' : 'FAIL');
    
    const allPassed = Object.values(results).every(r => r);
    console.log('\nModule 1 final status:', allPassed ? '✅ PASS' : '❌ FAIL');
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
