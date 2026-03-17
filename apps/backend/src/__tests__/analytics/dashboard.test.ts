// @ts-nocheck
/**
 * Dashboard Analytics Tests
 * 
 * Tests for the new P6 analytics dashboard functionality
 */

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { User } from '../../models/User';
import { Workspace } from '../../models/Workspace';
import { PostAnalytics } from '../../models/PostAnalytics';
import { HashtagAnalytics } from '../../models/HashtagAnalytics';
import { CompetitorAnalytics } from '../../models/CompetitorAnalytics';
import { LinkClickAnalytics } from '../../models/LinkClickAnalytics';
import { generateTestToken as generateAccessToken } from '../../__tests__/helpers/auth';

describe('Analytics Dashboard API', () => {
  let user: any;
  let workspace: any;
  let accessToken: string;

  beforeAll(async () => {
    // Create test user and workspace
    user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
    });

    workspace = await Workspace.create({
      name: 'Test Workspace',
      ownerId: user._id,
      members: [{
        userId: user._id,
        role: 'owner',
        permissions: ['VIEW_ANALYTICS', 'EXPORT_ANALYTICS'],
        joinedAt: new Date(),
      }],
    });

    accessToken = generateAccessToken(user._id.toString(), workspace._id.toString());

    // Create test analytics data
    await PostAnalytics.create({
      workspaceId: workspace._id,
      postId: new mongoose.Types.ObjectId(),
      platform: 'twitter',
      likes: 100,
      comments: 20,
      shares: 10,
      reach: 1000,
      impressions: 1500,
      engagementRate: 13.0,
      collectedAt: new Date(),
      collectionAttempt: 1,
    });

    await HashtagAnalytics.create({
      workspaceId: workspace._id,
      hashtag: 'test',
      platform: 'twitter',
      usageCount: 5,
      avgEngagementRate: 12.5,
      trendScore: 75,
      isRising: true,
      totalReach: 5000,
      totalImpressions: 7500,
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
    });

    await CompetitorAnalytics.create({
      workspaceId: workspace._id,
      competitorName: 'Test Competitor',
      platform: 'twitter',
      accountHandle: '@competitor',
      followerCount: 10000,
      avgEngagementRate: 8.5,
      avgPostsPerDay: 2.5,
      snapshotDate: new Date(),
    });

    await LinkClickAnalytics.create({
      workspaceId: workspace._id,
      linkId: 'test-link-123',
      originalUrl: 'https://example.com',
      platform: 'twitter',
      clickCount: 50,
      uniqueClicks: 45,
      clickedAt: new Date(),
      hourOfDay: 14,
      dayOfWeek: 2,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await PostAnalytics.deleteMany({});
    await HashtagAnalytics.deleteMany({});
    await CompetitorAnalytics.deleteMany({});
    await LinkClickAnalytics.deleteMany({});
  });

  describe('GET /api/v1/analytics/dashboard', () => {
    it('should return unified dashboard analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('platforms');
      expect(response.body.data).toHaveProperty('growth');
      expect(response.body.data).toHaveProperty('topPosts');
      expect(response.body.data).toHaveProperty('hashtags');
      expect(response.body.data).toHaveProperty('bestTimes');
      expect(response.body.data).toHaveProperty('linkClicks');
      expect(response.body.data).toHaveProperty('competitors');
      expect(response.body.data).toHaveProperty('generatedAt');
    });

    it('should filter by platform when specified', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard?platform=twitter')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
    });
  });

  describe('GET /api/v1/analytics/hashtags/performance', () => {
    it('should return hashtag analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/hashtags/performance')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const hashtag = response.body.data[0];
        expect(hashtag).toHaveProperty('hashtag');
        expect(hashtag).toHaveProperty('platform');
        expect(hashtag).toHaveProperty('usageCount');
        expect(hashtag).toHaveProperty('avgEngagementRate');
        expect(hashtag).toHaveProperty('trendScore');
      }
    });

    it('should sort hashtags by engagement by default', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/hashtags/performance?sortBy=engagement')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/best-times/heatmap', () => {
    it('should return best posting times heatmap data', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/best-times/heatmap')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Should have data for all 7 days x 24 hours = 168 time slots
      expect(response.body.data.length).toBe(168);
      
      if (response.body.data.length > 0) {
        const timeSlot = response.body.data[0];
        expect(timeSlot).toHaveProperty('day');
        expect(timeSlot).toHaveProperty('hour');
        expect(timeSlot).toHaveProperty('engagementScore');
        expect(timeSlot).toHaveProperty('postCount');
        expect(timeSlot.day).toBeGreaterThanOrEqual(0);
        expect(timeSlot.day).toBeLessThan(7);
        expect(timeSlot.hour).toBeGreaterThanOrEqual(0);
        expect(timeSlot.hour).toBeLessThan(24);
      }
    });
  });

  describe('GET /api/v1/analytics/link-clicks', () => {
    it('should return link click analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/link-clicks')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const clickData = response.body.data[0];
        expect(clickData).toHaveProperty('totalClicks');
        expect(clickData).toHaveProperty('uniqueClicks');
        expect(clickData).toHaveProperty('conversions');
        expect(clickData).toHaveProperty('conversionRate');
      }
    });

    it('should group by different dimensions', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/link-clicks?groupBy=hour')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/competitors', () => {
    it('should return competitor analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/competitors')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const competitor = response.body.data[0];
        expect(competitor).toHaveProperty('competitorName');
        expect(competitor).toHaveProperty('platform');
        expect(competitor).toHaveProperty('followerCount');
        expect(competitor).toHaveProperty('avgEngagementRate');
        expect(competitor).toHaveProperty('avgPostsPerDay');
      }
    });
  });

  describe('POST /api/v1/analytics/export', () => {
    it('should export analytics report as PDF', async () => {
      const exportOptions = {
        format: 'pdf',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        title: 'Test Report',
        includeOverview: true,
        includePostMetrics: true,
      };

      const response = await request(app)
        .post('/api/v1/analytics/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .send(exportOptions)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('fileName');
      expect(response.body.data).toHaveProperty('fileSize');
      expect(response.body.data).toHaveProperty('downloadUrl');
      expect(response.body.data.fileName).toMatch(/\.pdf$/);
    });

    it('should export analytics report as CSV', async () => {
      const exportOptions = {
        format: 'csv',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        title: 'Test CSV Report',
        includeOverview: true,
        includePostMetrics: true,
      };

      const response = await request(app)
        .post('/api/v1/analytics/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .send(exportOptions)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('fileName');
      expect(response.body.data.fileName).toMatch(/\.csv$/);
    });

    it('should validate export options', async () => {
      const invalidOptions = {
        format: 'invalid',
        startDate: 'invalid-date',
        endDate: new Date().toISOString(),
      };

      await request(app)
        .post('/api/v1/analytics/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Workspace-ID', workspace._id.toString())
        .send(invalidOptions)
        .expect(400);
    });
  });

  describe('Authorization', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('X-Workspace-ID', workspace._id.toString())
        .expect(401);
    });

    it('should require workspace access', async () => {
      await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400); // Missing workspace header
    });

    it('should require VIEW_ANALYTICS permission', async () => {
      // Create user without analytics permission
      const limitedUser = await User.create({
        email: 'limited@example.com',
        password: 'password123',
        firstName: 'Limited',
        lastName: 'User',
        isEmailVerified: true,
      });

      const limitedWorkspace = await Workspace.create({
        name: 'Limited Workspace',
        ownerId: limitedUser._id,
        members: [{
          userId: limitedUser._id,
          role: 'member',
          permissions: [], // No analytics permission
          joinedAt: new Date(),
        }],
      });

      const limitedToken = generateAccessToken(limitedUser._id.toString(), workspace._id.toString());

      await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${limitedToken}`)
        .set('X-Workspace-ID', limitedWorkspace._id.toString())
        .expect(403);

      // Cleanup
      await User.findByIdAndDelete(limitedUser._id);
      await Workspace.findByIdAndDelete(limitedWorkspace._id);
    });
  });
});
