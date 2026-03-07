# Provider Architecture Integration Guide

## Quick Start

This guide shows how to integrate the new provider architecture into your existing application.

## Step 1: Start RefreshWorker

The RefreshWorker needs to be started alongside the PublishingWorker.

### Option A: Add to existing worker startup file

If you have a `worker-standalone.ts` or similar file:

```typescript
import { RefreshWorker } from './workers/RefreshWorker';
import { PublishingWorker } from './workers/PublishingWorker';

// Start both workers
const publishingWorker = new PublishingWorker();
publishingWorker.start();

const refreshWorker = new RefreshWorker();
refreshWorker.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await publishingWorker.stop();
  await refreshWorker.stop();
  process.exit(0);
});
```

### Option B: Create separate refresh worker process

Create `apps/backend/src/workers/refresh-worker-standalone.ts`:

```typescript
import { connectDB } from '../config/database';
import { connectRedis } from '../config/redis';
import { RefreshWorker } from './RefreshWorker';
import { logger } from '../utils/logger';

async function main() {
  try {
    // Connect to database and Redis
    await connectDB();
    await connectRedis();

    // Start refresh worker
    const worker = new RefreshWorker();
    worker.start();

    logger.info('Refresh worker started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await worker.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await worker.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start refresh worker', { error });
    process.exit(1);
  }
}

main();
```

Then add to `package.json`:

```json
{
  "scripts": {
    "worker:refresh": "ts-node src/workers/refresh-worker-standalone.ts"
  }
}
```

## Step 2: Attach Event Handlers to Providers

Event handlers should be attached when the application starts.

### In your main application file (e.g., `app.ts` or `server.ts`):

```typescript
import { providerFactory } from './providers/ProviderFactory';
import { providerEventHandler } from './services/ProviderEventHandler';
import { SocialPlatform } from './models/SocialAccount';

// After database and Redis connection
async function setupProviders() {
  // Get Twitter provider and attach event handler
  const twitterProvider = providerFactory.getProvider(SocialPlatform.TWITTER);
  providerEventHandler.attachToProvider(twitterProvider);

  // Add more platforms as they're implemented
  // const linkedinProvider = providerFactory.getProvider(SocialPlatform.LINKEDIN);
  // providerEventHandler.attachToProvider(linkedinProvider);

  logger.info('Provider event handlers attached');
}

// Call during startup
await setupProviders();
```

## Step 3: Use Providers in Your Code

### Publishing a Post

The PublishingWorker already uses providers, so no changes needed there.

But if you need to publish directly (e.g., in a test or admin tool):

```typescript
import { providerFactory } from './providers/ProviderFactory';
import { SocialPlatform } from './models/SocialAccount';

async function publishPost(accountId: string, content: string) {
  const account = await SocialAccount.findById(accountId);
  const provider = providerFactory.getProvider(account.provider);

  const result = await provider.publish({
    postId: 'test-post-id',
    accountId,
    content,
    mediaUrls: [],
  });

  return result;
}
```

### Refreshing a Token

Use the RefreshQueue instead of calling the provider directly:

```typescript
import { refreshQueue } from './queue/RefreshQueue';

async function refreshToken(accountId: string) {
  const account = await SocialAccount.findById(accountId);

  // Add urgent refresh job
  await refreshQueue.addUrgentRefresh({
    accountId: accountId.toString(),
    workspaceId: account.workspaceId.toString(),
    platform: account.provider,
    triggeredBy: 'manual',
  });
}
```

### Scheduling Proactive Refresh

This happens automatically when a token is refreshed, but you can also schedule manually:

```typescript
import { refreshQueue } from './queue/RefreshQueue';

async function scheduleProactiveRefresh(accountId: string) {
  const account = await SocialAccount.findById(accountId);

  // Schedule refresh 5 minutes before expiry
  await refreshQueue.scheduleProactiveRefresh(
    accountId.toString(),
    account.workspaceId.toString(),
    account.provider,
    account.tokenExpiresAt,
    5 // minutes
  );
}
```

### Checking Rate Limits

```typescript
import { globalRateLimitManager } from './services/GlobalRateLimitManager';

async function checkRateLimit(accountId: string) {
  // Check if account is rate limited for publishing
  const isLimited = await globalRateLimitManager.isAccountRateLimited(
    accountId,
    'publish'
  );

  if (isLimited) {
    // Get rate limit info
    const rateLimit = await globalRateLimitManager.getAccountRateLimit(
      accountId,
      'publish'
    );

    console.log(`Rate limited until ${rateLimit.resetAt}`);
    return false;
  }

  return true;
}
```

### Getting Metrics

```typescript
import { providerMetrics } from './services/ProviderMetricsService';

async function getAccountMetrics(platform: string, accountId: string) {
  const publishMetrics = providerMetrics.getPublishMetrics(platform, accountId);
  const refreshMetrics = providerMetrics.getRefreshMetrics(platform, accountId);
  const rateLimitMetrics = providerMetrics.getRateLimitMetrics(platform, accountId);

  return {
    publish: publishMetrics,
    refresh: refreshMetrics,
    rateLimit: rateLimitMetrics,
  };
}

async function getPlatformMetrics(platform: string) {
  return providerMetrics.getAggregatedPlatformMetrics(platform);
}

async function getGlobalMetrics() {
  return providerMetrics.getGlobalMetrics();
}
```

## Step 4: Add Monitoring Endpoints

Add API endpoints to expose metrics:

```typescript
import { Router } from 'express';
import { providerMetrics } from '../services/ProviderMetricsService';
import { globalRateLimitManager } from '../services/GlobalRateLimitManager';
import { refreshQueue } from '../queue/RefreshQueue';

const router = Router();

// Get global metrics
router.get('/metrics', async (req, res) => {
  const metrics = providerMetrics.getGlobalMetrics();
  res.json(metrics);
});

// Get platform metrics
router.get('/metrics/:platform', async (req, res) => {
  const { platform } = req.params;
  const metrics = providerMetrics.getAggregatedPlatformMetrics(platform);
  res.json(metrics);
});

// Get account metrics
router.get('/metrics/:platform/:accountId', async (req, res) => {
  const { platform, accountId } = req.params;
  
  const publishMetrics = providerMetrics.getPublishMetrics(platform, accountId);
  const refreshMetrics = providerMetrics.getRefreshMetrics(platform, accountId);
  const rateLimitMetrics = providerMetrics.getRateLimitMetrics(platform, accountId);
  
  res.json({
    publish: publishMetrics,
    refresh: refreshMetrics,
    rateLimit: rateLimitMetrics,
  });
});

// Get rate limit status
router.get('/rate-limits/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const rateLimits = await globalRateLimitManager.getAccountRateLimits(accountId);
  res.json(rateLimits);
});

// Get refresh queue stats
router.get('/queue/refresh/stats', async (req, res) => {
  const stats = await refreshQueue.getStats();
  res.json(stats);
});

export default router;
```

## Step 5: Testing

### Manual Testing

1. **Test Publishing**:
```bash
# Publish a post (should use provider architecture)
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test post via provider architecture",
    "socialAccountId": "account_id_here",
    "scheduledAt": "2024-01-01T12:00:00Z"
  }'
```

2. **Test Token Refresh**:
```bash
# Trigger token refresh
curl -X POST http://localhost:3000/api/accounts/account_id_here/refresh
```

3. **Check Metrics**:
```bash
# Get global metrics
curl http://localhost:3000/api/metrics

# Get platform metrics
curl http://localhost:3000/api/metrics/twitter

# Get account metrics
curl http://localhost:3000/api/metrics/twitter/account_id_here
```

4. **Check Rate Limits**:
```bash
# Get rate limit status
curl http://localhost:3000/api/rate-limits/account_id_here
```

### Automated Testing

Create integration tests:

```typescript
import { providerFactory } from '../providers/ProviderFactory';
import { SocialPlatform } from '../models/SocialAccount';

describe('Provider Integration', () => {
  it('should publish post successfully', async () => {
    const provider = providerFactory.getProvider(SocialPlatform.TWITTER);
    
    const result = await provider.publish({
      postId: 'test-post-id',
      accountId: 'test-account-id',
      content: 'Test post',
      mediaUrls: [],
    });
    
    expect(result.success).toBe(true);
    expect(result.platformPostId).toBeDefined();
  });

  it('should refresh token successfully', async () => {
    const provider = providerFactory.getProvider(SocialPlatform.TWITTER);
    
    const result = await provider.refreshToken({
      accountId: 'test-account-id',
    });
    
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBeDefined();
  });

  it('should emit events', async () => {
    const provider = providerFactory.getProvider(SocialPlatform.TWITTER);
    
    const eventPromise = new Promise((resolve) => {
      provider.once('publish.success', resolve);
    });
    
    await provider.publish({
      postId: 'test-post-id',
      accountId: 'test-account-id',
      content: 'Test post',
      mediaUrls: [],
    });
    
    const event = await eventPromise;
    expect(event).toBeDefined();
  });
});
```

## Step 6: Monitoring

### Log Monitoring

Watch for these log messages:

```
# Provider initialization
Provider created { platform: 'twitter' }
Provider event handlers attached { platform: 'twitter' }

# Publishing
Publishing to platform via provider { postId, provider, contentLength, mediaCount }
Provider publish success { postId, provider, platformPostId }

# Token refresh
Token refresh successful { accountId, platform, priority, expiresAt, duration }
Proactive refresh scheduled { accountId, platform, expiresAt }

# Rate limits
Rate limit hit { platform, accountId, operation, resetAt }
Account rate limited { accountId, platform, operation, resetAt }

# Metrics
Publish success recorded { platform, accountId, duration, successRate }
Refresh failure recorded { platform, accountId, reason, failureRate }
```

### Metrics Dashboard

Create a dashboard to visualize:

1. **Publish Success Rate**: Per platform, per account
2. **Refresh Failure Rate**: Per platform, per account
3. **Rate Limit Incidents**: Per platform, per account
4. **Operation Duration**: Publish, refresh
5. **Queue Lag**: RefreshQueue
6. **Worker Health**: RefreshWorker status

### Alerts

Set up alerts for:

- Publish success rate < 95%
- Refresh failure rate > 5%
- Rate limit incidents > 10/hour
- Queue lag > 60 seconds
- Worker not running

## Troubleshooting

### Provider Not Found

**Error**: `Unknown platform: twitter`

**Solution**: Check environment variables are set:
```bash
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_REDIRECT_URI=your_redirect_uri
```

### Token Refresh Fails

**Error**: `Token refresh failed: invalid_grant`

**Solution**: 
1. Check refresh token is valid
2. Verify API credentials
3. Check if token was revoked by user

### Publishing Fails

**Error**: `Provider publish failed: unauthorized`

**Solution**:
1. Check account status is 'active'
2. Verify token is not expired
3. Try refreshing token first

### Rate Limit Hit

**Error**: `Rate limit hit`

**Solution**:
1. Check GlobalRateLimitManager for reset time
2. Wait for rate limit to reset
3. Reduce publishing frequency

### RefreshWorker Not Running

**Error**: No refresh jobs being processed

**Solution**:
1. Check RefreshWorker is started
2. Check Redis connection
3. Check worker logs for errors

## Best Practices

1. **Always use RefreshQueue** for token refresh (don't call provider directly)
2. **Check rate limits** before publishing
3. **Monitor metrics** regularly
4. **Set up alerts** for failures
5. **Use event handlers** for custom logic
6. **Test with real accounts** before production
7. **Keep provider configuration** in environment variables
8. **Log all operations** for debugging

## Next Steps

1. ✅ Integrate provider architecture
2. ✅ Start RefreshWorker
3. ✅ Attach event handlers
4. ✅ Add monitoring endpoints
5. [ ] Test with real Twitter account
6. [ ] Set up monitoring dashboard
7. [ ] Set up alerts
8. [ ] Add more platforms (LinkedIn, Facebook, etc.)

## Support

For issues or questions:
1. Check logs for error messages
2. Review provider architecture documentation
3. Check metrics for anomalies
4. Test with manual API calls
5. Review event emissions

## Conclusion

The provider architecture is now integrated and ready to use. Follow this guide to ensure proper setup and monitoring.
