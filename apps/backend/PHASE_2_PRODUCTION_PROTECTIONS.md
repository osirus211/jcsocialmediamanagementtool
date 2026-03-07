# Phase 2: Production-Grade Protections
## Webhook Verification Cache & Event Ordering

**Date:** 2026-03-04  
**Version:** 2.1 (Production Enhancements)  
**Status:** Architecture Enhancement - Ready for Review

---

## Table of Contents
1. [Overview](#overview)
2. [Webhook Verification Cache](#webhook-verification-cache)
3. [Event Ordering Protection](#event-ordering-protection)
4. [Redis Key Schema](#redis-key-schema)
5. [Updated Event Processing Flow](#updated-event-processing-flow)
6. [Implementation Details](#implementation-details)
7. [Performance Impact](#performance-impact)

---

## Overview

### Production Challenges

**Challenge 1: Expensive Signature Verification**
- HMAC SHA256 computation is CPU-intensive
- Platforms retry webhooks (3-5 times)
- Same signature verified multiple times
- Wastes CPU resources

**Challenge 2: Out-of-Order Events**
- Network delays cause events to arrive out of order
- Processing old events can overwrite newer state
- Example: "account_connected" arrives after "account_disconnected"
- Can cause data inconsistency

### Solutions

**Solution 1: Verification Cache**
- Cache signature verification results in Redis
- Skip expensive HMAC computation on retries
- 5-minute TTL (covers typical retry window)
- Reduces CPU usage by 60-80% during retries

**Solution 2: Event Ordering Protection**
- Track last processed timestamp per resource
- Reject events older than last processed
- Prevent stale events from overwriting current state
- Ensures data consistency

---

## Webhook Verification Cache

### Purpose

Prevent repeated expensive signature verification during webhook retries by caching verification results.

### Cache Strategy

**Key Format:**
```
webhook:verified:{provider}:{signature_hash}
```

**Value:**
```json
{
  "verified": true,
  "timestamp": "2024-03-04T12:00:00.000Z",
  "provider": "facebook"
}
```

**TTL:** 5 minutes (300 seconds)

### Signature Hash Generation

```typescript
function generateSignatureHash(signature: string): string {
  // Use SHA256 to hash the signature for cache key
  return crypto
    .createHash('sha256')
    .update(signature)
    .digest('hex')
    .substring(0, 16); // First 16 chars for shorter key
}
```

### Verification Flow with Cache

```
1. Extract signature from headers
    ↓
2. Generate signature hash
    ↓
3. Check cache: GET webhook:verified:{provider}:{hash}
    ↓
    ├─── Cache HIT ────────────────────────────────────┐
    │                                                   │
    │   ✅ Skip HMAC verification                       │
    │   ✅ Log cache hit                                │
    │   ✅ Continue processing                          │
    │                                                   │
    └───────────────────────────────────────────────────┘
    │
    └─── Cache MISS ───────────────────────────────────┐
                                                        │
        ❌ Perform HMAC verification                    │
        ❌ If valid: Cache result (TTL: 5 min)          │
        ❌ If invalid: Throw error (don't cache)        │
                                                        │
        └───────────────────────────────────────────────┘
```

### Implementation Structure

```typescript
export class WebhookVerificationCache {
  constructor(private redis: Redis) {}

  /**
   * Check if signature was already verified
   */
  async isVerified(provider: string, signature: string): Promise<boolean> {
    const hash = this.generateSignatureHash(signature);
    const key = `webhook:verified:${provider}:${hash}`;
    
    const cached = await this.redis.get(key);
    
    if (cached) {
      logger.debug('Verification cache hit', {
        provider,
        signatureHash: hash,
      });
      return true;
    }
    
    return false;
  }

  /**
   * Cache successful verification
   */
  async cacheVerification(provider: string, signature: string): Promise<void> {
    const hash = this.generateSignatureHash(signature);
    const key = `webhook:verified:${provider}:${hash}`;
    
    const value = JSON.stringify({
      verified: true,
      timestamp: new Date().toISOString(),
      provider,
    });
    
    await this.redis.setex(key, 300, value); // 5 minutes TTL
    
    logger.debug('Verification cached', {
      provider,
      signatureHash: hash,
      ttl: 300,
    });
  }

  /**
   * Generate signature hash for cache key
   */
  private generateSignatureHash(signature: string): string {
    return crypto
      .createHash('sha256')
      .update(signature)
      .digest('hex')
      .substring(0, 16);
  }
}
```

### Updated Provider Interface

```typescript
export interface IWebhookProvider {
  name: string;
  
  /**
   * Verify webhook signature
   * 
   * @param headers - Request headers
   * @param rawBody - Raw request body
   * @param cache - Verification cache (optional)
   * @returns true if valid
   */
  verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer,
    cache?: WebhookVerificationCache
  ): Promise<boolean>;
  
  extractEvent(payload: any): Promise<WebhookEvent>;
  normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent>;
  handleChallenge?(req: Request, res: Response): Promise<boolean>;
}
```

### Provider Implementation with Cache

```typescript
export class FacebookWebhookProvider implements IWebhookProvider {
  readonly name = 'facebook';

  async verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer,
    cache?: WebhookVerificationCache
  ): Promise<boolean> {
    const signature = headers['x-hub-signature-256'] as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing signature header');
    }

    // Check cache first
    if (cache) {
      const isCached = await cache.isVerified(this.name, signature);
      if (isCached) {
        logger.info('Signature verification skipped (cached)', {
          provider: this.name,
        });
        return true;
      }
    }

    // Perform HMAC verification
    const expectedSignature = crypto
      .createHmac('sha256', process.env.FACEBOOK_APP_SECRET!)
      .update(rawBody)
      .digest('hex');

    const isValid = signature === `sha256=${expectedSignature}`;
    
    if (!isValid) {
      throw new WebhookSignatureError('Invalid signature');
    }

    // Cache successful verification
    if (cache) {
      await cache.cacheVerification(this.name, signature);
    }

    return true;
  }

  // ... other methods
}
```

### Benefits

1. **Performance:** 60-80% reduction in CPU usage during retries
2. **Cost Savings:** Reduced compute costs
3. **Faster Response:** Skip expensive HMAC computation
4. **Retry Friendly:** Handles platform retries efficiently

### Security Considerations

1. **Short TTL:** 5 minutes prevents long-term cache poisoning
2. **Hash-Based Keys:** Signature hash prevents key collision
3. **No Caching of Invalid Signatures:** Only cache successful verifications
4. **Per-Provider Keys:** Isolate cache per provider

---

## Event Ordering Protection

### Purpose

Prevent out-of-order events from overwriting newer state by tracking the last processed timestamp per resource.

### Ordering Strategy

**Key Format:**
```
webhook:last_timestamp:{provider}:{resourceId}
```

**Value:**
```
1709510400000  (Unix timestamp in milliseconds)
```

**TTL:** 30 days (2592000 seconds)

### Resource ID Extraction

Different providers use different resource identifiers:

```typescript
// Facebook: User ID
resourceId = event.data.entry[0].id

// Twitter: User ID
resourceId = event.data.for_user_id

// LinkedIn: Member ID
resourceId = event.data.actor

// Instagram: User ID
resourceId = event.data.entry[0].id
```

### Ordering Check Flow

```
1. Extract event timestamp
    ↓
2. Extract resource ID (user ID, account ID, etc.)
    ↓
3. Get last processed timestamp from Redis
    GET webhook:last_timestamp:{provider}:{resourceId}
    ↓
    ├─── No stored timestamp ─────────────────────────┐
    │                                                  │
    │   ✅ First event for this resource              │
    │   ✅ Process event                              │
    │   ✅ Store timestamp                            │
    │                                                  │
    └──────────────────────────────────────────────────┘
    │
    ├─── event.timestamp > stored_timestamp ──────────┐
    │                                                  │
    │   ✅ Newer event                                │
    │   ✅ Process event                              │
    │   ✅ Update timestamp                           │
    │                                                  │
    └──────────────────────────────────────────────────┘
    │
    └─── event.timestamp <= stored_timestamp ─────────┐
                                                       │
        ❌ Out-of-order event (stale)                 │
        ❌ Log and ignore                             │
        ❌ Don't process                              │
        ❌ Return 202 Accepted                        │
                                                       │
        └───────────────────────────────────────────────┘
```

### Implementation Structure

```typescript
export class WebhookOrderingService {
  constructor(private redis: Redis) {}

  /**
   * Check if event is in order
   * 
   * @returns true if event should be processed, false if out of order
   */
  async isInOrder(
    provider: string,
    resourceId: string,
    eventTimestamp: Date
  ): Promise<boolean> {
    const key = `webhook:last_timestamp:${provider}:${resourceId}`;
    const eventTs = eventTimestamp.getTime();
    
    // Get last processed timestamp
    const lastTsStr = await this.redis.get(key);
    
    if (!lastTsStr) {
      // First event for this resource
      logger.debug('First event for resource', {
        provider,
        resourceId,
        eventTimestamp: eventTimestamp.toISOString(),
      });
      return true;
    }
    
    const lastTs = parseInt(lastTsStr, 10);
    
    if (eventTs > lastTs) {
      // Newer event
      logger.debug('Event is newer', {
        provider,
        resourceId,
        eventTimestamp: eventTimestamp.toISOString(),
        lastTimestamp: new Date(lastTs).toISOString(),
        delta: eventTs - lastTs,
      });
      return true;
    }
    
    // Out of order (stale event)
    logger.warn('Out-of-order event detected', {
      provider,
      resourceId,
      eventTimestamp: eventTimestamp.toISOString(),
      lastTimestamp: new Date(lastTs).toISOString(),
      delta: eventTs - lastTs,
      alert: 'OUT_OF_ORDER_EVENT',
    });
    
    return false;
  }

  /**
   * Update last processed timestamp
   */
  async updateTimestamp(
    provider: string,
    resourceId: string,
    eventTimestamp: Date
  ): Promise<void> {
    const key = `webhook:last_timestamp:${provider}:${resourceId}`;
    const eventTs = eventTimestamp.getTime();
    
    // Store with 30-day TTL
    await this.redis.setex(key, 2592000, eventTs.toString());
    
    logger.debug('Updated last timestamp', {
      provider,
      resourceId,
      timestamp: eventTimestamp.toISOString(),
    });
  }

  /**
   * Get last processed timestamp
   */
  async getLastTimestamp(
    provider: string,
    resourceId: string
  ): Promise<Date | null> {
    const key = `webhook:last_timestamp:${provider}:${resourceId}`;
    const lastTsStr = await this.redis.get(key);
    
    if (!lastTsStr) {
      return null;
    }
    
    return new Date(parseInt(lastTsStr, 10));
  }
}
```

### Resource ID Extraction per Provider

```typescript
export abstract class BaseWebhookProvider implements IWebhookProvider {
  /**
   * Extract resource ID from event
   * Used for ordering protection
   */
  protected abstract extractResourceId(event: WebhookEvent): string | undefined;
}

export class FacebookWebhookProvider extends BaseWebhookProvider {
  protected extractResourceId(event: WebhookEvent): string | undefined {
    return event.data.entry?.[0]?.id;
  }
}

export class TwitterWebhookProvider extends BaseWebhookProvider {
  protected extractResourceId(event: WebhookEvent): string | undefined {
    return event.data.for_user_id || event.data.revoke?.source?.user_id;
  }
}

export class LinkedInWebhookProvider extends BaseWebhookProvider {
  protected extractResourceId(event: WebhookEvent): string | undefined {
    return event.data.actor;
  }
}
```

### Benefits

1. **Data Consistency:** Prevents stale events from overwriting current state
2. **Idempotency:** Safe to process same event multiple times
3. **Network Resilience:** Handles network delays gracefully
4. **Audit Trail:** Logs all out-of-order events

### Edge Cases

**Case 1: Events with same timestamp**
```typescript
if (eventTs >= lastTs) {  // Use >= instead of >
  return true;  // Allow events with same timestamp
}
```

**Case 2: Clock skew between platforms**
```typescript
// Allow small clock skew (e.g., 5 seconds)
const CLOCK_SKEW_TOLERANCE = 5000; // 5 seconds

if (eventTs + CLOCK_SKEW_TOLERANCE > lastTs) {
  return true;
}
```

**Case 3: Missing timestamp**
```typescript
if (!eventTimestamp) {
  // If event has no timestamp, use current time
  eventTimestamp = new Date();
  logger.warn('Event missing timestamp, using current time', {
    provider,
    resourceId,
  });
}
```

---


## Redis Key Schema

### Complete Redis Key Structure

```
Redis (Port 6380)
│
├── Deduplication Keys (Phase 2)
│   ├── webhook:dedup:facebook:evt_abc123
│   ├── webhook:dedup:linkedin:evt_def456
│   ├── webhook:dedup:twitter:evt_ghi789
│   └── ... (TTL: 24 hours)
│
├── Verification Cache Keys (Phase 2.1 - NEW)
│   ├── webhook:verified:facebook:a1b2c3d4e5f6g7h8
│   ├── webhook:verified:linkedin:1a2b3c4d5e6f7g8h
│   ├── webhook:verified:twitter:9i8h7g6f5e4d3c2b
│   └── ... (TTL: 5 minutes)
│
├── Event Ordering Keys (Phase 2.1 - NEW)
│   ├── webhook:last_timestamp:facebook:123456789
│   ├── webhook:last_timestamp:linkedin:987654321
│   ├── webhook:last_timestamp:twitter:555666777
│   └── ... (TTL: 30 days)
│
├── BullMQ Queue Keys - Stage 1 (Phase 2)
│   ├── bull:webhook-ingest-queue:wait
│   ├── bull:webhook-ingest-queue:active
│   ├── bull:webhook-ingest-queue:delayed
│   ├── bull:webhook-ingest-queue:completed
│   ├── bull:webhook-ingest-queue:failed
│   └── ...
│
├── BullMQ Queue Keys - Stage 2 (Phase 2)
│   ├── bull:webhook-processing-queue:wait
│   ├── bull:webhook-processing-queue:active
│   ├── bull:webhook-processing-queue:delayed
│   ├── bull:webhook-processing-queue:completed
│   ├── bull:webhook-processing-queue:failed
│   └── ...
│
└── Phase 1B Keys (DO NOT MODIFY)
    ├── oauth:circuit:facebook
    ├── oauth:circuit:twitter
    ├── oauth:ratelimit:facebook:29543306
    ├── bull:token-refresh-queue:*
    └── ...
```

### Key Naming Conventions

| Key Type | Format | Example | TTL |
|----------|--------|---------|-----|
| Deduplication | `webhook:dedup:{provider}:{eventId}` | `webhook:dedup:facebook:evt_123` | 24 hours |
| Verification Cache | `webhook:verified:{provider}:{signatureHash}` | `webhook:verified:facebook:a1b2c3d4` | 5 minutes |
| Event Ordering | `webhook:last_timestamp:{provider}:{resourceId}` | `webhook:last_timestamp:facebook:123456789` | 30 days |

### Key Size Estimates

**Per Provider (assuming 1000 events/day):**

| Key Type | Keys per Day | Storage per Key | Total Storage |
|----------|--------------|-----------------|---------------|
| Deduplication | 1000 | ~200 bytes | ~200 KB |
| Verification Cache | 3000-5000 (retries) | ~150 bytes | ~450-750 KB |
| Event Ordering | 100 (unique resources) | ~100 bytes | ~10 KB |

**Total per Provider:** ~660-960 KB/day  
**Total for 7 Providers:** ~4.6-6.7 MB/day

**Redis Memory Impact:** Negligible (< 10 MB total)

---

## Updated Event Processing Flow

### Complete Flow with Protections

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Platform Webhook Request                         │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: Provider Resolution                                        │
│  registry.getProvider(req.params.provider)                          │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: Signature Verification (with Cache)                        │
│                                                                     │
│  1. Extract signature from headers                                  │
│  2. Check verification cache                                        │
│     ├─ Cache HIT → Skip HMAC verification ✅                        │
│     └─ Cache MISS → Perform HMAC verification                       │
│        ├─ Valid → Cache result ✅                                   │
│        └─ Invalid → Throw 401 ❌                                    │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: Event Extraction                                           │
│  provider.extractEvent(payload)                                     │
│  → Raw WebhookEvent { id, type, timestamp, data }                   │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: Event Normalization                                        │
│  provider.normalizeEvent(event)                                     │
│  → NormalizedWebhookEvent { eventId, provider, eventType, ... }     │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: Idempotency Check                                          │
│  deduplicationService.isDuplicate(provider, eventId)                │
│  ├─ Duplicate → Return 202 Accepted ✅                              │
│  └─ Not Duplicate → Continue                                        │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 6: Event Ordering Check (NEW)                                 │
│  orderingService.isInOrder(provider, resourceId, timestamp)         │
│  ├─ Out of Order → Log & Return 202 Accepted ⚠️                     │
│  └─ In Order → Continue                                             │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 7: Enqueue to Stage 1                                         │
│  ingestQueue.add(normalizedEvent)                                   │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 8: Update Ordering Timestamp (NEW)                            │
│  orderingService.updateTimestamp(provider, resourceId, timestamp)   │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 9: Audit Log                                                  │
│  AuditLog.log({ action: 'webhook.received', ... })                  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 10: Return 200 OK                                             │
│  { received: true, eventId: '...' }                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Updated Controller Implementation

```typescript
export class WebhookController {
  constructor(
    private providerRegistry: WebhookProviderRegistry,
    private deduplicationService: WebhookDeduplicationService,
    private verificationCache: WebhookVerificationCache,      // NEW
    private orderingService: WebhookOrderingService,          // NEW
    private ingestQueue: WebhookIngestQueue,
    private auditLog: typeof AuditLog
  ) {}

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const providerName = req.params.provider;
    const correlationId = generateCorrelationId();

    try {
      // STEP 1: Resolve provider
      const provider = this.providerRegistry.getProvider(providerName);

      // STEP 2: Verify signature (with cache)
      const isValid = await provider.verifySignature(
        req.headers,
        req.rawBody,
        this.verificationCache  // Pass cache
      );

      if (!isValid) {
        throw new WebhookSignatureError('Invalid signature');
      }

      // STEP 3: Extract event
      const rawEvent = await provider.extractEvent(req.body);

      // STEP 4: Normalize event
      const normalizedEvent = await provider.normalizeEvent(rawEvent);
      normalizedEvent.metadata.correlationId = correlationId;

      // STEP 5: Check idempotency
      const isDuplicate = await this.deduplicationService.isDuplicate(
        providerName,
        normalizedEvent.eventId
      );

      if (isDuplicate) {
        logger.info('Duplicate webhook event', {
          provider: providerName,
          eventId: normalizedEvent.eventId,
          correlationId,
        });

        await this.auditLog.log({
          userId: SYSTEM_USER_ID,
          workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
          action: 'webhook.duplicate',
          entityType: 'webhook_event',
          entityId: normalizedEvent.eventId,
          metadata: { provider: providerName, correlationId },
        });

        return res.status(202).json({
          received: true,
          duplicate: true,
          eventId: normalizedEvent.eventId,
        });
      }

      // STEP 6: Check event ordering (NEW)
      const resourceId = provider.extractResourceId?.(rawEvent);
      
      if (resourceId) {
        const isInOrder = await this.orderingService.isInOrder(
          providerName,
          resourceId,
          normalizedEvent.timestamp
        );

        if (!isInOrder) {
          logger.warn('Out-of-order webhook event', {
            provider: providerName,
            eventId: normalizedEvent.eventId,
            resourceId,
            timestamp: normalizedEvent.timestamp,
            correlationId,
          });

          await this.auditLog.log({
            userId: SYSTEM_USER_ID,
            workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
            action: 'webhook.out_of_order',
            entityType: 'webhook_event',
            entityId: normalizedEvent.eventId,
            metadata: {
              provider: providerName,
              resourceId,
              timestamp: normalizedEvent.timestamp,
              correlationId,
            },
          });

          return res.status(202).json({
            received: true,
            outOfOrder: true,
            eventId: normalizedEvent.eventId,
          });
        }
      }

      // STEP 7: Mark as processed (idempotency)
      await this.deduplicationService.markProcessed(
        providerName,
        normalizedEvent.eventId,
        { correlationId }
      );

      // STEP 8: Enqueue to Stage 1
      await this.ingestQueue.add('webhook-ingest', {
        eventId: normalizedEvent.eventId,
        provider: providerName,
        rawEvent,
        normalizedEvent,
        metadata: {
          receivedAt: new Date(),
          correlationId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }, {
        jobId: `webhook-ingest:${providerName}:${normalizedEvent.eventId}`,
      });

      // STEP 9: Update ordering timestamp (NEW)
      if (resourceId) {
        await this.orderingService.updateTimestamp(
          providerName,
          resourceId,
          normalizedEvent.timestamp
        );
      }

      // STEP 10: Audit log
      await this.auditLog.log({
        userId: SYSTEM_USER_ID,
        workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
        action: 'webhook.received',
        entityType: 'webhook_event',
        entityId: normalizedEvent.eventId,
        metadata: {
          provider: providerName,
          eventType: normalizedEvent.eventType,
          correlationId,
        },
      });

      // STEP 11: Return 200 OK
      res.status(200).json({
        received: true,
        eventId: normalizedEvent.eventId,
      });

    } catch (error: any) {
      // Error handling...
    }
  }
}
```

---

## Implementation Details

### Service Integration

```typescript
// Initialize services
const verificationCache = new WebhookVerificationCache(redis);
const orderingService = new WebhookOrderingService(redis);

// Pass to controller
const webhookController = new WebhookController(
  providerRegistry,
  deduplicationService,
  verificationCache,      // NEW
  orderingService,        // NEW
  ingestQueue,
  AuditLog
);
```

### Provider Interface Update

```typescript
export interface IWebhookProvider {
  name: string;
  
  verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer,
    cache?: WebhookVerificationCache  // NEW - Optional cache
  ): Promise<boolean>;
  
  extractEvent(payload: any): Promise<WebhookEvent>;
  
  normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent>;
  
  extractResourceId?(event: WebhookEvent): string | undefined;  // NEW - Optional
  
  handleChallenge?(req: Request, res: Response): Promise<boolean>;
}
```

### Base Provider Implementation

```typescript
export abstract class BaseWebhookProvider implements IWebhookProvider {
  abstract readonly name: string;
  
  abstract verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer,
    cache?: WebhookVerificationCache
  ): Promise<boolean>;
  
  abstract extractEvent(payload: any): Promise<WebhookEvent>;
  
  abstract normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent>;
  
  /**
   * Extract resource ID for ordering protection
   * Override in subclass if provider supports ordering
   */
  extractResourceId?(event: WebhookEvent): string | undefined {
    return undefined;
  }
}
```

---

## Performance Impact

### Verification Cache Impact

**Without Cache (Baseline):**
- HMAC SHA256 computation: ~1-2ms per request
- Platform retries: 3-5 times
- Total CPU time: 3-10ms per event

**With Cache:**
- Cache lookup: ~0.1ms
- HMAC computation (first request only): ~1-2ms
- Subsequent requests (cache hit): ~0.1ms
- Total CPU time: ~1.5-2.5ms per event

**Performance Improvement:** 60-80% reduction in CPU usage

### Ordering Check Impact

**Ordering Check:**
- Redis GET operation: ~0.1-0.2ms
- Redis SET operation: ~0.1-0.2ms
- Total overhead: ~0.2-0.4ms per request

**Performance Impact:** Negligible (< 1% overhead)

### Combined Impact

**Total Processing Time:**
- Without protections: ~5-10ms
- With protections: ~3-6ms (first request), ~1-2ms (cached)

**Overall Improvement:** 40-60% faster on retries

---

## Monitoring Metrics

### Verification Cache Metrics

```typescript
// Cache hit rate
webhook_verification_cache_hit_total (counter)
webhook_verification_cache_miss_total (counter)
webhook_verification_cache_hit_rate (gauge)

// Performance
webhook_verification_duration_ms (histogram)
  - with_cache: true/false
  - cache_hit: true/false
```

### Ordering Metrics

```typescript
// Out-of-order events
webhook_out_of_order_total (counter)
  - provider
  - event_type

// Ordering check duration
webhook_ordering_check_duration_ms (histogram)

// Timestamp delta (for monitoring clock skew)
webhook_timestamp_delta_ms (histogram)
  - provider
```

### Alert Thresholds

**Verification Cache:**
- Cache hit rate < 50% → Warning (expected: 60-80%)
- Cache hit rate < 30% → Critical

**Event Ordering:**
- Out-of-order events > 5% → Warning
- Out-of-order events > 10% → Critical
- Timestamp delta > 60 seconds → Warning (clock skew)

---

## Testing Strategy

### Verification Cache Tests

```typescript
describe('WebhookVerificationCache', () => {
  it('should cache successful verification', async () => {
    await cache.cacheVerification('facebook', 'sha256=abc123');
    const isVerified = await cache.isVerified('facebook', 'sha256=abc123');
    expect(isVerified).toBe(true);
  });

  it('should expire after TTL', async () => {
    await cache.cacheVerification('facebook', 'sha256=abc123');
    // Wait 6 minutes
    await sleep(360000);
    const isVerified = await cache.isVerified('facebook', 'sha256=abc123');
    expect(isVerified).toBe(false);
  });

  it('should generate consistent signature hash', () => {
    const hash1 = cache.generateSignatureHash('sha256=abc123');
    const hash2 = cache.generateSignatureHash('sha256=abc123');
    expect(hash1).toBe(hash2);
  });
});
```

### Event Ordering Tests

```typescript
describe('WebhookOrderingService', () => {
  it('should allow first event', async () => {
    const isInOrder = await ordering.isInOrder(
      'facebook',
      '123456789',
      new Date('2024-03-04T12:00:00Z')
    );
    expect(isInOrder).toBe(true);
  });

  it('should allow newer event', async () => {
    await ordering.updateTimestamp(
      'facebook',
      '123456789',
      new Date('2024-03-04T12:00:00Z')
    );
    
    const isInOrder = await ordering.isInOrder(
      'facebook',
      '123456789',
      new Date('2024-03-04T12:01:00Z')
    );
    expect(isInOrder).toBe(true);
  });

  it('should reject older event', async () => {
    await ordering.updateTimestamp(
      'facebook',
      '123456789',
      new Date('2024-03-04T12:00:00Z')
    );
    
    const isInOrder = await ordering.isInOrder(
      'facebook',
      '123456789',
      new Date('2024-03-04T11:59:00Z')
    );
    expect(isInOrder).toBe(false);
  });
});
```

---

## Updated File Structure

```
apps/backend/src/
├── types/
│   └── webhook.types.ts
│
├── providers/webhooks/
│   ├── BaseWebhookProvider.ts
│   ├── FacebookWebhookProvider.ts
│   ├── LinkedInWebhookProvider.ts
│   ├── TwitterWebhookProvider.ts
│   ├── InstagramWebhookProvider.ts
│   ├── YouTubeWebhookProvider.ts
│   ├── TikTokWebhookProvider.ts
│   ├── ThreadsWebhookProvider.ts
│   ├── WebhookProviderRegistry.ts
│   └── index.ts
│
├── services/
│   ├── WebhookDeduplicationService.ts
│   ├── WebhookVerificationCache.ts        # NEW
│   └── WebhookOrderingService.ts          # NEW
│
├── queue/
│   ├── WebhookIngestQueue.ts
│   └── WebhookProcessingQueue.ts
│
├── controllers/
│   └── WebhookController.ts               # UPDATED
│
├── routes/v1/
│   └── webhook.routes.ts
│
└── middleware/
    ├── rawBodyParser.ts
    └── webhookAuth.ts
```

---

## Success Criteria (Updated)

Phase 2 V2.1 is complete when:

1. ✅ Unified endpoint implemented (`/webhooks/:provider`)
2. ✅ Provider registry with 7 providers registered
3. ✅ All providers implement `IWebhookProvider` interface
4. ✅ Two-stage queue pipeline operational
5. ✅ Event normalization working for all providers
6. ✅ Idempotency enforced via Redis
7. ✅ **Verification cache implemented (NEW)**
8. ✅ **Event ordering protection implemented (NEW)**
9. ✅ All events logged to AuditLog
10. ✅ Unit tests pass (>80% coverage)
11. ✅ Integration tests pass
12. ✅ Documentation complete
13. ✅ No Phase 1B modifications

---

**END OF PRODUCTION PROTECTIONS SPECIFICATION**
