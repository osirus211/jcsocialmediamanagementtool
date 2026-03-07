# Phase 7: Post Analytics Collection System

## Overview

Automated system for collecting engagement metrics from platform APIs for all published posts.

## Architecture

```
Post Published
  ↓
Analytics Scheduler (every 5 min)
  ↓
Schedule Collection Jobs
  ↓
Analytics Collection Queue
  ↓
Analytics Collector Worker
  ↓
Platform Analytics Adapters
  ↓
Save to PostAnalytics Model
  ↓
Dashboard Data Available
```

## Collection Schedule

Analytics are collected at strategic intervals to capture engagement patterns:

| Time After Publish | Collection Attempt | Purpose |
|--------------------|-------------------|---------|
| 30 minutes | 1 | Early engagement |
| 6 hours | 2 | First day performance |
| 12 hours | 3 | Half-day metrics |
| 18 hours | 4 | Three-quarter day |
| 1 day | 5 | Full day performance |
| 2 days | 6 | Weekend effect |
| 3 days | 7 | Mid-week check |
| 4 days | 8 | Extended engagement |
| 5 days | 9 | Week approach |
| 6 days | 10 | Almost week |
| 7 days | 11 | Full week performance |
| 14 days | 12 | Two-week milestone |
| 21 days | 13 | Three-week check |
| 30 days | 14 | Final collection |

## Data Model

### PostAnalytics Schema

```typescript
{
  postId: ObjectId,              // Reference to ScheduledPost
  platform: string,              // facebook, instagram, twitter, etc.
  socialAccountId: ObjectId,     // Reference to SocialAccount
  workspaceId: ObjectId,         // Reference to Workspace
  
  // Engagement metrics
  likes: number,
  comments: number,
  shares: number,
  impressions: number,
  clicks: number,
  saves: number,                 // Instagram, LinkedIn
  retweets: number,              // Twitter
  views: number,                 // TikTok, YouTube
  
  // Computed metrics
  engagementRate: number,        // (likes + comments + shares) / impressions * 100
  clickThroughRate: number,      // clicks / impressions * 100
  
  // Collection metadata
  collectedAt: Date,
  collectionAttempt: number,     // 1-14
  
  // Platform-specific data
  platformData: Object,
  
  createdAt: Date,
  updatedAt: Date
}
```

## Platform Analytics Adapters

### Facebook Analytics Adapter

**API**: Facebook Graph API v18.0

**Metrics Collected**:
- Likes (summary count)
- Comments (summary count)
- Shares (count)
- Impressions (post_impressions insight)
- Clicks (post_clicks insight)
- Engaged Users (post_engaged_users insight)

**API Call**:
```
GET /{post-id}?fields=likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_clicks,post_engaged_users)
```

### Instagram Analytics Adapter

**API**: Instagram Graph API v18.0

**Metrics Collected**:
- Likes
- Comments
- Shares
- Impressions
- Saves
- Reach
- Engagement

**API Call**:
```
GET /{media-id}/insights?metric=engagement,impressions,reach,saved,likes,comments,shares
```

### Twitter Analytics Adapter

**API**: Twitter API v2

**Metrics Collected**:
- Likes (like_count)
- Retweets (retweet_count)
- Replies (reply_count)
- Quotes (quote_count)
- Impressions (impression_count)
- URL Clicks (url_link_clicks)
- Profile Clicks (user_profile_clicks)

**API Call**:
```
GET /2/tweets/{id}?tweet.fields=public_metrics,non_public_metrics,organic_metrics
```

### LinkedIn Analytics Adapter

**API**: LinkedIn API v2

**Metrics Collected**:
- Likes (totalLikes)
- Comments (totalComments)
- Shares (totalShares)
- Impressions (impressionCount)
- Clicks (clickCount)

**API Calls**:
```
GET /v2/socialActions/{share-id}
GET /v2/organizationalEntityShareStatistics?q=organizationalEntity
```

### TikTok Analytics Adapter

**API**: TikTok Open API v2

**Metrics Collected**:
- Likes (like_count)
- Comments (comment_count)
- Shares (share_count)
- Views (view_count)
- Duration

**API Call**:
```
POST /v2/video/query/
{
  "filters": { "video_ids": ["..."] },
  "fields": ["like_count", "comment_count", "share_count", "view_count"]
}
```

## Analytics Collection Queue

**Queue Name**: `analytics-collection-queue`

**Job Data**:
```typescript
{
  postId: string,
  platform: string,
  socialAccountId: string,
  workspaceId: string,
  platformPostId: string,
  publishedAt: Date,
  collectionAttempt: number,
  correlationId: string
}
```

**Retry Strategy**:
- Attempts: 3
- Backoff: Exponential (10s, 100s, 1000s)
- Keep completed: 7 days
- Keep failed: 30 days

## Analytics Collector Worker

**Concurrency**: 3 jobs simultaneously

**Process**:
1. Fetch social account with access token
2. Get platform-specific analytics adapter
3. Call platform API to collect metrics
4. Calculate engagement rate
5. Save analytics to database
6. Record Prometheus metrics

**Error Handling**:
- API failures: Retry with exponential backoff
- Token expired: Skip and log error
- Rate limits: Respect platform limits
- Network errors: Retry automatically

## Analytics Scheduler Service

**Check Interval**: Every 5 minutes

**Process**:
1. Find published posts from last 30 days
2. Filter posts without analytics scheduled
3. Schedule 14 collection jobs per post
4. Mark post as analytics scheduled

**Filters**:
- Status: PUBLISHED
- Published within: Last 30 days
- Has platformPostId: Yes
- Analytics scheduled: No

## Dashboard Data Service

### Top Posts

Get top performing posts by engagement metrics:

```typescript
getTopPosts({
  workspaceId: string,
  platform?: string,
  limit?: number,
  sortBy?: 'likes' | 'comments' | 'shares' | 'impressions' | 'engagementRate',
  dateFrom?: Date,
  dateTo?: Date
})
```

### Engagement Trends

Get engagement trends over time:

```typescript
getEngagementTrends({
  workspaceId: string,
  platform?: string,
  dateFrom: Date,
  dateTo: Date,
  interval?: 'day' | 'week' | 'month'
})
```

### Platform Performance

Compare performance across platforms:

```typescript
getPlatformPerformance({
  workspaceId: string,
  dateFrom?: Date,
  dateTo?: Date
})
```

### Analytics Summary

Get overall analytics summary:

```typescript
getAnalyticsSummary({
  workspaceId: string,
  dateFrom?: Date,
  dateTo?: Date
})
```

## Prometheus Metrics

```
# Collection attempts
analytics_collection_total{platform="facebook",status="success"}

# Successful collections
analytics_collection_success{platform="facebook"}

# Failed collections
analytics_collection_failure{platform="facebook",error_type="api_error"}

# API latency
analytics_api_latency_ms{platform="facebook"}

# Collection attempt number
analytics_collection_attempt{post_id="...",platform="facebook"}

# Engagement metrics
analytics_engagement_rate{platform="facebook",workspace_id="..."}
analytics_impressions_total{platform="facebook",workspace_id="..."}
analytics_likes_total{platform="facebook",workspace_id="..."}
analytics_comments_total{platform="facebook",workspace_id="..."}
analytics_shares_total{platform="facebook",workspace_id="..."}
```

## Database Indexes

```typescript
// Compound indexes
{ postId: 1, collectedAt: -1 }
{ workspaceId: 1, collectedAt: -1 }
{ platform: 1, collectedAt: -1 }
{ postId: 1, collectionAttempt: 1 } // unique

// Single field indexes
{ postId: 1 }
{ platform: 1 }
{ socialAccountId: 1 }
{ workspaceId: 1 }
{ collectedAt: 1 }
```

## API Endpoints (Future)

```
GET /api/v1/analytics/top-posts
- Get top performing posts

GET /api/v1/analytics/trends
- Get engagement trends

GET /api/v1/analytics/platform-performance
- Get platform comparison

GET /api/v1/analytics/summary
- Get analytics summary

GET /api/v1/analytics/posts/:postId/history
- Get analytics history for specific post
```

## Testing

### Manual Collection Trigger

```typescript
import { analyticsCollectionQueue } from './queue/AnalyticsCollectionQueue';

await analyticsCollectionQueue.addCollectionJob({
  postId: 'post_id',
  platform: 'facebook',
  socialAccountId: 'account_id',
  workspaceId: 'workspace_id',
  platformPostId: 'platform_post_id',
  publishedAt: new Date(),
  collectionAttempt: 1,
  correlationId: 'test-collection',
});
```

### Check Worker Status

```typescript
import { analyticsCollectorWorker } from './workers/AnalyticsCollectorWorker';

const status = analyticsCollectorWorker.getStatus();
console.log(status);
// { isRunning: true, concurrency: 3, metrics: {...} }
```

### View Metrics

```bash
curl http://localhost:3000/metrics | grep analytics_
```

## Error Handling

### API Rate Limits

Each platform has rate limits:
- Facebook: 200 calls/hour/user
- Instagram: 200 calls/hour/user
- Twitter: 300 calls/15min/app
- LinkedIn: 100 calls/day/user
- TikTok: 100 calls/day/user

Worker respects these limits with:
- Exponential backoff on rate limit errors
- Retry after rate limit reset
- Distributed across multiple workers

### Token Expiration

If access token is expired:
- Collection job fails
- Error logged with details
- Job retried (may succeed if token refreshed)
- After 3 failures, moved to DLQ

### Platform API Changes

If platform API changes:
- Adapter catches errors
- Logs detailed error information
- Returns partial data if possible
- Alerts sent for investigation

## Performance Considerations

### Collection Frequency

14 collections per post over 30 days:
- 1000 posts/day = 14,000 collections/month
- Average 466 collections/day
- ~19 collections/hour
- Well within API rate limits

### Database Growth

Analytics storage:
- ~500 bytes per analytics record
- 14 records per post
- 1000 posts/day = 7MB/day
- ~210MB/month
- ~2.5GB/year

### Worker Concurrency

3 concurrent jobs:
- Average collection time: 2-5 seconds
- Throughput: 36-90 collections/minute
- More than sufficient for load

## Future Enhancements

1. **Real-time Analytics**
   - WebSocket updates for live metrics
   - Real-time dashboard updates

2. **Predictive Analytics**
   - ML-based engagement prediction
   - Optimal posting time recommendations

3. **Comparative Analytics**
   - Competitor benchmarking
   - Industry averages

4. **Custom Metrics**
   - User-defined KPIs
   - Custom engagement formulas

5. **Export Capabilities**
   - CSV/Excel export
   - PDF reports
   - Scheduled email reports

## Related Documentation

- [Phase 4: Publishing Pipeline](./PHASE_4_REFACTORING_COMPLETE.md)
- [Phase 5: Media Upload Pipeline](./PHASE_5_IMPLEMENTATION_COMPLETE.md)
- [Phase 6: Connection Health Monitoring](./PHASE_6_IMPLEMENTATION_COMPLETE.md)
