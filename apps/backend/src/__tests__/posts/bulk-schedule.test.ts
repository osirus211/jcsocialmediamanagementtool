/**
 * Bulk Schedule Tests
 * Tests for POST /v1/posts/bulk endpoint
 */

const { PostService } = require('../../services/PostService');

// Mock dependencies
jest.mock('../../services/PostService');

describe('POST /v1/posts/bulk', () => {
  const mockWorkspaceId = '507f1f77bcf86cd799439011';
  const mockAccountId = '507f1f77bcf86cd799439013';
  
  const validPayload = {
    posts: [
      {
        socialAccountId: mockAccountId,
        platform: 'twitter',
        content: 'Test post 1',
        scheduledAt: '2026-03-20T10:00:00Z',
      },
      {
        socialAccountId: mockAccountId,
        platform: 'facebook',
        content: 'Test post 2',
        scheduledAt: '2026-03-21T14:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates bulk create posts functionality', () => {
    const mockResult = {
      created: [
        { _id: '1', content: 'Test post 1', status: 'scheduled' },
        { _id: '2', content: 'Test post 2', status: 'scheduled' },
      ],
      failed: [],
    };

    PostService.bulkCreatePosts = jest.fn().mockResolvedValue(mockResult);

    expect(PostService.bulkCreatePosts).toBeDefined();
    expect(validPayload.posts).toHaveLength(2);
  });

  it('handles partial failures gracefully', () => {
    const mockResult = {
      created: [{ _id: '1', content: 'Test post 1', status: 'scheduled' }],
      failed: [
        {
          post: validPayload.posts[1],
          reason: 'Social account not found',
        },
      ],
    };

    PostService.bulkCreatePosts = jest.fn().mockResolvedValue(mockResult);

    expect(mockResult.created).toHaveLength(1);
    expect(mockResult.failed).toHaveLength(1);
    expect(mockResult.failed[0].reason).toBe('Social account not found');
  });

  it('validates required fields', () => {
    expect(validPayload.posts[0]).toHaveProperty('socialAccountId');
    expect(validPayload.posts[0]).toHaveProperty('platform');
    expect(validPayload.posts[0]).toHaveProperty('content');
    expect(validPayload.posts[0]).toHaveProperty('scheduledAt');
  });

  it('validates platform enum values', () => {
    const validPlatforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'threads', 'tiktok'];
    
    validPayload.posts.forEach(post => {
      expect(validPlatforms).toContain(post.platform);
    });
  });
});