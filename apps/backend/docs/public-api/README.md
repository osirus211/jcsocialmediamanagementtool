# Public API Documentation

Welcome to the Social Media Scheduler Public API! This API allows you to programmatically manage your social media posts, view analytics, and integrate with your own applications.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Scopes & Permissions](#scopes--permissions)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Interactive Documentation](#interactive-documentation)

## Getting Started

### Base URL

```
Production: https://api.example.com
Staging: https://api-staging.example.com
Local: http://localhost:3000
```

### Quick Start

1. **Create an API Key**
   - Log in to your dashboard
   - Navigate to Settings → API Keys
   - Click "Create New Key"
   - Select the scopes you need
   - Save the key securely (it will only be shown once!)

2. **Make Your First Request**

```bash
curl -X GET https://api.example.com/api/public/v1/posts \
  -H "X-API-Key: sk_live_your_api_key_here"
```

3. **Explore the Interactive Docs**
   - Visit `/api/public/v1/docs/ui` for Swagger UI
   - Try out endpoints directly in your browser

## Authentication

All API requests require authentication using an API key passed in the `X-API-Key` header.

### API Key Format

```
sk_live_<random_string>
```

- `sk` = Secret Key
- `live` = Environment (live or test)
- Random string = 256-bit entropy, base64url encoded

### Example Request

```bash
curl -X GET https://api.example.com/api/public/v1/posts \
  -H "X-API-Key: sk_live_abc123xyz789"
```

### Security Best Practices

- ✅ Store API keys securely (environment variables, secrets manager)
- ✅ Use different keys for different environments (dev, staging, prod)
- ✅ Rotate keys regularly (every 90 days recommended)
- ✅ Use IP allowlisting when possible
- ✅ Grant minimum required scopes (principle of least privilege)
- ❌ Never commit API keys to version control
- ❌ Never expose API keys in client-side code
- ❌ Never share API keys via email or chat

## Rate Limiting

API requests are rate-limited to ensure fair usage and system stability.

### Default Limits

- **Per API Key**: 1000 requests per hour
- **Per Workspace**: 5000 requests per hour (across all keys)

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1709812800
```

- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

### Rate Limit Exceeded

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please retry after 3600 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "requestId": "req_abc123xyz",
  "timestamp": "2026-03-07T10:30:00Z"
}
```

The response includes a `Retry-After` header indicating when you can retry.

### Best Practices

- Monitor rate limit headers in your application
- Implement exponential backoff for retries
- Cache responses when possible
- Batch requests when appropriate
- Contact support if you need higher limits

## Scopes & Permissions

API keys have granular permission scopes that control access to endpoints.

### Available Scopes

| Scope | Description | Endpoints |
|-------|-------------|-----------|
| `posts:read` | Read posts and drafts | GET /posts, GET /posts/:id |
| `posts:write` | Create, update, delete posts | POST /posts, DELETE /posts/:id |
| `analytics:read` | Read analytics data | GET /analytics, GET /analytics/posts/:id |
| `media:read` | Read media library | GET /media, GET /media/:id |
| `media:write` | Upload and delete media | POST /media, DELETE /media/:id |
| `accounts:read` | Read connected accounts | GET /accounts |
| `accounts:write` | Connect/disconnect accounts | POST /accounts, DELETE /accounts/:id |
| `workspaces:read` | Read workspace info | GET /workspace |
| `integrations:read` | Read OAuth integrations | GET /integrations |
| `integrations:write` | Manage OAuth integrations | POST /integrations, DELETE /integrations/:id |

### Scope Hierarchy

Write scopes automatically include read access:

- `posts:write` → includes `posts:read`
- `media:write` → includes `media:read`
- `accounts:write` → includes `accounts:read`
- `integrations:write` → includes `integrations:read`

### Insufficient Scope Error

If your API key lacks the required scope, you'll receive a `403 Forbidden` response:

```json
{
  "error": "Forbidden",
  "message": "Missing required scopes: posts:write",
  "code": "INSUFFICIENT_SCOPE",
  "requestId": "req_abc123xyz",
  "timestamp": "2026-03-07T10:30:00Z"
}
```

## Error Handling

All errors follow a consistent format for easy parsing and handling.

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "requestId": "req_abc123xyz",
  "timestamp": "2026-03-07T10:30:00Z",
  "docsUrl": "https://docs.example.com/errors/ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_API_KEY` | 401 | No API key provided in X-API-Key header |
| `INVALID_API_KEY` | 401 | API key is invalid or malformed |
| `REVOKED_API_KEY` | 403 | API key has been revoked |
| `EXPIRED_API_KEY` | 403 | API key has expired |
| `INSUFFICIENT_SCOPE` | 403 | API key lacks required permission scope |
| `IP_NOT_ALLOWED` | 403 | Request from non-allowlisted IP address |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Error Handling Best Practices

```javascript
try {
  const response = await fetch('https://api.example.com/api/public/v1/posts', {
    headers: {
      'X-API-Key': process.env.API_KEY,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    
    switch (error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        // Wait and retry
        const retryAfter = response.headers.get('Retry-After');
        await sleep(retryAfter * 1000);
        return retry();
      
      case 'INVALID_API_KEY':
      case 'REVOKED_API_KEY':
      case 'EXPIRED_API_KEY':
        // API key issue - alert admin
        alertAdmin('API key needs attention', error);
        break;
      
      case 'INSUFFICIENT_SCOPE':
        // Missing permissions
        console.error('Missing required scope:', error.message);
        break;
      
      default:
        console.error('API error:', error);
    }
    
    throw new Error(error.message);
  }
  
  return await response.json();
} catch (error) {
  console.error('Request failed:', error);
  throw error;
}
```

## Code Examples

### JavaScript / Node.js

```javascript
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://api.example.com';

// List posts
async function listPosts() {
  const response = await fetch(`${BASE_URL}/api/public/v1/posts`, {
    headers: {
      'X-API-Key': API_KEY,
    },
  });
  
  const data = await response.json();
  return data.posts;
}

// Create a post
async function createPost(content, socialAccountIds, scheduledAt) {
  const response = await fetch(`${BASE_URL}/api/public/v1/posts`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      socialAccountIds,
      scheduledAt,
    }),
  });
  
  const data = await response.json();
  return data.post;
}

// Get analytics
async function getAnalytics(startDate, endDate) {
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
  
  const response = await fetch(
    `${BASE_URL}/api/public/v1/analytics?${params}`,
    {
      headers: {
        'X-API-Key': API_KEY,
      },
    }
  );
  
  const data = await response.json();
  return data.analytics;
}
```

### Python

```python
import requests
import os
from datetime import datetime

API_KEY = os.environ['API_KEY']
BASE_URL = 'https://api.example.com'

# List posts
def list_posts():
    response = requests.get(
        f'{BASE_URL}/api/public/v1/posts',
        headers={'X-API-Key': API_KEY}
    )
    response.raise_for_status()
    return response.json()['posts']

# Create a post
def create_post(content, social_account_ids, scheduled_at):
    response = requests.post(
        f'{BASE_URL}/api/public/v1/posts',
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        json={
            'content': content,
            'socialAccountIds': social_account_ids,
            'scheduledAt': scheduled_at.isoformat()
        }
    )
    response.raise_for_status()
    return response.json()['post']

# Get analytics
def get_analytics(start_date, end_date):
    response = requests.get(
        f'{BASE_URL}/api/public/v1/analytics',
        headers={'X-API-Key': API_KEY},
        params={
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat()
        }
    )
    response.raise_for_status()
    return response.json()['analytics']
```

### cURL

```bash
# List posts
curl -X GET https://api.example.com/api/public/v1/posts \
  -H "X-API-Key: sk_live_your_api_key_here"

# Create a post
curl -X POST https://api.example.com/api/public/v1/posts \
  -H "X-API-Key: sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Check out our new product!",
    "socialAccountIds": ["507f1f77bcf86cd799439011"],
    "scheduledAt": "2026-03-08T10:00:00Z"
  }'

# Get analytics
curl -X GET "https://api.example.com/api/public/v1/analytics?startDate=2026-02-01T00:00:00Z&endDate=2026-03-01T00:00:00Z" \
  -H "X-API-Key: sk_live_your_api_key_here"

# Delete a post
curl -X DELETE https://api.example.com/api/public/v1/posts/507f1f77bcf86cd799439011 \
  -H "X-API-Key: sk_live_your_api_key_here"
```

## Interactive Documentation

### Swagger UI

Visit `/api/public/v1/docs/ui` for interactive API documentation where you can:

- Browse all available endpoints
- View request/response schemas
- Try out endpoints directly in your browser
- See example requests and responses
- Download the OpenAPI specification

### OpenAPI Specification

Download the machine-readable API specification:

- **JSON**: `/api/public/v1/docs/openapi.json`
- **YAML**: `/api/public/v1/docs/openapi.yaml`

Use these files to:
- Generate client libraries in your preferred language
- Import into API testing tools (Postman, Insomnia)
- Validate requests and responses
- Generate mock servers

## Support

Need help? We're here for you!

- **Documentation**: https://docs.example.com
- **API Status**: https://status.example.com
- **Email Support**: api-support@example.com
- **Community Forum**: https://community.example.com

## Changelog

### v1.0.0 (2026-03-07)

- Initial public API release
- Posts management endpoints
- Analytics endpoints
- Media management endpoints
- Accounts viewing endpoints
- API key authentication
- Rate limiting
- Scope-based permissions
- Interactive Swagger UI documentation
