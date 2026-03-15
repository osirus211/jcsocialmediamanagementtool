/**
 * OpenAPI 3.0 Specification Generator
 * 
 * Generates OpenAPI spec for Public API v2
 */

import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

// Define platform and status enums as const arrays for better compatibility
const SOCIAL_PLATFORMS = [
  'twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'threads',
  'tiktok', 'bluesky', 'mastodon', 'reddit', 'google-business', 'pinterest',
  'github', 'apple'
] as const;

const POST_STATUSES = [
  'draft', 'pending_approval', 'approved', 'scheduled', 'queued',
  'publishing', 'published', 'failed', 'rejected'
] as const;

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
    error: z.string().describe('Error message'),
    code: z.string().describe('Error code'),
    details: z.record(z.any()).optional().describe('Additional error details'),
  }).openapi({ description: 'Error response' })
);

const MetaSchema = registry.register(
  'Meta',
  z.object({
    cursor: z.string().nullable().describe('Cursor for next page (null if no more pages)'),
    hasMore: z.boolean().describe('Whether there are more items'),
    total: z.number().optional().describe('Total count of items'),
  }).openapi({ description: 'Pagination metadata' })
);

// Post schemas
const PostSchema = registry.register(
  'Post',
  z.object({
    _id: z.string().describe('Post ID'),
    workspaceId: z.string().describe('Workspace ID'),
    socialAccountId: z.string().describe('Social account ID'),
    platform: z.enum(SOCIAL_PLATFORMS).describe('Social platform'),
    content: z.string().describe('Post content'),
    mediaIds: z.array(z.string()).optional().describe('Media file IDs'),
    status: z.enum(POST_STATUSES).describe('Post status'),
    scheduledAt: z.string().datetime().describe('Scheduled publish time'),
    publishedAt: z.string().datetime().nullable().describe('Actual publish time'),
    contentType: z.enum(['post', 'story', 'reel']).describe('Content type'),
    createdAt: z.string().datetime().describe('Creation time'),
    updatedAt: z.string().datetime().describe('Last update time'),
  }).openapi({ description: 'Social media post' })
);

const CreatePostSchema = registry.register(
  'CreatePost',
  z.object({
    socialAccountId: z.string().describe('Social account ID to post to'),
    platform: z.enum(SOCIAL_PLATFORMS).describe('Social platform'),
    content: z.string().min(1).max(5000).describe('Post content (1-5000 characters)'),
    mediaIds: z.array(z.string()).optional().describe('Media file IDs to attach'),
    scheduledAt: z.string().datetime().optional().describe('Schedule time (defaults to now)'),
    contentType: z.enum(['post', 'story', 'reel']).optional().default('post').describe('Content type'),
  }).openapi({ description: 'Create post request' })
);

// Analytics schemas
const PostAnalyticsSchema = registry.register(
  'PostAnalytics',
  z.object({
    postId: z.string().describe('Post ID'),
    platform: z.enum(SOCIAL_PLATFORMS).describe('Social platform'),
    impressions: z.number().describe('Number of impressions'),
    engagements: z.number().describe('Total engagements'),
    likes: z.number().describe('Number of likes'),
    comments: z.number().describe('Number of comments'),
    shares: z.number().describe('Number of shares'),
    clicks: z.number().describe('Number of clicks'),
    engagementRate: z.number().describe('Engagement rate percentage'),
    collectedAt: z.string().datetime().describe('Data collection time'),
  }).openapi({ description: 'Post analytics data' })
);

const FollowerDataSchema = registry.register(
  'FollowerData',
  z.object({
    platform: z.enum(SOCIAL_PLATFORMS).describe('Social platform'),
    date: z.string().date().describe('Date of record'),
    followerCount: z.number().describe('Total followers'),
    change: z.number().describe('Change from previous day'),
    changePercent: z.number().describe('Percentage change'),
  }).openapi({ description: 'Follower growth data' })
);

// Media schemas
const MediaSchema = registry.register(
  'Media',
  z.object({
    _id: z.string().describe('Media ID'),
    workspaceId: z.string().describe('Workspace ID'),
    filename: z.string().describe('Original filename'),
    mimeType: z.string().describe('MIME type'),
    size: z.number().describe('File size in bytes'),
    url: z.string().url().describe('Public URL'),
    thumbnails: z.record(z.string()).optional().describe('Thumbnail URLs by size'),
    uploadedBy: z.string().describe('Uploader ID'),
    createdAt: z.string().datetime().describe('Upload time'),
  }).openapi({ description: 'Media file' })
);

// Webhook schemas
const WebhookSchema = registry.register(
  'Webhook',
  z.object({
    _id: z.string().describe('Webhook ID'),
    workspaceId: z.string().describe('Workspace ID'),
    url: z.string().url().describe('Webhook endpoint URL'),
    events: z.array(z.string()).describe('Subscribed event types'),
    enabled: z.boolean().describe('Whether webhook is enabled'),
    successCount: z.number().describe('Successful deliveries'),
    failureCount: z.number().describe('Failed deliveries'),
    lastTriggeredAt: z.string().datetime().nullable().describe('Last trigger time'),
    createdAt: z.string().datetime().describe('Creation time'),
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
      status: z.enum(POST_STATUSES).optional(),
      platform: z.enum(SOCIAL_PLATFORMS).optional(),
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
      platform: z.enum(SOCIAL_PLATFORMS).optional(),
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
            file: z.string().describe('Binary file data'),
            folderId: z.string().optional().describe('Optional folder ID'),
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