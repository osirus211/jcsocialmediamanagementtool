import { check } from 'k6';

/**
 * Check if response indicates success (200 or 201)
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if successful
 */
export function checkSuccess(response) {
  return check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });
}

/**
 * Check if response is not an authentication error
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if not auth error
 */
export function checkAuth(response) {
  return check(response, {
    'not unauthorized': (r) => r.status !== 401,
    'not forbidden': (r) => r.status !== 403,
  });
}

/**
 * Check if response is not rate limited
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if not rate limited
 */
export function checkRateLimit(response) {
  return check(response, {
    'not rate limited': (r) => r.status !== 429,
  });
}

/**
 * Check if response time is under threshold
 * @param {Object} response - HTTP response object
 * @param {number} maxMs - Maximum response time in milliseconds (default: 2000)
 * @returns {boolean} True if response time is acceptable
 */
export function checkResponseTime(response, maxMs = 2000) {
  return check(response, {
    [`response time < ${maxMs}ms`]: (r) => r.timings.duration < maxMs,
  });
}

/**
 * Check if response has valid JSON body
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if has valid JSON
 */
export function checkValidJson(response) {
  return check(response, {
    'has valid JSON': (r) => {
      try {
        r.json();
        return true;
      } catch (e) {
        return false;
      }
    },
  });
}

/**
 * Check if response has expected content type
 * @param {Object} response - HTTP response object
 * @param {string} expectedType - Expected content type (default: 'application/json')
 * @returns {boolean} True if content type matches
 */
export function checkContentType(response, expectedType = 'application/json') {
  return check(response, {
    [`content type is ${expectedType}`]: (r) => 
      r.headers['Content-Type'] && r.headers['Content-Type'].includes(expectedType),
  });
}

/**
 * Check if response has rate limit headers
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if rate limit headers are present
 */
export function checkRateLimitHeaders(response) {
  return check(response, {
    'has rate limit headers': (r) => 
      r.headers['X-RateLimit-Limit'] !== undefined ||
      r.headers['x-ratelimit-limit'] !== undefined,
  });
}

/**
 * Log failure details for debugging
 * @param {Object} response - HTTP response object
 * @param {string} testName - Name of the test that failed
 */
export function logFailure(response, testName) {
  if (response.status >= 400) {
    console.error(`❌ ${testName} failed:`);
    console.error(`   Status: ${response.status}`);
    console.error(`   URL: ${response.url}`);
    console.error(`   Response Time: ${response.timings.duration}ms`);
    console.error(`   Body: ${response.body.substring(0, 500)}`);
    
    // Log rate limit info if available
    if (response.headers['X-RateLimit-Remaining']) {
      console.error(`   Rate Limit Remaining: ${response.headers['X-RateLimit-Remaining']}`);
    }
  }
}

/**
 * Comprehensive response validation
 * @param {Object} response - HTTP response object
 * @param {string} testName - Name of the test
 * @param {Object} options - Validation options
 * @returns {boolean} True if all checks pass
 */
export function validateResponse(response, testName, options = {}) {
  const {
    expectSuccess = true,
    maxResponseTime = 2000,
    expectJson = true,
    expectAuth = true,
    expectNoRateLimit = true
  } = options;

  let allPassed = true;

  if (expectSuccess) {
    allPassed = checkSuccess(response) && allPassed;
  }

  if (expectAuth) {
    allPassed = checkAuth(response) && allPassed;
  }

  if (expectNoRateLimit) {
    allPassed = checkRateLimit(response) && allPassed;
  }

  if (maxResponseTime) {
    allPassed = checkResponseTime(response, maxResponseTime) && allPassed;
  }

  if (expectJson) {
    allPassed = checkValidJson(response) && allPassed;
    allPassed = checkContentType(response) && allPassed;
  }

  if (!allPassed) {
    logFailure(response, testName);
  }

  return allPassed;
}

/**
 * Check if response indicates server error (5xx)
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if not server error
 */
export function checkNoServerError(response) {
  return check(response, {
    'no server error': (r) => r.status < 500,
  });
}

/**
 * Check if response has pagination metadata
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if has pagination info
 */
export function checkPagination(response) {
  return check(response, {
    'has pagination': (r) => {
      const json = r.json();
      return json.pagination !== undefined || 
             (json.meta && json.meta.pagination !== undefined);
    },
  });
}