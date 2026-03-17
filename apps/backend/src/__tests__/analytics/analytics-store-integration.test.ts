/**
 * Analytics Store Integration Tests
 * 
 * Tests for the analytics module integration
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import { PostAnalytics, MAX_POST_METRICS_DAYS } from '../../models/PostAnalytics';
import { HashtagAnalytics, MAX_HASHTAG_ANALYTICS_DAYS } from '../../models/HashtagAnalytics';
import { LinkClickAnalytics, MAX_LINK_CLICKS_DAYS } from '../../models/LinkClickAnalytics';

describe('Analytics Models Integration', () => {
  beforeAll(async () => {
    // Connect to test database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  afterAll(async () => {
    // Clean up test data
    await PostAnalytics.deleteMany({});
    await HashtagAnalytics.deleteMany({});
    await LinkClickAnalytics.deleteMany({});
  });

  it('should have correct storage limits defined', () => {
    expect(MAX_POST_METRICS_DAYS).toBe(365);
    expect(MAX_HASHTAG_ANALYTICS_DAYS).toBe(365);
    expect(MAX_LINK_CLICKS_DAYS).toBe(90);
  });

  it('should have cleanup methods on models', () => {
    expect(typeof (PostAnalytics as any).cleanup).toBe('function');
    expect(typeof (HashtagAnalytics as any).cleanup).toBe('function');
    expect(typeof (LinkClickAnalytics as any).cleanup).toBe('function');
  });

  it('should create PostAnalytics with correct engagement rate calculation', async () => {
    const postAnalytics = new PostAnalytics({
      postId: new mongoose.Types.ObjectId(),
      platform: 'twitter',
      socialAccountId: new mongoose.Types.ObjectId(),
      workspaceId: new mongoose.Types.ObjectId(),
      likes: 100,
      comments: 20,
      shares: 10,
      saves: 5,
      reach: 1000,
      impressions: 1500,
      clicks: 50,
      collectedAt: new Date(),
      collectionAttempt: 1
    });

    await postAnalytics.save();

    // Check engagement rate calculation: (100 + 20 + 10 + 5) / 1000 * 100 = 13.5%
    expect(postAnalytics.engagementRate).toBe(13.5);
    
    // Check click-through rate: 50 / 1500 * 100 = 3.33%
    expect(postAnalytics.clickThroughRate).toBeCloseTo(3.33, 2);
  });

  it('should create HashtagAnalytics with required fields', async () => {
    const hashtagAnalytics = new HashtagAnalytics({
      workspaceId: new mongoose.Types.ObjectId(),
      hashtag: 'test',
      platform: 'twitter',
      usageCount: 5,
      totalReach: 5000,
      totalImpressions: 7500,
      totalEngagement: 500,
      avgEngagementRate: 10.0,
      avgReach: 1000,
      avgImpressions: 1500,
      trendScore: 75,
      isRising: true,
      periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      periodEnd: new Date()
    });

    await hashtagAnalytics.save();

    expect(hashtagAnalytics.hashtag).toBe('test');
    expect(hashtagAnalytics.avgEngagementRate).toBe(10.0);
    expect(hashtagAnalytics.isRising).toBe(true);
  });

  it('should create LinkClickAnalytics with timing fields auto-calculated', async () => {
    const clickedAt = new Date('2024-01-15T14:30:00Z'); // Monday 2:30 PM
    
    const linkClickAnalytics = new LinkClickAnalytics({
      workspaceId: new mongoose.Types.ObjectId(),
      originalUrl: 'https://example.com',
      linkId: 'test-link-123',
      clickCount: 1,
      uniqueClicks: 1,
      platform: 'twitter',
      clickedAt: clickedAt,
      utmSource: 'twitter',
      utmMedium: 'social',
      utmCampaign: 'test-campaign'
    });

    await linkClickAnalytics.save();

    // Check auto-calculated timing fields
    expect(linkClickAnalytics.hourOfDay).toBe(14); // 2 PM
    expect(linkClickAnalytics.dayOfWeek).toBe(1); // Monday
    expect(linkClickAnalytics.utmSource).toBe('twitter');
  });
});
