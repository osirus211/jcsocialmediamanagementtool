# Phase-3 Advanced Analytics Quick Start Guide

**Quick reference for using Phase-3 Advanced Analytics features**

---

## Follower Growth Tracking

### Get Follower History

```bash
GET /api/v1/analytics/followers/:accountId?startDate=2026-01-01&endDate=2026-03-08&limit=100
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "...",
      "platform": "twitter",
      "followerCount": 15000,
      "recordedAt": "2026-03-08T10:00:00Z"
    }
  ]
}
```

### Get Follower Growth

```bash
GET /api/v1/analytics/followers/:accountId/growth?startDate=2026-01-01&endDate=2026-03-08
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountId": "...",
    "platform": "twitter",
    "currentFollowers": 15000,
    "previousFollowers": 12000,
    "growth": 3000,
    "growthPercentage": 25.0,
    "period": {
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-03-08T23:59:59Z"
    }
  }
}
```

### Get Follower Trends

```bash
GET /api/v1/analytics/followers/:accountId/trends?startDate=2026-01-01&endDate=2026-03-08&interval=day
```

**Intervals:** `day`, `week`, `month`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-01-01",
      "followerCount": 12000
    },
    {
      "date": "2026-01-02",
      "followerCount": 12050
    }
  ]
}
```

### Get Workspace Follower Growth

```bash
GET /api/v1/analytics/followers/workspace/growth?startDate=2026-01-01&endDate=2026-03-08
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "...",
      "platform": "twitter",
      "currentFollowers": 15000,
      "previousFollowers": 12000,
      "growth": 3000,
      "growthPercentage": 25.0,
      "period": {...}
    },
    {
      "accountId": "...",
      "platform": "instagram",
      "currentFollowers": 25000,
      "previousFollowers": 20000,
      "growth": 5000,
      "growthPercentage": 25.0,
      "period": {...}
    }
  ]
}
```

---

## Competitor Analytics

### Add Competitor

```bash
POST /api/v1/competitors
Content-Type: application/json

{
  "platform": "twitter",
  "handle": "@competitor",
  "displayName": "Competitor Name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "workspaceId": "...",
    "platform": "twitter",
    "handle": "@competitor",
    "displayName": "Competitor Name",
    "profileUrl": "https://twitter.com/competitor",
    "isActive": true,
    "createdAt": "2026-03-08T10:00:00Z"
  }
}
```

### List Competitors

```bash
GET /api/v1/competitors?platform=twitter&isActive=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "platform": "twitter",
      "handle": "@competitor",
      "displayName": "Competitor Name",
      "isActive": true,
      "lastCollectedAt": "2026-03-08T10:00:00Z"
    }
  ]
}
```

### Remove Competitor

```bash
DELETE /api/v1/competitors/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Competitor removed successfully"
}
```

### Get Competitor Analytics

```bash
GET /api/v1/competitors/:id/analytics?startDate=2026-01-01&endDate=2026-03-08&limit=100
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "competitorId": "...",
      "platform": "twitter",
      "followerCount": 50000,
      "engagementRate": 5.2,
      "postCount": 150,
      "avgLikes": 500,
      "avgComments": 50,
      "avgShares": 20,
      "collectedAt": "2026-03-08T10:00:00Z"
    }
  ]
}
```

### Get Competitor Growth

```bash
GET /api/v1/competitors/:id/growth?startDate=2026-01-01&endDate=2026-03-08
```

**Response:**
```json
{
  "success": true,
  "data": {
    "followerGrowth": 5000,
    "followerGrowthPercentage": 11.1,
    "period": {
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-03-08T23:59:59Z"
    }
  }
}
```

### Compare Competitors

```bash
POST /api/v1/competitors/compare
Content-Type: application/json

{
  "competitorIds": ["id1", "id2", "id3"],
  "startDate": "2026-01-01",
  "endDate": "2026-03-08"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "competitor": {
        "id": "id1",
        "handle": "@competitor1",
        "platform": "twitter"
      },
      "metrics": {
        "followerCount": 50000,
        "engagementRate": 5.2,
        "postCount": 150,
        "avgLikes": 500,
        "avgComments": 50
      },
      "growth": {
        "followers": 5000,
        "followersPercentage": 11.1
      }
    }
  ]
}
```

---

## Collection Schedule

### Follower Collection
- **Frequency**: Every 6 hours
- **Auto-scheduled**: When workspace is created
- **Manual trigger**: Not available (automatic only)

### Competitor Collection
- **Frequency**: Every 6 hours
- **Auto-scheduled**: When first competitor is added
- **Manual trigger**: Not available (automatic only)

---

## Integration with Existing Dashboard

### Add to Dashboard Service

```typescript
import { FollowerAnalyticsService } from '../services/FollowerAnalyticsService';
import { CompetitorAnalyticsService } from '../services/CompetitorAnalyticsService';

// Get follower growth for dashboard
const followerGrowth = await FollowerAnalyticsService.getWorkspaceFollowerGrowth(
  workspaceId,
  startDate,
  endDate
);

// Get competitor comparison for dashboard
const competitors = await CompetitorAnalyticsService.getCompetitors(workspaceId);
const competitorIds = competitors.map(c => c._id.toString());
const comparison = await CompetitorAnalyticsService.compareCompetitors(
  workspaceId,
  competitorIds,
  startDate,
  endDate
);
```

---

## Error Handling

### Common Errors

**404 - No Data Found**
```json
{
  "success": false,
  "error": "No follower data found for the specified period"
}
```

**400 - Missing Required Parameters**
```json
{
  "success": false,
  "error": "startDate and endDate are required"
}
```

**409 - Duplicate Competitor**
```json
{
  "success": false,
  "error": "Competitor already exists for this workspace"
}
```

---

## TypeScript Usage

### Import Services

```typescript
import { FollowerAnalyticsService } from './services/FollowerAnalyticsService';
import { CompetitorAnalyticsService } from './services/CompetitorAnalyticsService';
```

### Record Follower Snapshot

```typescript
await FollowerAnalyticsService.recordFollowerSnapshot(
  accountId,
  workspaceId,
  'twitter',
  15000
);
```

### Add Competitor

```typescript
const competitor = await CompetitorAnalyticsService.addCompetitor(
  workspaceId,
  userId,
  'twitter',
  '@competitor',
  'Competitor Name'
);
```

### Get Follower Growth

```typescript
const growth = await FollowerAnalyticsService.getFollowerGrowth(
  accountId,
  new Date('2026-01-01'),
  new Date('2026-03-08')
);
```

---

## Database Queries

### Get Latest Follower Count

```typescript
const latest = await FollowerHistory.findOne({ accountId })
  .sort({ recordedAt: -1 })
  .lean();
```

### Get Competitor Metrics History

```typescript
const metrics = await CompetitorMetrics.find({ competitorId })
  .sort({ collectedAt: -1 })
  .limit(100)
  .lean();
```

---

## Monitoring

### Check Worker Status

```typescript
import { followerCollectionWorker } from './workers/FollowerCollectionWorker';
import { competitorCollectionWorker } from './workers/CompetitorCollectionWorker';

const followerStatus = followerCollectionWorker.getStatus();
const competitorStatus = competitorCollectionWorker.getStatus();

console.log('Follower Worker:', followerStatus);
console.log('Competitor Worker:', competitorStatus);
```

### Check Queue Status

```typescript
import { FollowerCollectionQueue } from './queue/FollowerCollectionQueue';
import { CompetitorCollectionQueue } from './queue/CompetitorCollectionQueue';

const followerQueue = FollowerCollectionQueue.getQueue();
const competitorQueue = CompetitorCollectionQueue.getQueue();

const followerJobCounts = await followerQueue.getJobCounts();
const competitorJobCounts = await competitorQueue.getJobCounts();

console.log('Follower Queue:', followerJobCounts);
console.log('Competitor Queue:', competitorJobCounts);
```

---

## Testing

### Test Follower Collection

```bash
# Add follower snapshot manually
curl -X POST http://localhost:3000/api/v1/analytics/followers/test \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "...",
    "followerCount": 15000
  }'
```

### Test Competitor Addition

```bash
# Add competitor
curl -X POST http://localhost:3000/api/v1/competitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "platform": "twitter",
    "handle": "@competitor",
    "displayName": "Test Competitor"
  }'
```

---

## Troubleshooting

### Follower Collection Not Working

1. Check if workers are running
2. Check if collection jobs are scheduled
3. Check Redis connection
4. Check MongoDB connection
5. Check logs for errors

### Competitor Metrics Not Updating

1. Check if competitor is active (`isActive: true`)
2. Check if collection worker is running
3. Check if platform adapter is implemented
4. Check API rate limits
5. Check logs for collection errors

---

## Performance Considerations

### Follower Collection
- Runs every 6 hours per workspace
- Low overhead (reads from existing SocialAccount.metadata)
- Minimal database writes (1 insert per account per 6 hours)

### Competitor Collection
- Runs every 6 hours per workspace
- Requires external API calls (may hit rate limits)
- Database writes: 1 insert per competitor per 6 hours

### Optimization Tips
- Adjust collection frequency if needed (modify cron pattern)
- Implement caching for frequently accessed data
- Use pagination for large result sets
- Add indexes for common query patterns

---

**Last Updated**: 2026-03-08
