import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../models/Post');
jest.mock('../../services/SchedulingService');

import { Post } from '../../models/Post';
import { SchedulingService } from '../../services/SchedulingService';

describe('Post Scheduling Properties', () => {
  let schedulingService: SchedulingService;

  beforeEach(() => {
    jest.clearAllMocks();
    schedulingService = new SchedulingService();
  });

  describe('Scheduled Date Properties', () => {
    it('scheduledAt must always be in the future when creating scheduled posts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date() }),
          fc.string({ minLength: 1, maxLength: 280 }),
          fc.uuid(),
          async (futureDate, content, workspaceId) => {
            const postData = {
              content,
              workspaceId,
              scheduledAt: futureDate,
              platforms: ['twitter']
            };

            // Mock Post.create to return the scheduled post
            (Post.create as jest.Mock).mockResolvedValue({
              ...postData,
              id: fc.sample(fc.uuid(), 1)[0],
              status: 'SCHEDULED'
            });

            const result = await schedulingService.schedulePost(postData);
            
            expect(new Date(result.scheduledAt).getTime()).toBeGreaterThan(Date.now());
          }
        )
      );
    });

    // Concrete example for sanity check
    it('concrete example: scheduling post for tomorrow should succeed', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const postData = {
        content: 'Test post',
        workspaceId: 'workspace-123',
        scheduledAt: tomorrow,
        platforms: ['twitter']
      };

      (Post.create as jest.Mock).mockResolvedValue({
        ...postData,
        id: 'post-123',
        status: 'SCHEDULED'
      });

      const result = await schedulingService.schedulePost(postData);
      expect(result.status).toBe('SCHEDULED');
    });
  });

  describe('Platform Conflict Properties', () => {
    it('posts with same workspaceId but different platforms never conflict on queue slots', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram'), { minLength: 1, maxLength: 3 }),
          fc.array(fc.constantFrom('twitter', 'linkedin', 'instagram'), { minLength: 1, maxLength: 3 }),
          fc.date({ min: new Date() }),
          async (workspaceId, platforms1, platforms2, scheduledAt) => {
            // Ensure different platform sets
            if (JSON.stringify(platforms1.sort()) === JSON.stringify(platforms2.sort())) {
              return; // Skip if platforms are identical
            }

            const post1Data = {
              content: 'Post 1',
              workspaceId,
              platforms: platforms1,
              scheduledAt
            };

            const post2Data = {
              content: 'Post 2', 
              workspaceId,
              platforms: platforms2,
              scheduledAt
            };

            (Post.create as jest.Mock)
              .mockResolvedValueOnce({ ...post1Data, id: 'post-1' })
              .mockResolvedValueOnce({ ...post2Data, id: 'post-2' });

            const result1 = await schedulingService.schedulePost(post1Data);
            const result2 = await schedulingService.schedulePost(post2Data);

            // Both posts should be created successfully without conflicts
            expect(result1.id).toBeDefined();
            expect(result2.id).toBeDefined();
            expect(result1.id).not.toBe(result2.id);
          }
        )
      );
    });
  });

  describe('Bulk Scheduling Properties', () => {
    it('bulk scheduling N posts always creates exactly N posts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.uuid(),
          async (n, workspaceId) => {
            const posts = Array.from({ length: n }, (_, i) => ({
              content: `Post ${i + 1}`,
              workspaceId,
              platforms: ['twitter'],
              scheduledAt: new Date(Date.now() + (i + 1) * 60000) // 1 minute apart
            }));

            // Mock Post.create to return posts with IDs
            (Post.create as jest.Mock).mockImplementation((postData) => 
              Promise.resolve({ ...postData, id: `post-${Math.random()}` })
            );

            const results = await schedulingService.bulkSchedulePosts(posts);
            
            expect(results).toHaveLength(n);
            expect(results.every(post => post.id)).toBe(true);
          }
        )
      );
    });
  });

  describe('Rescheduling Properties', () => {
    it('rescheduling a post never changes its content — only scheduledAt', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 280 }),
          fc.date({ min: new Date() }),
          fc.date({ min: new Date(Date.now() + 86400000) }), // At least 1 day from now
          async (postId, originalContent, originalDate, newDate) => {
            const originalPost = {
              id: postId,
              content: originalContent,
              scheduledAt: originalDate,
              platforms: ['twitter']
            };

            (Post.findById as jest.Mock).mockResolvedValue(originalPost);
            (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue({
              ...originalPost,
              scheduledAt: newDate
            });

            const result = await schedulingService.reschedulePost(postId, newDate);
            
            expect(result.content).toBe(originalContent);
            expect(result.scheduledAt).toEqual(newDate);
            expect(result.platforms).toEqual(originalPost.platforms);
          }
        )
      );
    });
  });

  describe('Post Status Transition Properties', () => {
    it('post status transitions are always valid: DRAFT→SCHEDULED→PUBLISHED, never backwards', async () => {
      const validTransitions = {
        'DRAFT': ['SCHEDULED', 'PUBLISHED'],
        'SCHEDULED': ['PUBLISHED', 'FAILED'],
        'PUBLISHED': ['PUBLISHED'], // Can stay published
        'FAILED': ['SCHEDULED'] // Can retry
      };

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'),
          fc.constantFrom('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'),
          async (fromStatus, toStatus) => {
            const postId = fc.sample(fc.uuid(), 1)[0];
            
            (Post.findById as jest.Mock).mockResolvedValue({
              id: postId,
              status: fromStatus
            });

            const isValidTransition = validTransitions[fromStatus]?.includes(toStatus) || false;
            
            if (isValidTransition) {
              (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue({
                id: postId,
                status: toStatus
              });
              
              const result = await schedulingService.updatePostStatus(postId, toStatus);
              expect(result.status).toBe(toStatus);
            } else {
              // Invalid transitions should throw
              await expect(schedulingService.updatePostStatus(postId, toStatus))
                .rejects.toThrow();
            }
          }
        )
      );
    });
  });

  describe('Platform Character Limit Properties', () => {
    it('character limits per platform always enforced', async () => {
      const platformLimits = {
        'twitter': 280,
        'linkedin': 3000,
        'instagram': 2200
      };

      await fc.assert(
        fc.asyncProperty(
          fc.string({ maxLength: 5000 }),
          fc.constantFrom('twitter', 'linkedin', 'instagram'),
          async (content, platform) => {
            const limit = platformLimits[platform];
            const postData = {
              content,
              platforms: [platform],
              workspaceId: fc.sample(fc.uuid(), 1)[0]
            };

            if (content.length <= limit) {
              (Post.create as jest.Mock).mockResolvedValue({
                ...postData,
                id: fc.sample(fc.uuid(), 1)[0]
              });
              
              const result = await schedulingService.createPost(postData);
              expect(result.id).toBeDefined();
            } else {
              // Content exceeding limit should be rejected
              await expect(schedulingService.createPost(postData))
                .rejects.toThrow(/character limit/i);
            }
          }
        )
      );
    });

    // Concrete examples for sanity check
    it('concrete example: Twitter post under 280 chars should succeed', async () => {
      const shortContent = 'This is a short tweet';
      const postData = {
        content: shortContent,
        platforms: ['twitter'],
        workspaceId: 'workspace-123'
      };

      (Post.create as jest.Mock).mockResolvedValue({
        ...postData,
        id: 'post-123'
      });

      const result = await schedulingService.createPost(postData);
      expect(result.id).toBe('post-123');
    });
  });
});