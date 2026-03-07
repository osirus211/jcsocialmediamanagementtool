# Phase 2 Integration Guide

**How to integrate the webhook system into your application**

---

## Step 1: Register Webhook Routes

Add webhook routes to your main Express app:

```typescript
// In your main app.ts or server.ts

import webhookRoutes from './routes/v1/webhook.routes';

// IMPORTANT: Register webhook routes BEFORE body-parser middleware
// The rawBodyParser middleware needs to capture the raw body
app.use('/api/v1/webhooks', webhookRoutes);

// Then register other routes with JSON body parser
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
// ... other routes
```

---

## Step 2: Initialize Workers on Startup

Start the webhook workers when your application starts:

```typescript
// In your main app.ts or server.ts

import { ingestQueue } from './routes/v1/webhook.routes';
import { WebhookProcessingQueue } from './queue/WebhookProcessingQueue';

// After connecting to Redis and MongoDB
async function startWebhookWorkers() {
  const processingQueue = new WebhookProcessingQueue();
  
  // Start Stage 1 worker (ingest)
  ingestQueue.startWorker(processingQueue);
  
  // Start Stage 2 worker (processing)
  processingQueue.startWorker();
  
  logger.info('Webhook workers started');
}

// Call during application startup
await connectRedis();
await connectMongoDB();
await startWebhookWorkers();
```

---

## Step 3: Add to Graceful Shutdown

Ensure workers are closed gracefully on shutdown:

```typescript
// In your shutdown handler

async function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');
  
  // Close webhook queues
  await ingestQueue.close();
  await processingQueue.close();
  
  // Close other resources
  await QueueManager.getInstance().closeAll();
  await mongoose.connection.close();
  await redis.quit();
  
  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## Step 4: Configure Webhook URLs in Platform Settings

Update each platform's webhook configuration:

### Facebook
- Webhook URL: `https://yourdomain.com/api/v1/webhooks/facebook`
- Verify Token: (your choice)
- Subscribed Fields: `permissions`, `deauthorize`, `delete`

### Twitter
- Webhook URL: `https://yourdomain.com/api/v1/webhooks/twitter`
- CRC Endpoint: Same URL (GET request)

### LinkedIn
- Webhook URL: `https://yourdomain.com/api/v1/webhooks/linkedin`

### Instagram
- Webhook URL: `https://yourdomain.com/api/v1/webhooks/instagram`
- Uses Facebook's webhook infrastructure

### YouTube
- Webhook URL: `https://yourdomain.com/api/v1/webhooks/youtube`

### TikTok
- Webhook URL: `https://yourdomain.com/api/v1/webhooks/tiktok`

### Threads
- Webhook URL: `https://yourdomain.com/api/v1/webhooks/threads`
- Uses Facebook's webhook infrastructure

---

## Step 5: Test Webhook Endpoints

### Test with cURL

```bash
# Test Facebook webhook
curl -X POST https://yourdomain.com/api/v1/webhooks/facebook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=YOUR_SIGNATURE" \
  -d '{"object":"user","entry":[{"id":"123","time":1234567890,"changes":[{"field":"permissions"}]}]}'

# Test Twitter CRC challenge
curl -X GET "https://yourdomain.com/api/v1/webhooks/twitter?crc_token=test_token"
```

### Monitor Logs

```bash
# Watch webhook processing
tail -f logs/app.log | grep webhook

# Check Redis keys
redis-cli -p 6380 keys "webhook:*"

# Check BullMQ queues
redis-cli -p 6380 keys "bull:webhook-*"
```

---

## Step 6: Monitor Queue Health

Add health check endpoint:

```typescript
// In your health check route

router.get('/health/webhooks', async (req, res) => {
  const ingestStats = await ingestQueue.getQueue().getJobCounts();
  const processingStats = await processingQueue.getQueue().getJobCounts();
  
  res.json({
    status: 'ok',
    queues: {
      ingest: ingestStats,
      processing: processingStats,
    },
  });
});
```

---

## Troubleshooting

### Issue: "Raw body not available"
**Solution:** Ensure webhook routes are registered BEFORE `express.json()` middleware

### Issue: "Invalid signature"
**Solution:** Check that environment variables are set correctly:
- `FACEBOOK_APP_SECRET`
- `TWITTER_CONSUMER_SECRET`
- etc.

### Issue: "Provider not found"
**Solution:** Check that provider name in URL matches registered providers:
- `/webhooks/facebook` ✅
- `/webhooks/Facebook` ❌ (case-sensitive)

### Issue: Workers not processing jobs
**Solution:** Ensure workers are started after Redis connection:
```typescript
await connectRedis();
await startWebhookWorkers(); // Must be after Redis connection
```

---

## Example: Complete Integration

```typescript
// app.ts

import express from 'express';
import { connectRedis } from './config/redis';
import { connectMongoDB } from './config/database';
import webhookRoutes, { ingestQueue } from './routes/v1/webhook.routes';
import { WebhookProcessingQueue } from './queue/WebhookProcessingQueue';
import { logger } from './utils/logger';

const app = express();

// CRITICAL: Register webhook routes BEFORE body parser
app.use('/api/v1/webhooks', webhookRoutes);

// Then register body parser for other routes
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);

// Startup
async function start() {
  await connectRedis();
  await connectMongoDB();
  
  // Start webhook workers
  const processingQueue = new WebhookProcessingQueue();
  ingestQueue.startWorker(processingQueue);
  processingQueue.startWorker();
  
  logger.info('Webhook system initialized');
  
  app.listen(5000, () => {
    logger.info('Server started on port 5000');
  });
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  await ingestQueue.close();
  await processingQueue.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((error) => {
  logger.error('Startup failed', error);
  process.exit(1);
});
```

---

## Next Steps

1. ✅ Core implementation complete
2. ⏳ Integration (follow this guide)
3. ⏳ Testing
4. ⏳ Phase 3: Business logic implementation

