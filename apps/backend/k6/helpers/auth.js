import http from 'k6/http';
import { check } from 'k6';

/**
 * Get authentication token by logging in with email/password
 * @param {string} baseUrl - Base URL of the API
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {string|null} Authentication token or null if failed
 */
export function getAuthToken(baseUrl, email, password) {
  const loginPayload = {
    email: email,
    password: password
  };

  const response = http.post(`${baseUrl}/api/v1/auth/login`, JSON.stringify(loginPayload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (check(response, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined,
  })) {
    return response.json('token');
  }

  console.error(`Login failed: ${response.status} - ${response.body}`);
  return null;
}

/**
 * Get API key from the authenticated user's API keys
 * @param {string} baseUrl - Base URL of the API
 * @param {string} token - Authentication token
 * @returns {string|null} API key or null if failed
 */
export function getApiKey(baseUrl, token) {
  const response = http.get(`${baseUrl}/api/v1/api-keys`, {
    headers: authHeaders(token),
  });

  if (check(response, {
    'api keys retrieved': (r) => r.status === 200,
    'has api keys': (r) => r.json('data') && r.json('data').length > 0,
  })) {
    const apiKeys = response.json('data');
    return apiKeys[0].key; // Return first API key
  }

  console.error(`Failed to get API keys: ${response.status} - ${response.body}`);
  return null;
}

/**
 * Generate authentication headers with Bearer token
 * @param {string} token - Authentication token
 * @returns {Object} Headers object
 */
export function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Generate API key headers
 * @param {string} apiKey - API key
 * @returns {Object} Headers object
 */
export function apiKeyHeaders(apiKey) {
  return {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a test user for load testing (if needed)
 * @param {string} baseUrl - Base URL of the API
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {boolean} Success status
 */
export function createTestUser(baseUrl, email, password) {
  const signupPayload = {
    email: email,
    password: password,
    firstName: 'Load',
    lastName: 'Test',
    workspaceName: 'Load Test Workspace'
  };

  const response = http.post(`${baseUrl}/api/v1/auth/signup`, JSON.stringify(signupPayload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return check(response, {
    'user created or already exists': (r) => r.status === 201 || r.status === 409,
  });
}

/**
 * Get workspace ID for the authenticated user
 * @param {string} baseUrl - Base URL of the API
 * @param {string} token - Authentication token
 * @returns {string|null} Workspace ID or null if failed
 */
export function getWorkspaceId(baseUrl, token) {
  const response = http.get(`${baseUrl}/api/v1/workspaces`, {
    headers: authHeaders(token),
  });

  if (check(response, {
    'workspaces retrieved': (r) => r.status === 200,
    'has workspaces': (r) => r.json('data') && r.json('data').length > 0,
  })) {
    const workspaces = response.json('data');
    return workspaces[0].id; // Return first workspace ID
  }

  console.error(`Failed to get workspaces: ${response.status} - ${response.body}`);
  return null;
}