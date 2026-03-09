# Phase-4 Social Listening Quick Start Guide

**Quick reference for using Phase-4 Social Listening features**

---

## Listening Rules

### Create Listening Rule

```bash
POST /api/v1/listening-rules
Content-Type: application/json

{
  "platform": "twitter",
  "type": "keyword",
  "value": "social media"
}
```

**Types**: `keyword`, `hashtag`, `competitor`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "workspaceId": "...",
    "platform": "twitter",
    "type": "keyword",
    "value": "social media",
    "active": true,
    "createdAt": "2026-03-08T10:00:00Z"
  }
}
```

### List Listening Rules

```bash
GET /api/v1/listening-rules?platform=twitter&type=keyword&active=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "platform": "twitter",
      "type": "keyword",
      "value": "social media",
      "active": true,
      "lastCollectedAt": "2026-03-08T10:15:00Z"
    }
  ]
}
```

### Update Listening Rule

```bash
PATCH /api/v1/listening-rules/:id
Content-Type: application/json

{
  "active": false
}
```

### Delete Listening Rule

```bash
DELETE /api/v1/listening-rules/:id
```

---

## Mentions

### Get Mentions with Pagination

```bash
GET /api/v1/mentions?keyword=social%20media&platform=twitter&page=1&limit=20&sortBy=collectedAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "keyword": "social media",
      "platform": "twitter",
      "author": {
        "username": "user123",
        "displayName": "John Doe",
        "followerCount": 5000
      },
      "text": "Just discovered this amazing social media tool!",
      "sourcePostId": "twitter-123456",
      "sourceUrl": "https://twitter.com/user123/status/123456",
      "engagementMetrics": {
        "likes": 50,
        "comments": 10,
        "shares": 5,
        "views": 1000
      },
      "collectedAt": "2026-03-08T10:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Get Mentions for Specific Keyword

```bash
GET /api/v1/mentions/social%20media?platform=twitter&startDate=2026-01-01&endDate=2026-03-08&limit=50
```

### Get Mention Statistics

```bash
GET /api/v1/mentions/stats?keyword=social%20media&platform=twitter&startDate=2026-01-01&endDate=2026-03-08
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMentions": 150,
    "totalLikes": 7500,
    "totalComments": 1500,
    "totalShares": 750,
    "avgLikes": 50,
    "avgComments": 10,
    "avgShares": 5
  }
}
```

---

## Trends

### Get Top Trends

```bash
GET /api/v1/trends?platform=twitter&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "keyword": "social media",
      "platform": "twitter",
      "postVolume": 150,
      "postVolumeGrowth": 25.5,
      "totalEngagement": 9750,
      "avgEngagement": 65,
      "engagementVelocity": 15.2,
      "trendScore": 387.6,
      "periodStart": "2026-03-07T10:00:00Z",
      "periodEnd": "2026-03-08T10:00:00Z",
      "recordedAt": "2026-03-08T10:00:00Z"
    }
  ]
}
```

### Get Trends for Specific Platform

```bash
GET /api/v1/trends/twitter?limit=10
```

### Get Trend History for Keyword

```bash
GET /api/v1/trends/keyword/social%20media?platform=twitter&startDate=2026-01-01&endDate=2026-03-08
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "keyword": "social media",
      "platform": "twitter",
      "trendScore": 387.6,
      "postVolume": 150,
      "postVolumeGrowth": 25.5,
      "engagementVelocity": 15.2,
      "recordedAt": "2026-03-08T10:00:00Z"
    },
    {
      "keyword": "social media",
      "platform": "twitter",
      "trendScore": 320.4,
      "postVolume": 120,
      "postVolumeGrowth": 20.0,
      "engagementVelocity": 16.0,
      "recordedAt": "2026-03-07T10:00:00Z"
    }
  ]
}
```

---

## Collection Schedule

### Automatic Collection

When you create a listening rule, collection jobs are automatically scheduled:

- **Keyword mentions**: Every 15 minutes
- **Hashtag mentions**: Every 15 minutes
- **Competitor mentions**: Every 15 minutes
- **Trend calculation**: Every 30 minutes

### Manual Trigger

Collection is automatic. No manual trigger available.

---

## TypeScript Usage

### Import Services

```typescript
import { ListeningCollectorService } from './services/ListeningCollectorService';
import { TrendAnalyzerService } from './services/TrendAnalyzerService';
```

### Create Listening Rule

```typescript
import { ListeningRule, ListeningRuleType } from './models/ListeningRule';

const rule = new ListeningRule({
  workspaceId,
  platform: 'twitter',
  type: ListeningRuleType.KEYWORD,
  value: 'social media',
  createdBy: userId,
  active: true,
});

await rule.save();
```

### Collect Mentions

```typescript
const mentionsCollected = await ListeningCollectorService.collectKeywordMentions(
  workspaceId,
  'twitter'
);
```

### Calculate Trends

```typescript
const trendsCalculated = await TrendAnalyzerService.calculateTrends(workspaceId);
```

### Get Top Trends

```typescript
const trends = await TrendAnalyzerService.getTopTrends(
  workspaceId,
  'twitter',
  10
);
```

---

## Database Queries

### Get Recent Mentions

```typescript
const mentions = await Mention.find({
  workspaceId,
  keyword: 'social media',
  collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
})
  .sort({ collectedAt: -1 })
  .limit(50)
  .lean();
```

### Get Latest Trend

```typescript
const trend = await TrendMetric.findOne({
  workspaceId,
  keyword: 'social media',
  platform: 'twitter',
})
  .sort({ recordedAt: -1 })
  .lean();
```

---

## Monitoring

### Check Worker Status

```typescript
import { socialListeningWorker } from './workers/SocialListeningWorker';

const status = socialListeningWorker.getStatus();
console.log('Social Listening Worker:', status);
```

### Check Queue Status

```typescript
import { SocialListeningQueue } from './queue/SocialListeningQueue';

const queue = SocialListeningQueue.getQueue();
const jobCounts = await queue.getJobCounts();
console.log('Social Listening Queue:', jobCounts);
```

### Get Metrics

```typescript
import { socialListeningWorker } from './workers/SocialListeningWorker';

const metrics = socialListeningWorker.getMetrics();
console.log('Metrics:', metrics);
// {
//   jobs_processed_total: 1000,
//   jobs_success_total: 980,
//   jobs_failure_total: 20,
//   mentions_collected_total: 5000,
//   trends_calculated_total: 200,
// }
```

---

## Error Handling

### Common Errors

**409 - Duplicate Rule**
```json
{
  "success": false,
  "error": "Listening rule already exists for this workspace"
}
```

**400 - Invalid Type**
```json
{
  "success": false,
  "error": "Invalid type. Must be one of: keyword, hashtag, competitor"
}
```

**404 - Rule Not Found**
```json
{
  "success": false,
  "error": "Listening rule not found"
}
```

---

## Data Retention

### Automatic Cleanup

- **Mentions**: Automatically deleted after 90 days (TTL index)
- **Trend Metrics**: Preserved indefinitely
- **Listening Rules**: Soft delete (active flag)

### Manual Cleanup

```typescript
// Delete old trend metrics manually if needed
await TrendMetric.deleteMany({
  recordedAt: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
});
```

---

## Rate Limiting

### Protection Mechanisms

- **15-minute intervals**: Prevents API rate limit issues
- **Distributed locking**: Prevents concurrent collection
- **Exponential backoff**: Retries with increasing delays
- **Circuit breakers**: Stops collection if platform is down

### Handling Rate Limits

If you hit rate limits:
1. Failed jobs go to Dead Letter Queue
2. Review DLQ for failed jobs
3. Adjust collection frequency if needed
4. Implement platform-specific rate limit handling

---

## Troubleshooting

### Mentions Not Collecting

1. Check if listening rules are active
2. Check if worker is running
3. Check if collection jobs are scheduled
4. Check Redis connection
5. Check MongoDB connection
6. Check logs for errors

### Trends Not Calculating

1. Check if mentions exist for keywords
2. Check if trend calculation job is scheduled
3. Check if worker is running
4. Check logs for calculation errors

### Duplicate Mentions

- Duplicate prevention is automatic (unique index on platform + sourcePostId)
- If duplicates appear, check index integrity

---

## Performance Considerations

### Collection Frequency

- 15-minute intervals balance freshness vs API load
- Adjust frequency in `SocialListeningQueue` if needed

### Database Performance

- Indexes optimize query performance
- TTL index automatically cleans up old mentions
- Pagination prevents large result sets

### Optimization Tips

- Use date range filters to limit query scope
- Use pagination for large result sets
- Monitor queue depth to detect bottlenecks
- Add caching for frequently accessed trends

---

**Last Updated**: 2026-03-08
