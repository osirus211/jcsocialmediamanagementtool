/**
 * Swagger/OpenAPI Configuration
 * 
 * API documentation configuration
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Social Media Scheduler API',
      version: '1.0.0',
      description: 'API for managing scheduled social media posts',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login',
        },
      },
      schemas: {
        Post: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Post ID',
              example: '507f1f77bcf86cd799439011',
            },
            workspaceId: {
              type: 'string',
              description: 'Workspace ID',
              example: '507f1f77bcf86cd799439012',
            },
            socialAccountId: {
              type: 'string',
              description: 'Social account ID',
              example: '507f1f77bcf86cd799439013',
            },
            platform: {
              type: 'string',
              enum: ['twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'threads', 'tiktok'],
              description: 'Social media platform',
              example: 'twitter',
            },
            content: {
              type: 'string',
              description: 'Post content',
              example: 'Check out our new product launch!',
            },
            mediaUrls: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Media URLs attached to post',
              example: ['https://example.com/image.jpg'],
            },
            scheduledAt: {
              type: 'string',
              format: 'date-time',
              description: 'Scheduled publish time',
              example: '2026-03-04T15:00:00Z',
            },
            status: {
              type: 'string',
              enum: ['scheduled', 'queued', 'publishing', 'published', 'failed'],
              description: 'Post status',
              example: 'scheduled',
            },
            queuedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Time when post was queued',
              example: '2026-03-04T14:55:00Z',
            },
            publishingStartedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Time when publishing started',
              example: '2026-03-04T15:00:00Z',
            },
            publishedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Time when post was published',
              example: '2026-03-04T15:00:05Z',
            },
            failedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Time when post failed',
              example: '2026-03-04T15:00:10Z',
            },
            failureReason: {
              type: 'string',
              description: 'Reason for failure',
              example: 'RATE_LIMIT: Rate limit exceeded',
            },
            platformPostId: {
              type: 'string',
              description: 'Platform-specific post ID',
              example: '1234567890',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2026-03-04T14:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2026-03-04T14:30:00Z',
            },
          },
        },
        PostAttempt: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Attempt ID',
              example: '507f1f77bcf86cd799439014',
            },
            postId: {
              type: 'string',
              description: 'Post ID',
              example: '507f1f77bcf86cd799439011',
            },
            platform: {
              type: 'string',
              enum: ['twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'threads', 'tiktok'],
              description: 'Social media platform',
              example: 'twitter',
            },
            attemptNumber: {
              type: 'integer',
              description: 'Attempt number',
              example: 1,
            },
            status: {
              type: 'string',
              enum: ['success', 'failed'],
              description: 'Attempt status',
              example: 'success',
            },
            error: {
              type: 'string',
              description: 'Error message if failed',
              example: 'Rate limit exceeded',
            },
            errorCode: {
              type: 'string',
              description: 'Error code if failed',
              example: 'RATE_LIMIT',
            },
            platformResponse: {
              type: 'object',
              description: 'Platform API response',
            },
            duration: {
              type: 'integer',
              description: 'Attempt duration in milliseconds',
              example: 1250,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Attempt timestamp',
              example: '2026-03-04T15:00:00Z',
            },
          },
        },
        PostStats: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total posts',
              example: 100,
            },
            scheduled: {
              type: 'integer',
              description: 'Scheduled posts',
              example: 20,
            },
            queued: {
              type: 'integer',
              description: 'Queued posts',
              example: 5,
            },
            publishing: {
              type: 'integer',
              description: 'Publishing posts',
              example: 2,
            },
            published: {
              type: 'integer',
              description: 'Published posts',
              example: 70,
            },
            failed: {
              type: 'integer',
              description: 'Failed posts',
              example: 3,
            },
          },
        },
        ApiSuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2026-03-04T15:00:00Z',
                },
                requestId: {
                  type: 'string',
                  example: 'req_1234567890',
                },
              },
            },
          },
        },
        ApiErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Validation failed',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2026-03-04T15:00:00Z',
                },
                requestId: {
                  type: 'string',
                  example: 'req_1234567890',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/**/*.ts'], // Path to API routes
};

export const swaggerSpec = swaggerJsdoc(options);
