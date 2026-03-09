# Phase-5 Automation Engine - Quick Start Guide

## Overview

This guide provides quick instructions for deploying and using the Phase-5 Automation Engine.

---

## 🚀 Deployment

### 1. Start Workers

Add to your server startup file (e.g., `server.ts` or `index.ts`):

```typescript
import { workflowExecutorWorker } from './workers/WorkflowExecutorWorker';
import { rssCollectorWorker } from './workers/RSSCollectorWorker';
import { evergreenWorker } from './workers/EvergreenWorker';

// Start automation workers
workflowExecutorWorker.start();
rssCollectorWorker.start();
evergreenWorker.start();

console.log('✅ Automation workers started');
```

### 2. Start Schedulers

Add to your server startup file:

```typescript
import { rssPollingScheduler } from './services/RSSPollingScheduler';
import { evergreenScheduler } from './services/EvergreenScheduler';

// Start automation schedulers
rssPollingScheduler.start();
evergreenScheduler.start();

console.log('✅ Automation schedulers started');
```

### 3. Verify MongoDB Indexes

The TTL indexes will be created automatically on first document insert. To verify:

```javascript
// In MongoDB shell or Compass
db.workflowruns.getIndexes()
// Should see: { createdAt: 1 } with expireAfterSeconds: 7776000

db.rssfeeditems.getIndexes()
// Should see: { createdAt: 1 } with expireAfterSeconds: 2592000
```

---

## 📝 Usage Examples

### Create a Workflow

```bash
POST /api/v1/workflows
Content-Type: application/json
Authorization: Bearer <token>

{
  "workspaceId": "507f1f77bcf86cd799439011",
  "name": "Auto-post RSS items",
  "description": "Automatically create posts from RSS feed items",
  "enabled": true,
  "trigger": {
    "type": "RSS_ITEM_FETCHED",
    "config": {
      "feedId": "507f1f77bcf86cd799439012"
    }
  },
  "actions": [
    {
      "type": "CREATE_POST",
      "config": {
        "content": "{{rss.title}} - {{rss.link}}",
        "platforms": ["twitter", "linkedin"]
      }
    }
  ]
}
```

### Create an RSS Feed

```bash
POST /api/v1/rss-feeds
Content-Type: application/json
Authorization: Bearer <token>

{
  "workspaceId": "507f1f77bcf86cd799439011",
  "name": "TechCrunch",
  "url": "https://techcrunch.com/feed/",
  "pollingInterval": 60,
  "enabled": true
}
```

### Create an Evergreen Rule

```bash
POST /api/v1/evergreen-rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "workspaceId": "507f1f77bcf86cd799439011",
  "postId": "507f1f77bcf86cd799439013",
  "repostInterval": 7,
  "maxReposts": 10,
  "enabled": true,
  "contentModification": {
    "prefix": "🔄 Repost:",
    "suffix": "#evergreen"
  }
}
```

---

## 🔍 Monitoring

### Check Worker Status

```typescript
import { workflowExecutorWorker } from './workers/WorkflowExecutorWorker';
import { rssCollectorWorker } from './workers/RSSCollectorWorker';
import { evergreenWorker } from './workers/EvergreenWorker';

console.log('Workflow Worker:', workflowExecutorWorker.getStatus());
console.log('RSS Worker:', rssCollectorWorker.getStatus());
console.log('Evergreen Worker:', evergreenWorker.getStatus());
```

### Check Scheduler Status

```typescript
import { rssPollingScheduler } from './services/RSSPollingScheduler';
import { evergreenScheduler } from './services/EvergreenScheduler';

console.log('RSS Scheduler:', rssPollingScheduler.getStatus());
console.log('Evergreen Scheduler:', evergreenScheduler.getStatus());
```

### View Metrics

```typescript
// Worker metrics
console.log('Workflow Metrics:', workflowExecutorWorker.getMetrics());
console.log('RSS Metrics:', rssCollectorWorker.getMetrics());
console.log('Evergreen Metrics:', evergreenWorker.getMetrics());

// Scheduler metrics
console.log('RSS Scheduler Metrics:', rssPollingScheduler.getMetrics());
console.log('Evergreen Scheduler Metrics:', evergreenScheduler.getMetrics());
```

---

## 🧪 Testing

### Test RSS Feed Polling

```typescript
import { rssPollingScheduler } from './services/RSSPollingScheduler';

// Force immediate poll
await rssPollingScheduler.forcePoll();
```

### Test Evergreen Evaluation

```typescript
import { evergreenScheduler } from './services/EvergreenScheduler';

// Force immediate evaluation
await evergreenScheduler.forcePoll();
```

### Test Workflow Execution

```typescript
import { EventDispatcherService } from './services/EventDispatcherService';

// Emit test event
await EventDispatcherService.handleEvent({
  eventId: 'test-event-123',
  eventType: 'post.published',
  workspaceId: '507f1f77bcf86cd799439011',
  timestamp: new Date(),
  data: {
    postId: '507f1f77bcf86cd799439013',
    platform: 'twitter',
    content: 'Test post',
    publishedAt: new Date(),
  },
});
```

---

## 🐛 Troubleshooting

### Workers Not Starting

**Issue**: Workers fail to start

**Solution**:
1. Check Redis connection
2. Verify QueueManager is initialized
3. Check logs for errors

```typescript
// Check Redis
import { getRedisClient } from './config/redis';
const redis = getRedisClient();
await redis.ping(); // Should return 'PONG'
```

### Schedulers Not Running

**Issue**: Schedulers don't execute

**Solution**:
1. Check if schedulers are started
2. Verify distributed lock acquisition
3. Check Redis for lock keys

```bash
# In Redis CLI
KEYS *scheduler*
# Should see: rss-scheduler:lock, evergreen-scheduler:lock
```

### No Jobs Being Processed

**Issue**: Jobs sit in queue

**Solution**:
1. Verify workers are running
2. Check worker concurrency limits
3. Check for stuck jobs in DLQ

```typescript
// Check queue status
import { QueueManager } from './queue/QueueManager';
const queueManager = QueueManager.getInstance();
const queue = queueManager.getQueue('workflow-queue');
const counts = await queue.getJobCounts();
console.log('Queue counts:', counts);
```

### TTL Cleanup Not Working

**Issue**: Old documents not being deleted

**Solution**:
1. Verify TTL indexes exist
2. Wait for MongoDB cleanup cycle (runs every 60 seconds)
3. Check MongoDB logs

```javascript
// Verify TTL index
db.workflowruns.getIndexes()
// Look for: expireAfterSeconds field
```

---

## 📊 Performance Tuning

### Adjust Worker Concurrency

Edit worker files to change concurrency:

```typescript
// In WorkflowExecutorWorker.ts
private readonly CONCURRENCY = 10; // Increase from 5

// In RSSCollectorWorker.ts
private readonly CONCURRENCY = 5; // Increase from 3

// In EvergreenWorker.ts
private readonly CONCURRENCY = 10; // Increase from 5
```

### Adjust Scheduler Intervals

Edit scheduler files to change polling frequency:

```typescript
// In RSSPollingScheduler.ts
private readonly POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes instead of 10

// In EvergreenScheduler.ts
private readonly POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes instead of 15
```

### Adjust Retry Configuration

Edit queue files to change retry behavior:

```typescript
// In WorkflowQueue.ts, RSSQueue.ts, EvergreenQueue.ts
attempts: 5, // Increase from 3
backoff: {
  type: 'exponential',
  delay: 10000, // Increase from 5000
}
```

---

## 🔒 Security Checklist

- ✅ All endpoints require authentication
- ✅ Workspace isolation enforced
- ✅ Rate limiting configured (100 req/15min)
- ✅ Input validation on all requests
- ✅ URL validation for RSS feeds
- ✅ Distributed locking prevents race conditions
- ✅ Idempotency prevents duplicate processing

---

## 📈 Monitoring Alerts

### Recommended Alerts

1. **High Workflow Failure Rate**
   - Metric: `workflow_executions_failed / workflow_executions_total`
   - Threshold: > 10% over 5 minutes
   - Action: Check logs, investigate failed workflows

2. **High RSS Fetch Failure Rate**
   - Metric: `rss_fetch_errors_total / rss_fetch_total`
   - Threshold: > 10% over 5 minutes
   - Action: Check feed URLs, network connectivity

3. **DLQ Accumulation**
   - Metric: DLQ job count
   - Threshold: > 100 jobs
   - Action: Investigate failed jobs, fix issues

4. **Scheduler Not Running**
   - Metric: `scheduler_runs_total` not incrementing
   - Threshold: No runs in 30 minutes
   - Action: Check scheduler status, restart if needed

---

## 🎯 Common Use Cases

### 1. Auto-post from RSS Feed

Create RSS feed → Create workflow with RSS_ITEM_FETCHED trigger → Posts created automatically

### 2. Republish Top Performers

Identify high-performing post → Create evergreen rule → Post republished periodically

### 3. Alert on High Engagement

Create workflow with ANALYTICS_THRESHOLD trigger → Send notification when threshold reached

### 4. Auto-respond to Mentions

Create workflow with MENTION_DETECTED trigger → Create response post automatically

---

## 📚 API Documentation

Full API documentation available at:
- Workflows: `/api/v1/workflows`
- RSS Feeds: `/api/v1/rss-feeds`
- Evergreen Rules: `/api/v1/evergreen-rules`

OpenAPI/Swagger documentation included in route files.

---

## 🆘 Support

For issues or questions:
1. Check logs for error messages
2. Verify worker and scheduler status
3. Check queue depths and DLQ
4. Review metrics for anomalies
5. Consult PHASE_5_COMPLETE.md for detailed documentation

---

## ✅ Deployment Checklist

- [ ] Workers started on application startup
- [ ] Schedulers started on application startup
- [ ] MongoDB TTL indexes verified
- [ ] Redis connection verified
- [ ] QueueManager initialized
- [ ] Metrics collection configured
- [ ] Monitoring alerts configured
- [ ] Rate limiting configured
- [ ] Authentication middleware active
- [ ] Workspace isolation verified
- [ ] Test workflows created
- [ ] Test RSS feeds created
- [ ] Test evergreen rules created
- [ ] End-to-end testing completed
- [ ] Load testing completed
- [ ] Documentation reviewed

---

**Status**: Ready for deployment ✅
