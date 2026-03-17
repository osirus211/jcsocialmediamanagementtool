const request = require('supertest');
import app from '../../app';
import { PostAnalytics } from '../../models/PostAnalytics';
import { ScheduledPost } from '../../models/ScheduledPost';
import { SocialAccount } from '../../models/SocialAccount';
import { Workspace } from '../../models/Workspace';
import { User } from '../../models/User';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';
import { generateTestToken } from '../helpers/auth';

describe('POST METRICS ENDPOINTS', () => {
  let testUser: any;
  let testWorkspace: any;
  let testAccount: any;
  let testPost: any;
  let authToken: string;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      password: 'TestPassword123!'
    });

    // Create test workspace
    testWorkspace = await Workspace.create({
      name: 'Test Workspace',
      slug: 'test-workspace',
      ownerId: testUser._id
    });

    // Create workspace membership for the user (as owner)
    const { WorkspaceMember, MemberRole } = await import('../../models/WorkspaceMember');
    await WorkspaceMember.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      role: MemberRole.OWNER,
      isActive: true
    });

    // Create test social account
    testAccount = await SocialAccount.create({
      platform: 'twitter',
      platformAccountId: 'test123',
      username: 'testuser',
      accountName: 'Test User',
      provider: 'twitter',
      providerUserId: 'test123',
      workspaceId: testWorkspace._id,
      accessToken: 'encrypted_token'
    });

    // Create test post
    testPost = await ScheduledPost.create({
      content: 'Test post content',
      platform: 'twitter',
      socialAccountId: testAccount._id,
      workspaceId: testWorkspace._id,
      createdBy: testUser._id,
      status: 'published',
      scheduledAt: new Date(),
      publishedAt: new Date(),
      platformPostId: 'tweet123'
    });

    authToken = generateTestToken(testUser._id, testWorkspace._id);
  });

  describe('GET /v1/analytics/posts', () => {
    beforeEach(async () => {
      // Create test analytics
      await PostAnalytics.create({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 100,
        comments: 20,
        shares: 15,
        reach: 1000,
        impressions: 2000,
        saves: 5,
        engagementRate: 14.0,
        performanceScore: 75,
        collectedAt: new Date(),
        collectionAttempt: 1
      });
    });

    it('returns posts with all 6 metrics + score + engagementRate', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .timeout(10000); // 10 second timeout

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const post = response.body.data[0];
      expect(post).toHaveProperty('likes', 100);
      expect(post).toHaveProperty('comments', 20);
      expect(post).toHaveProperty('shares', 15);
      expect(post).toHaveProperty('reach', 1000);
      expect(post).toHaveProperty('impressions', 2000);
      expect(post).toHaveProperty('saves', 5);
      expect(post).toHaveProperty('engagementRate', 14.0);
      expect(post).toHaveProperty('performanceScore', 75);
    });

    it('filters by platforms[] query param', async () => {
      await PostAnalytics.create({
        postId: testPost._id,
        platform: 'facebook',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 50,
        comments: 10,
        shares: 5,
        reach: 500,
        impressions: 1000,
        saves: 2,
        engagementRate: 13.4,
        performanceScore: 60,
        collectedAt: new Date(),
        collectionAttempt: 2
      });

      const response = await request(app)
        .get('/api/v1/analytics/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          platforms: 'twitter',
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].platform).toBe('twitter');
    });

    it('→ 422 when date range exceeds 365 days', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          startDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(response.status).toBe(422);
      expect(response.body.code).toBe('INVALID_DATE_RANGE');
    });

    it('→ 401 unauthenticated', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /v1/analytics/posts/:postId', () => {
    beforeEach(async () => {
      await PostAnalytics.create({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 100,
        comments: 20,
        shares: 15,
        reach: 1000,
        impressions: 2000,
        saves: 5,
        engagementRate: 14.0,
        performanceScore: 75,
        collectedAt: new Date(),
        collectionAttempt: 1
      });
    });

    it('returns full metrics including history array', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/posts/${testPost._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('likes', 100);
      expect(response.body.data).toHaveProperty('performanceScore', 75);
      expect(response.body.data).toHaveProperty('post');
      expect(response.body.data).toHaveProperty('history');
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });

    it('→ 404 when postId does not exist', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/v1/analytics/posts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('POST_NOT_FOUND');
    });

    it('→ 401 unauthenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/posts/${testPost._id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /v1/analytics/posts/top', () => {
    beforeEach(async () => {
      await PostAnalytics.create({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 100,
        comments: 20,
        shares: 15,
        reach: 1000,
        impressions: 2000,
        saves: 5,
        engagementRate: 14.0,
        performanceScore: 75,
        collectedAt: new Date(),
        collectionAttempt: 1
      });
    });

    it('returns max 10 posts by default, sorted by engagementRate desc', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/top')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].engagementRate).toBe(14.0);
    });

    it('limit param respected up to max 50', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/top')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          limit: '5',
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('→ 401 unauthenticated', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/top');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /v1/analytics/posts/worst', () => {
    beforeEach(async () => {
      await PostAnalytics.create({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 5,
        comments: 1,
        shares: 0,
        reach: 100,
        impressions: 200,
        saves: 0,
        engagementRate: 6.0,
        performanceScore: 25, // Below 40
        collectedAt: new Date(),
        collectionAttempt: 1
      });
    });

    it('returns only posts with performanceScore < 40', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/worst')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].performanceScore).toBeLessThan(40);
      expect(response.body.data[0]).toHaveProperty('suggestion');
      expect(typeof response.body.data[0].suggestion).toBe('string');
    });

    it('returns empty array when all posts score ≥ 40', async () => {
      // Update the post to have a good score
      await PostAnalytics.findOneAndUpdate(
        { postId: testPost._id },
        { performanceScore: 75 }
      );

      const response = await request(app)
        .get('/api/v1/analytics/posts/worst')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('→ 401 unauthenticated', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/worst');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /v1/analytics/posts/compare', () => {
    let testPost2: any;

    beforeEach(async () => {
      testPost2 = await ScheduledPost.create({
        content: 'Second test post',
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        createdBy: testUser._id,
        status: 'published',
        scheduledAt: new Date(),
        publishedAt: new Date(),
        platformPostId: 'tweet456'
      });

      await PostAnalytics.create({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 100,
        comments: 20,
        shares: 15,
        reach: 1000,
        impressions: 2000,
        saves: 5,
        engagementRate: 14.0,
        performanceScore: 75,
        collectedAt: new Date(),
        collectionAttempt: 1
      });

      await PostAnalytics.create({
        postId: testPost2._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 50,
        comments: 10,
        shares: 5,
        reach: 500,
        impressions: 1000,
        saves: 2,
        engagementRate: 13.4,
        performanceScore: 60,
        collectedAt: new Date(),
        collectionAttempt: 1
      });
    });

    it('returns metrics for 2 valid postIds', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          postIds: `${testPost._id},${testPost2._id}`
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('performanceScore');
      expect(response.body.data[1]).toHaveProperty('performanceScore');
    });

    it('→ 422 when fewer than 2 postIds provided', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          postIds: testPost._id.toString()
        });

      expect(response.status).toBe(422);
      expect(response.body.code).toBe('INVALID_POST_COUNT');
    });

    it('→ 422 when more than 4 postIds provided', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-workspace-id', testWorkspace._id.toString())
        .query({
          postIds: `${testPost._id},${testPost2._id},${testPost._id},${testPost2._id},${testPost._id}`
        });

      expect(response.status).toBe(422);
      expect(response.body.code).toBe('INVALID_POST_COUNT');
    });

    it('→ 401 unauthenticated', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/posts/compare');

      expect(response.status).toBe(401);
    });
  });

  describe('engagement rate formula', () => {
    it('engagementRate = (likes+comments+shares+saves) / reach * 100', async () => {
      const analytics = new PostAnalytics({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 10,
        comments: 5,
        shares: 3,
        saves: 2,
        reach: 100, // Total engagement: 20, Rate: 20/100 * 100 = 20%
        impressions: 200,
        collectedAt: new Date(),
        collectionAttempt: 1
      });

      await analytics.save();
      expect(analytics.engagementRate).toBe(20);
    });

    it('engagementRate = 0 when reach is 0 (no divide-by-zero)', async () => {
      const analytics = new PostAnalytics({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 10,
        comments: 5,
        shares: 3,
        saves: 2,
        reach: 0, // Should not divide by zero
        impressions: 200,
        collectedAt: new Date(),
        collectionAttempt: 1
      });

      await analytics.save();
      expect(analytics.engagementRate).toBe(0);
    });

    it('engagementRate rounded to 2 decimal places', async () => {
      const analytics = new PostAnalytics({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 7,
        comments: 0,
        shares: 0,
        saves: 0,
        reach: 300, // 7/300 * 100 = 2.333... should round to 2.33
        impressions: 600,
        collectedAt: new Date(),
        collectionAttempt: 1
      });

      await analytics.save();
      expect(analytics.engagementRate).toBe(2.33);
    });
  });

  describe('performance score', () => {
    it('score is between 0 and 100', async () => {
      const analytics = await PostAnalytics.create({
        postId: testPost._id,
        platform: 'twitter',
        socialAccountId: testAccount._id,
        workspaceId: testWorkspace._id,
        likes: 100,
        comments: 20,
        shares: 15,
        reach: 1000,
        impressions: 2000,
        saves: 5,
        engagementRate: 14.0,
        performanceScore: 75,
        collectedAt: new Date(),
        collectionAttempt: 1
      });

      expect(analytics.performanceScore).toBeGreaterThanOrEqual(0);
      expect(analytics.performanceScore).toBeLessThanOrEqual(100);
    });
  });
});