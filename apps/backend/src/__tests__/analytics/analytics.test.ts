import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import testApp from './test-app';
import { PostAnalytics } from '../../models/PostAnalytics';
import { Workspace } from '../../models/Workspace';
import { User } from '../../models/User';
import { AuthTokenService } from '../../services/AuthTokenService';
import mongoose from 'mongoose';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../helpers/dbSetup';

describe('Analytics API', () => {
  let authToken: string;
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test user and workspace
    const user = new User({
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User'
    });
    await user.save();
    userId = user._id.toString();

    const workspace = new Workspace({
      name: 'Test Workspace',
      slug: 'test-workspace',
      ownerId: userId,
      members: [{ userId, role: 'owner' }]
    });
    await workspace.save();
    workspaceId = workspace._id.toString();

    authToken = AuthTokenService.generateTokenPair({
      userId,
      email: user.email,
      role: 'owner'
    }).accessToken;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    
    // Recreate user and workspace for each test
    const user = new User({
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User'
    });
    await user.save();
    userId = user._id.toString();

    const workspace = new Workspace({
      name: 'Test Workspace',
      slug: 'test-workspace',
      ownerId: userId,
      members: [{ userId, role: 'owner' }]
    });
    await workspace.save();
    workspaceId = workspace._id.toString();

    authToken = AuthTokenService.generateTokenPair({
      userId,
      email: user.email,
      role: 'owner'
    }).accessToken;
  });

  describe('GET /v1/analytics/summary', () => {
    it('returns current, previous, percentageChange for all 4 KPIs', async () => {
      // Create test data for current period
      const currentDate = new Date();
      const startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      await PostAnalytics.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        postId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        platform: 'twitter',
        impressions: 1000,
        likes: 50,
        comments: 10,
        shares: 5,
        clicks: 20,
        saves: 3,
        engagementRate: 6.5,
        linkClicks: 15,
        collectedAt: new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
        collectionAttempt: 1
      });

      // Create test data for previous period
      await PostAnalytics.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        postId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        platform: 'twitter',
        impressions: 800,
        likes: 40,
        comments: 8,
        shares: 4,
        clicks: 16,
        saves: 2,
        engagementRate: 6.25,
        linkClicks: 12,
        collectedAt: new Date(currentDate.getTime() - 45 * 24 * 60 * 60 * 1000),
        collectionAttempt: 1
      });

      const response = await request(testApp)
        .get(`/v1/analytics/summary?workspaceId=${workspaceId}&startDate=${startDate.toISOString()}&endDate=${currentDate.toISOString()}`)
        .set('Authorization', `Bearer ${authToken}`);

      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      
      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reach');
      expect(response.body.data).toHaveProperty('engagement');
      expect(response.body.data).toHaveProperty('followerGrowth');
      expect(response.body.data).toHaveProperty('postsPublished');

      expect(response.body.data.reach).toHaveProperty('current');
      expect(response.body.data.reach).toHaveProperty('previous');
      expect(response.body.data.reach).toHaveProperty('percentageChange');
    });

    it('handles empty data gracefully', async () => {
      const currentDate = new Date();
      const startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await request(testApp)
        .get(`/v1/analytics/summary?workspaceId=${workspaceId}&startDate=${startDate.toISOString()}&endDate=${currentDate.toISOString()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reach.current).toBe(1000);
      expect(response.body.data.reach.previous).toBe(800);
      expect(response.body.data.reach.percentageChange).toBe(25.0);
    });
  });
});