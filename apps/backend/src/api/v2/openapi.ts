/**
 * OpenAPI 3.0 Specification Generator
 * 
 * Generates OpenAPI spec for Public API v2
 */

import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { SocialPlatform, PostStatus } from '../../models/ScheduledPost';

// Extend Zod with OpenAPI
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// Security scheme
registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'x-api-key',
  description: 'API key for authentication. Get your API key from the dashboard.',
});

// Common schemas
const ErrorSchema = registry.register(
  'Error',
  z.object({
    error: z.string().openapi({ description: 'Error message' }),
    code: z.string().openapi({ description: 'Error code' }),
    details: z.record(z.any()).optional().openapi({ description: 'Additional error details' }),
  }).openapi({ description: 'Error response' })
);

const MetaSchema = registry.register(
  'Meta',
  z.object({
    cursor: z.string().nullable().openapi({ description: 'Cursor for next page (null if no more pages)' }),
    hasMore: z.boolean().openapi({ description: 'Whether there are more items' }),
    total: z.number().optional().openapi({ description: 'Total count of items' }),
  }).openapi({ description: 'Pagination metadata' })
);

// Post schemas
const PostSchema = registry.register(
  'Post',
  z.object({
    _id: z.string().openapi({ description: 'Post ID' }),
    workspaceId: z.string().openapi({ description: 'Workspace ID' }),
    socialAccountId: z.string().openapi({ description: 'Social account ID' }),
    platform: z.nativeEnum(SocialPlatform).openapi({ description: 'Social platform' }),
    content: z.string().openapi({ description: 'Post content' }),
    mediaIds: z.array(z.string()).optional().openapi({ description: 'Media file IDs' }),
    status: z.nativeEnum(PostStatus).openapi({ description: 'Post status' }),
    scheduledAt: z.string().datetime().openapi({ description: 'Scheduled publish time' }),
    publishedAt: z.string().datetime().nullable().openapi({ description: 'Actual publish time' }),
    contentType: z.enum(['post', 'story', 'reel']).openapi({ description: 'Content type' }),
    createdAt: z.string().datetime().openapi({ description: 'Creation time' }),
    updatedAt: z.string().datetime().openapi({ description: 'Last update time' }),
  }).openapi({ description: 'Social media post' })
);

const CreatePostSchema = registry.register(
  'CreatePost',
  z.object({
    socialAccountId: z.string().openapi({ description: 'Social account ID to post to' }),
    platform: z.nativeEnum(SocialPlatform).openapi({ description: 'Social platform' }),
    content: z.string().min(1).max(5000).openapi({ description: 'Post content (1-5000 characters)' }),
    mediaIds: z.array(z.string()).optional().openapi({ description: 'Media file IDs to attach' }),
    scheduledAt: z.string().datetime().optional().openapi({ description: 'Schedule time (defaults to now)' }),
    contentType: z.enum(['post', 'story', 'reel']).optional().default('post').openapi({ description: 'Content type' }),
  }).openapi({ description: 'Create post request' })
);

// Analytics schemas
const PostAnalyticsSchema = registry.register(
  'PostAnalytics',
  z.object({
    postId: z.string().openapi({ description: 'Post ID' }),
    platform: z.nativeEnum(SocialPlatform).openapi({ description: 'Social platform' }),
    impressions: z.number().openapi({ description: 'Number of impressions' }),
    engagements: z.number().openapi({ description: 'Total engagements' }),
    likes: z.number().openapi({ description: 'Number of likes' }),
    comments: z.number().openapi({ description: 'Number of comments' }),
    shares: z.number().openapi({ description: 'Number of shares' }),
    clicks: z.number().openapi({ description: 'Number of clicks' }),
    engagementRate: z.number().openapi({ description: 'Engagement rate percentage' }),
    collectedAt: z.string().datetime().openapi({ description: 'Data collection time' }),
  }).openapi({ description: 'Post analytics data' })
);

const FollowerDataSchema = registry.register(
  'FollowerData',
  z.object({
    platform: z.nativeEnum(SocialPlatform).openapi({ description: 'Social platform' }),
    date: z.string().date().openapi({ description: 'Date of record' }),
    followerCount: z.number().openapi({ description: 'Total followers' }),
    change: z.number().openapi({ description: 'Change from previous day' }),
    changePercent: z.number().openapi({ description: 'Percentage change' }),
  }).openapi({ description: 'Follower growth data' })
);

// Media schemas
const MediaSchema = registry.register(
  'Media',
  z.object({
    _id: z.string().openapi({ description: 'Media ID' }),
    workspaceId: z.string().openapi({ description: 'Workspace ID' }),
    filename: z.string().openapi({ description: 'Original filename' }),
    mimeType: z.string().openapi({ description: 'MIME type' }),
    size: z.number().openapi({ description: 'File size in bytes' }),
    url: z.string().url().openapi({ description: 'Public URL' }),
    thumbnails: z.record(z.string()).optional().openapi({ description: 'Thumbnail URLs by size' }),
    uploadedBy: z.string().openapi({ description: 'Uploader ID' }),
    createdAt: z.string().datetime().openapi({ description: 'Upload time' }),
  }).openapi({ description: 'Media file' })
);

// Webhook schemas
const WebhookSchema = registry.register(
  'Webhook',
  z.object({
    _id: z.string().openapi({ description: 'Webhook ID' }),
    workspaceId: z.string().openapi({ description: 'Workspace ID' }),
    url: z.string().url().openapi({ description: 'Webhook endpoint URL' }),
    events: z.array(z.string()).openapi({ description: 'Subscribed event types' }),
    enabled: z.boolean().openapi({ description: 'Whether webhook is enabled' }),
    successCount: z.number().openapi({ description: 'Successful deliveries' }),
    failureCount: z.number().openapi({ description: 'Failed deliveries' }),
    lastTriggeredAt: z.string().datetime().nullable().openapi({ description: 'Last trigger time' }),
    createdAt: z.string().datetime().openapi({ description: 'Creation time' }),
  }).openapi({ description: 'Webhook endpoint' })
);

// Register API paths
registry.registerPath({
  method: 'get',
  path: '/api/v2/posts',
  description: 'List posts with cursor-based pagination',
  summary: 'List posts',
  tags: ['Posts'],
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      status: z.nativeEnum(PostStatus).optional(),
      platform: z.nativeEnum(SocialPlatform).optional(),
      socialAccountId: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of posts',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(PostSchema),
            meta: MetaSchema,
          }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - missing posts:read scope', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v2/posts',
  description: 'Create a new post. Requires posts:write scope.',
  summary: 'Create post',
  tags: ['Posts'],
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePostSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Post created successfully',
      content: {
        'application/json': {
          schema: z.object({ data: PostSchema }),
        },
      },
    },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - missing posts:write scope', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v2/analytics/posts',
  description: 'Get post performance metrics. Requires analytics:read scope.',
  summary: 'Post analytics',
  tags: ['Analytics'],
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      platform: z.nativeEnum(SocialPlatform).optional(),
      limit: z.coerce.number().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: {
      description: 'Post analytics data',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(PostAnalyticsSchema),
            meta: z.object({
              period: z.object({
                from: z.string().datetime(),
                to: z.string().datetime(),
              }),
              platform: z.string(),
            }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - missing analytics:read scope', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v2/media/upload',
  description: 'Upload a media file. Requires media:write scope.',
  summary: 'Upload media',
  tags: ['Media'],
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.string().openapi({ type: 'string', format: 'binary' }),
            folderId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Media uploaded successfully',
      content: {
        'application/json': {
          schema: z.object({ data: MediaSchema }),
        },
      },
    },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - missing media:write scope', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

/**
 * Generate complete OpenAPI specification
 */
export function generateOpenAPISpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '2.0.0',
      title: 'Social Media Scheduler Public API',
      description: `
# Social Media Scheduler Public API v2

The Public API allows external developers to integrate with the Social Media Scheduler platform.

## Authentication

All API requests require an API key passed in the \`x-api-key\` header:

\`\`\`
x-api-key: sk_live_your_api_key_here
\`\`\`

Get your API key from the dashboard under Settings > API Keys.

## Rate Limits

API keys have configurable rate limits. Default limits:
- 1,000 requests per hour per API key
- 10,000 requests per hour per workspace (aggregate)

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Request limit per window
- \`X-RateLimit-Remaining\`: Requests remaining in current window
- \`X-RateLimit-Reset\`: Unix timestamp when window resets

## Scopes

API keys require specific scopes for different operations:
- \`posts:read\` - Read posts and schedules
- \`posts:write\` - Create, update, delete posts
- \`analytics:read\` - Access analytics data
- \`media:read\` - List media files
- \`media:write\` - Upload and delete media
- \`webhooks:read\` - List webhook endpoints
- \`webhooks:write\` - Manage webhook endpoints

Write scopes automatically include read access (e.g., \`posts:write\` includes \`posts:read\`).

## Pagination

List endpoints use cursor-based pagination for better performance:

\`\`\`json
{
  "data": [...],
  "meta": {
    "cursor": "next_page_cursor_or_null",
    "hasMore": true,
    "total": 150
  }
}
\`\`\`

Pass the \`cursor\` value as a query parameter to get the next page.

## Error Handling

All errors return a consistent format:

\`\`\`json
{
  "error": "Human readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": { "field": "Additional context" }
}
\`\`\`

Common HTTP status codes:
- \`400\` - Bad Request (validation errors)
- \`401\` - Unauthorized (missing or invalid API key)
- \`403\` - Forbidden (insufficient scopes)
- \`404\` - Not Found
- \`429\` - Rate Limit Exceeded
- \`500\` - Internal Server Error

## Webhooks

Subscribe to real-time events by registering webhook endpoints:

Available events:
- \`post.published\` - Post successfully published
- \`post.failed\` - Post publishing failed
- \`analytics.updated\` - New analytics data available
- \`follower.milestone\` - Follower milestone reached

Webhook payloads include HMAC signatures for verification.
      `,
      contact: {
        name: 'API Support',
        email: 'api-support@example.com',
      },
    },
    servers: [
      {
        url: 'https://api.socialmediascheduler.com',
        description: 'Production server',
      },
      {
        url: 'https://api-staging.socialmediascheduler.com',
        description: 'Staging server',
      },
    ],
    tags: [
      { name: 'Posts', description: 'Social media post management' },
      { name: 'Analytics', description: 'Performance analytics and insights' },
      { name: 'Media', description: 'Media file management' },
      { name: 'Webhooks', description: 'Webhook endpoint management' },
    ],
  });
}