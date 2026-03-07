# Swagger/OpenAPI Setup Guide

## Overview
This guide explains how to enable Swagger UI for the Post Management API.

## Installation

### 1. Install Dependencies
```bash
cd apps/backend
npm install swagger-jsdoc swagger-ui-express
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-express
```

### 2. Enable Swagger in Server
Add the following to `src/server.ts`:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Add after other middleware, before routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Social Media Scheduler API',
}));
```

### 3. Access Documentation
Once the server is running:
- Development: http://localhost:3000/api-docs
- Production: https://api.example.com/api-docs

## Configuration

### Update Server URLs
Edit `src/config/swagger.ts` to update server URLs:

```typescript
servers: [
  {
    url: 'http://localhost:3000',
    description: 'Development server',
  },
  {
    url: 'https://api.production.com',  // Update this
    description: 'Production server',
  },
],
```

### Update Contact Information
```typescript
info: {
  title: 'Social Media Scheduler API',
  version: '1.0.0',
  description: 'API for managing scheduled social media posts',
  contact: {
    name: 'API Support',
    email: 'support@yourcompany.com',  // Update this
  },
},
```

## Using Swagger UI

### 1. Authentication
1. Click the "Authorize" button at the top right
2. Enter your JWT token in the format: `Bearer YOUR_TOKEN`
3. Click "Authorize"
4. All subsequent requests will include the token

### 2. Testing Endpoints
1. Expand an endpoint (e.g., POST /api/v1/posts)
2. Click "Try it out"
3. Fill in the request parameters
4. Click "Execute"
5. View the response

### 3. Example Request
```json
POST /api/v1/posts
{
  "workspaceId": "507f1f77bcf86cd799439012",
  "socialAccountId": "507f1f77bcf86cd799439013",
  "platform": "twitter",
  "content": "Check out our new product!",
  "mediaUrls": ["https://example.com/image.jpg"],
  "scheduledAt": "2026-03-04T15:00:00Z"
}
```

## Available Endpoints

### Posts Management
- `POST /api/v1/posts` - Create scheduled post
- `GET /api/v1/posts` - Get posts with pagination
- `GET /api/v1/posts/stats` - Get post statistics
- `GET /api/v1/posts/:id` - Get post by ID
- `PATCH /api/v1/posts/:id` - Update scheduled post
- `DELETE /api/v1/posts/:id` - Delete scheduled post
- `POST /api/v1/posts/:id/retry` - Retry failed post

## Schemas

### Post
Complete post object with all fields including status, timestamps, and metadata.

### PostAttempt
Publishing attempt details including status, error information, and duration.

### PostStats
Workspace-level statistics for all post statuses.

### ApiSuccessResponse
Standard success response format with data and metadata.

### ApiErrorResponse
Standard error response format with error code, message, and details.

## Security

### Authentication
All endpoints require JWT authentication via Bearer token.

### Rate Limiting
- 100 requests per 15 minutes per IP
- Rate limit headers included in responses

### Workspace Scoping
All endpoints require `workspaceId` parameter and enforce workspace isolation.

## Troubleshooting

### Swagger UI Not Loading
1. Verify dependencies are installed
2. Check server.ts has the correct import and middleware
3. Ensure server is running on correct port
4. Check browser console for errors

### Authentication Failing
1. Verify JWT token is valid
2. Check token format: `Bearer YOUR_TOKEN`
3. Ensure token hasn't expired
4. Verify user has access to workspace

### Endpoints Not Showing
1. Check `src/config/swagger.ts` apis path is correct
2. Verify OpenAPI annotations in route files
3. Restart server after changes
4. Clear browser cache

## Production Considerations

### 1. Disable in Production (Optional)
If you want to disable Swagger in production:

```typescript
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

### 2. Add Authentication to Swagger UI
Protect the documentation endpoint:

```typescript
app.use('/api-docs', requireAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### 3. Custom Domain
Update server URLs for custom domain:

```typescript
servers: [
  {
    url: 'https://api.yourcompany.com',
    description: 'Production API',
  },
],
```

## Next Steps

1. Install dependencies
2. Enable Swagger in server.ts
3. Update configuration with your URLs
4. Test all endpoints via Swagger UI
5. Share documentation URL with frontend team

---

**Status**: Ready for installation  
**Dependencies**: swagger-jsdoc, swagger-ui-express  
**Documentation**: Complete
