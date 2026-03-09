/**
 * Manual test script for API Key functionality
 * 
 * This script tests the complete API key workflow:
 * 1. Create an API key
 * 2. Use the API key to access public API
 * 3. Test rate limiting
 * 4. Test scope validation
 * 5. Revoke the API key
 * 
 * Usage: node test-api-keys.js
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_TOKEN = process.env.JWT_TOKEN; // Set this to a valid JWT token

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testApiKeys() {
  if (!JWT_TOKEN) {
    logError('JWT_TOKEN environment variable is required');
    logInfo('Set it with: export JWT_TOKEN="your-jwt-token"');
    process.exit(1);
  }

  log('\n=== API Key Functionality Test ===\n', 'blue');

  let apiKeyId = null;
  let apiKey = null;

  try {
    // Test 1: Create API Key
    log('Test 1: Creating API Key...', 'yellow');
    try {
      const createResponse = await axios.post(
        `${BASE_URL}/api/v1/api-keys`,
        {
          name: 'Test API Key',
          scopes: ['posts:read', 'posts:write', 'analytics:read'],
          rateLimit: {
            maxRequests: 100,
            windowMs: 3600000, // 1 hour
          },
        },
        {
          headers: {
            Authorization: `Bearer ${JWT_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      apiKeyId = createResponse.data.apiKey.id;
      apiKey = createResponse.data.apiKey.key;

      logSuccess(`API Key created: ${createResponse.data.apiKey.prefix}...`);
      logInfo(`Full key (save this): ${apiKey}`);
      logInfo(`Key ID: ${apiKeyId}`);
    } catch (error) {
      logError(`Failed to create API key: ${error.response?.data?.message || error.message}`);
      throw error;
    }

    await sleep(1000);

    // Test 2: List API Keys
    log('\nTest 2: Listing API Keys...', 'yellow');
    try {
      const listResponse = await axios.get(`${BASE_URL}/api/v1/api-keys`, {
        headers: {
          Authorization: `Bearer ${JWT_TOKEN}`,
        },
      });

      logSuccess(`Found ${listResponse.data.apiKeys.length} API key(s)`);
      logInfo(`Keys: ${listResponse.data.apiKeys.map(k => k.name).join(', ')}`);
    } catch (error) {
      logError(`Failed to list API keys: ${error.response?.data?.message || error.message}`);
    }

    await sleep(1000);

    // Test 3: Use API Key to access Public API (posts:read)
    log('\nTest 3: Using API Key to access Public API (GET /posts)...', 'yellow');
    try {
      const postsResponse = await axios.get(`${BASE_URL}/api/public/v1/posts`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      logSuccess(`Successfully accessed public API`);
      logInfo(`Found ${postsResponse.data.posts?.length || 0} post(s)`);
      logInfo(`Rate limit: ${postsResponse.headers['x-ratelimit-remaining']}/${postsResponse.headers['x-ratelimit-limit']}`);
    } catch (error) {
      logError(`Failed to access public API: ${error.response?.data?.message || error.message}`);
    }

    await sleep(1000);

    // Test 4: Test scope validation (try to access endpoint without required scope)
    log('\nTest 4: Testing scope validation (should fail - no media:read scope)...', 'yellow');
    try {
      await axios.get(`${BASE_URL}/api/public/v1/media`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      logWarning('Scope validation did not work as expected (request succeeded)');
    } catch (error) {
      if (error.response?.status === 403) {
        logSuccess('Scope validation working correctly (403 Forbidden)');
        logInfo(`Error: ${error.response.data.message}`);
      } else {
        logError(`Unexpected error: ${error.response?.data?.message || error.message}`);
      }
    }

    await sleep(1000);

    // Test 5: Test invalid API key
    log('\nTest 5: Testing invalid API key (should fail)...', 'yellow');
    try {
      await axios.get(`${BASE_URL}/api/public/v1/posts`, {
        headers: {
          'X-API-Key': 'sk_live_invalid_key_12345',
        },
      });

      logWarning('Invalid API key validation did not work (request succeeded)');
    } catch (error) {
      if (error.response?.status === 401) {
        logSuccess('Invalid API key rejected correctly (401 Unauthorized)');
        logInfo(`Error: ${error.response.data.message}`);
      } else {
        logError(`Unexpected error: ${error.response?.data?.message || error.message}`);
      }
    }

    await sleep(1000);

    // Test 6: Get API Key details
    log('\nTest 6: Getting API Key details...', 'yellow');
    try {
      const detailsResponse = await axios.get(`${BASE_URL}/api/v1/api-keys/${apiKeyId}`, {
        headers: {
          Authorization: `Bearer ${JWT_TOKEN}`,
        },
      });

      logSuccess('API Key details retrieved');
      logInfo(`Name: ${detailsResponse.data.apiKey.name}`);
      logInfo(`Status: ${detailsResponse.data.apiKey.status}`);
      logInfo(`Scopes: ${detailsResponse.data.apiKey.scopes.join(', ')}`);
      logInfo(`Request count: ${detailsResponse.data.apiKey.requestCount}`);
    } catch (error) {
      logError(`Failed to get API key details: ${error.response?.data?.message || error.message}`);
    }

    await sleep(1000);

    // Test 7: Update API Key
    log('\nTest 7: Updating API Key (adding media:read scope)...', 'yellow');
    try {
      const updateResponse = await axios.patch(
        `${BASE_URL}/api/v1/api-keys/${apiKeyId}`,
        {
          scopes: ['posts:read', 'posts:write', 'analytics:read', 'media:read'],
        },
        {
          headers: {
            Authorization: `Bearer ${JWT_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logSuccess('API Key updated successfully');
      logInfo(`New scopes: ${updateResponse.data.apiKey.scopes.join(', ')}`);
    } catch (error) {
      logError(`Failed to update API key: ${error.response?.data?.message || error.message}`);
    }

    await sleep(1000);

    // Test 8: Test updated scope (should now work)
    log('\nTest 8: Testing updated scope (should now work - media:read added)...', 'yellow');
    try {
      const mediaResponse = await axios.get(`${BASE_URL}/api/public/v1/media`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      logSuccess('Successfully accessed media endpoint with updated scope');
      logInfo(`Found ${mediaResponse.data.media?.length || 0} media item(s)`);
    } catch (error) {
      logError(`Failed to access media endpoint: ${error.response?.data?.message || error.message}`);
    }

    await sleep(1000);

    // Test 9: Revoke API Key
    log('\nTest 9: Revoking API Key...', 'yellow');
    try {
      await axios.post(
        `${BASE_URL}/api/v1/api-keys/${apiKeyId}/revoke`,
        {},
        {
          headers: {
            Authorization: `Bearer ${JWT_TOKEN}`,
          },
        }
      );

      logSuccess('API Key revoked successfully');
    } catch (error) {
      logError(`Failed to revoke API key: ${error.response?.data?.message || error.message}`);
    }

    await sleep(1000);

    // Test 10: Try to use revoked API key (should fail)
    log('\nTest 10: Testing revoked API key (should fail)...', 'yellow');
    try {
      await axios.get(`${BASE_URL}/api/public/v1/posts`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      logWarning('Revoked API key validation did not work (request succeeded)');
    } catch (error) {
      if (error.response?.status === 401) {
        logSuccess('Revoked API key rejected correctly (401 Unauthorized)');
        logInfo(`Error: ${error.response.data.message}`);
      } else {
        logError(`Unexpected error: ${error.response?.data?.message || error.message}`);
      }
    }

    await sleep(1000);

    // Test 11: Delete API Key
    log('\nTest 11: Deleting API Key...', 'yellow');
    try {
      await axios.delete(`${BASE_URL}/api/v1/api-keys/${apiKeyId}`, {
        headers: {
          Authorization: `Bearer ${JWT_TOKEN}`,
        },
      });

      logSuccess('API Key deleted successfully');
    } catch (error) {
      logError(`Failed to delete API key: ${error.response?.data?.message || error.message}`);
    }

    log('\n=== All Tests Completed ===\n', 'green');
  } catch (error) {
    log('\n=== Tests Failed ===\n', 'red');
    logError(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run tests
testApiKeys().catch(error => {
  logError(`Unhandled error: ${error.message}`);
  process.exit(1);
});
