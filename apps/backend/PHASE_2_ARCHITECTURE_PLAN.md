# Phase 2: Event-Driven Platform Integration
## Architecture Design Plan

**Date:** 2026-03-04  
**Status:** Design Phase  
**Objective:** Implement webhook ingestion system for platform events

---

## Table of Contents
1. [Overview](#overview)
2. [Webhook Endpoint Structure](#webhook-endpoint-structure)
3. [Signature Verification Strategy](#signature-verification-strategy)
4. [Queue Design](#queue-design)
5. [Event Deduplication Strategy](#event-deduplication-strategy)
6. [Audit Logging Schema](#audit-logging-schema)
7. [Implementation Plan](#implementation-plan)
8. [Security Considerations](#security-considerations)
9. [Monitoring & Observability](#monitoring--observability)

---

## Overview

### Goals
- Handle platform webhook events (token revocations, permission changes, account disconnects)
- Ensure webhook authenticity through signature verification
- Prevent blocking API threads with async queue processing
- Implement idempotent event processing
- Maintain comprehensive audit logs

### Non-Goals (Phase 2)
- Do NOT modify Phase 1B infrastructure (Circuit Breaker, Rate Limiter, Token Refresh)
- Do NOT implement event processing logic (Phase 3)
- Do NOT implement retry mechanisms for failed webhooks (Phase 3)

### Architecture Principles
1. **Security First:** All webhooks must be verified before processing
2. **Non-Blocking:** Webhook ingestion must not block API threads
3. **Idempotency:** Duplicate events must be detected and ignored
4. **Auditability:** All webhook events must be logged
5. **Scalability:** Design for high-volume webhook traffic

---

## Webhook Endpoint Structure

### Endpoint Routes

```
POST /api/v1/webhooks/facebook
POST /api/v1/webhooks/linkedin
POST /api/v1/webhooks/twitter
POST /api/v1/webhooks/instagram
POST /api/v1/webhooks/youtube
POST /api/v1/webhooks/tiktok
POST /api/v1/webhooks/threads
```

### Endpoint Responsibilities

Each webhook endpoint must:
1. **Verify Signature** - Authenticate the request using platform-specific verification
2. **Validate Payload** - Ensure payload structure is valid
3. **Check Idempotency** - Detect and reject duplicate events
4. **Enqueue Event** - Push to `webhook-events-queue` for async processing
5. **Log Event** - Store in AuditLog collection
6. **Return 200 OK** - Acknowledge receipt immediately

### Request Flow

```
Platform Webhook → Signature Verification → Payload Validation → 
Idempotency Check → Enqueue to BullMQ → Audit Log → 200 OK Response
```

### Response Codes

- `200 OK` - Event received and queued
- `202 Accepted` - Event already processed (idempotent)
- `400 Bad Request` - Invalid payload structure
- `401 Unauthorized` - Invalid signature
- `500 Internal Server Error` - System error

---

## Signature Verification Strategy

### Platform-Specific Verification

#### 1. Facebook / Instagram
**Header:** `X-Hub-Signature-256`  
**Algorithm:** HMAC SHA256

```typescript
// Verification Logic
const signature = req.headers['x-hub-signature-256'];
const expectedSignature = crypto
  .createHmac('sha256', FACEBOOK_APP_SECRET)
  .update(rawBody)
  .digest('hex');

if (signature !== `sha256=${expectedSignature}`) {
  throw new Error('Invalid signature');
}
```

**Environment Variables:**
- `FACEBOOK_APP_SECRET` (existing)
- `INSTAGRAM_APP_SECRET` (existing)

#### 2. LinkedIn
**Header:** `X-LinkedIn-Signature`  
**Algorithm:** HMAC SHA256

```typescript
// Verification Logic
const signature = req.headers['x-linkedin-signature'];
const expectedSignature = crypto
  .createHmac('sha256', LINKEDIN_CLIENT_SECRET)
  .update(rawBody)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

**Environment Variables:**
- `LINKEDIN_CLIENT_SECRET` (existing)

#### 3. Twitter
**Header:** `X-Twitter-Webhooks-Signature`  
**Algorithm:** HMAC SHA256 + CRC Challenge

```typescript
// CRC Challenge Response (GET request)
const crc_token = req.query.crc_token;
const response_token = crypto
  .createHmac('sha256', TWITTER_CONSUMER_SECRET)
  .update(crc_token)
  .digest('base64');

res.json({ response_token: `sha256=${response_token}` });

// Webhook Verification (POST request)
const signature = req.headers['x-twitter-webhooks-signature'];
const expectedSignature = crypto
  .createHmac('sha256', TWITTER_CONSUMER_SECRET)
  .update(rawBody)
  .digest('base64');

if (signature !== `sha256=${expectedSignature}`) {
  throw new Error('Invalid signature');
}
```

**Environment Variables:**
- `TWITTER_CONSUMER_SECRET` (new - add to .env)

**Special Handling:**
- Twitter requires CRC challenge endpoint (GET request)
- Must respond to periodic CRC challenges to keep webhook active

#### 4. YouTube / Google Business
**Header:** `X-Goog-Signature`  
**Algorithm:** HMAC SHA256

```typescript
// Verification Logic
const signature = req.headers['x-goog-signature'];
const expectedSignature = crypto
  .createHmac('sha256', GOOGLE_WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

**Environment Variables:**
- `GOOGLE_WEBHOOK_SECRET` (new - add to .env)

#### 5. TikTok
**Header:** `X-TikTok-Signature`  
**Algorithm:** HMAC SHA256

```typescript
// Verification Logic
const signature = req.headers['x-tiktok-signature'];
const expectedSignature = crypto
  .createHmac('sha256', TIKTOK_CLIENT_SECRET)
  .update(rawBody)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

**Environment Variables:**
- `TIKTOK_CLIENT_SECRET` (new - add to .env)

#### 6. Threads (Meta)
**Header:** `X-Hub-Signature-256`  
**Algorithm:** HMAC SHA256 (same as Facebook)

```typescript
// Verification Logic (same as Facebook)
const signature = req.headers['x-hub-signature-256'];
const expectedSignature = crypto
  .createHmac('sha256', THREADS_CLIENT_SECRET)
  .update(rawBody)
  .digest('hex');

if (signature !== `sha256=${expectedSignature}`) {
  throw new Error('Invalid signature');
}
```

**Environment Variables:**
- `THREADS_CLIENT_SECRET` (existing)

### Signature Verification Service

Create a centralized `WebhookSignatureService` to handle all platform verifications:

```typescript
// src/services/WebhookSignatureService.ts
export class WebhookSignatureService {
  verifyFacebook(rawBody: Buffer, signature: string): boolean;
  verifyLinkedIn(rawBody: Buffer, signature: string): boolean;
  verifyTwitter(rawBody: Buffer, signature: string): boolean;
  verifyYouTube(rawBody: Buffer, signature: string): boolean;
  verifyTikTok(rawBody: Buffer, signature: string): boolean;
  verifyThreads(rawBody: Buffer, signature: string): boolean;
  
  // Generic verification
  verify(provider: string, rawBody: Buffer, signature: string): boolean;
}
```

---

## Queue Design

### Queue Name
`webhook-events-queue`

### Queue Configuration

```typescript
{
  name: 'webhook-events-queue',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 25s, 125s
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      count: 5000,
    },
  },
}
```

### Job Structure

```typescript
interface WebhookEventJob {
  eventId: string;           // Unique event ID from platform
  provider: string;          // 'facebook', 'linkedin', 'twitter', etc.
  eventType: string;         // 'token_revoked', 'permission_changed', etc.
  payload: any;              // Raw webhook payload
  timestamp: Date;           // Event timestamp
  correlationId: string;     // For tracing
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    receivedAt: Date;
  };
}
```

### Job Naming Convention

```typescript
const jobName = `webhook-event-${provider}`;
const jobId = `webhook:${provider}:${eventId}`;
```

### Worker Configuration

```typescript
{
  concurrency: 10,           // Process 10 events concurrently
  limiter: {
    max: 100,                // Max 100 jobs per minute
    duration: 60000,
  },
  lockDuration: 30000,       // 30 second lock
  lockRenewTime: 15000,      // Renew every 15 seconds
}
```

### Queue Responsibilities

The webhook events queue will:
1. **Store events** for async processing
2. **Retry failed events** with exponential backoff
3. **Prevent blocking** the API thread
4. **Enable monitoring** of event processing

### Worker Responsibilities (Phase 3)

The webhook events worker will (Phase 3 implementation):
1. Process event based on type
2. Update SocialAccount status if needed
3. Trigger token refresh if needed
4. Send notifications to users
5. Log processing results

---

## Event Deduplication Strategy

### Redis-Based Deduplication

Use Redis to track processed events with TTL expiration.

### Key Structure

```
webhook:dedup:{provider}:{eventId}
```

### TTL Strategy

- **TTL:** 24 hours (86400 seconds)
- **Rationale:** Platforms may retry webhooks within 24 hours
- **Cleanup:** Automatic via Redis TTL

### Deduplication Flow

```typescript
// 1. Generate deduplication key
const dedupKey = `webhook:dedup:${provider}:${eventId}`;

// 2. Check if event already processed
const exists = await redis.exists(dedupKey);

if (exists) {
  logger.info('Duplicate webhook event detected', {
    provider,
    eventId,
    correlationId,
  });
  
  return {
    status: 202,
    message: 'Event already processed',
  };
}

// 3. Mark event as processed (atomic operation)
await redis.setex(dedupKey, 86400, JSON.stringify({
  processedAt: new Date().toISOString(),
  correlationId,
}));

// 4. Continue processing
```

### Race Condition Protection

Use Redis `SET NX EX` for atomic check-and-set:

```typescript
const result = await redis.set(
  dedupKey,
  JSON.stringify({ processedAt: new Date().toISOString() }),
  'EX', 86400,
  'NX'  // Only set if not exists
);

if (!result) {
  // Another instance already processing this event
  return { status: 202, message: 'Event already processing' };
}
```

### Deduplication Service

```typescript
// src/services/WebhookDeduplicationService.ts
export class WebhookDeduplicationService {
  async isDuplicate(provider: string, eventId: string): Promise<boolean>;
  async markProcessed(provider: string, eventId: string, metadata: any): Promise<void>;
  async getProcessedEvent(provider: string, eventId: string): Promise<any | null>;
}
```

---

## Audit Logging Schema

### Extend Existing AuditLog Model

The existing `AuditLog` model will be used with webhook-specific actions.

### Webhook Event Schema

```typescript
// Webhook events will use existing AuditLog model
{
  userId: systemUserId,              // System user for webhook events
  workspaceId: workspaceId,          // Extracted from event payload
  action: 'webhook.received',        // Action type
  entityType: 'webhook_event',       // Entity type
  entityId: eventId,                 // Platform event ID
  metadata: {
    provider: 'facebook',
    eventType: 'token_revoked',
    payload: { ... },                // Full webhook payload
    signature: 'sha256=...',         // Signature header
    ipAddress: '1.2.3.4',
    userAgent: 'Facebook/1.0',
    correlationId: 'uuid',
    processingStatus: 'queued',      // 'queued', 'processing', 'completed', 'failed'
    queuedAt: Date,
    processedAt: Date,
    error: null,
  },
  ipAddress: '1.2.3.4',
  userAgent: 'Facebook/1.0',
  createdAt: Date,
}
```

### Webhook-Specific Actions

Add to existing `AuditActions`:

```typescript
export const AuditActions = {
  // ... existing actions ...
  
  // Webhook actions
  WEBHOOK_RECEIVED: 'webhook.received',
  WEBHOOK_PROCESSED: 'webhook.processed',
  WEBHOOK_FAILED: 'webhook.failed',
  WEBHOOK_DUPLICATE: 'webhook.duplicate',
  WEBHOOK_INVALID_SIGNATURE: 'webhook.invalid_signature',
  
  // Platform event actions
  TOKEN_REVOKED: 'platform.token_revoked',
  PERMISSION_CHANGED: 'platform.permission_changed',
  ACCOUNT_DISCONNECTED: 'platform.account_disconnected',
  PLATFORM_NOTIFICATION: 'platform.notification',
};
```

### Audit Log Queries

```typescript
// Query webhook events for a workspace
AuditLog.find({
  workspaceId,
  action: { $regex: /^webhook\./ },
  createdAt: { $gte: startDate, $lte: endDate },
}).sort({ createdAt: -1 });

// Query failed webhook events
AuditLog.find({
  action: 'webhook.failed',
  'metadata.provider': 'facebook',
}).sort({ createdAt: -1 });

// Query duplicate webhook events
AuditLog.find({
  action: 'webhook.duplicate',
  createdAt: { $gte: Date.now() - 3600000 }, // Last hour
});
```

### System User for Webhooks

Create a system user for webhook events:

```typescript
// System user ID for webhook events (no real user)
const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000000');
```

---

## Implementation Plan

### Phase 2.1: Core Infrastructure (This Phase)

#### Step 1: Webhook Signature Service
- [ ] Create `src/services/WebhookSignatureService.ts`
- [ ] Implement platform-specific verification methods
- [ ] Add unit tests for each platform
- [ ] Add environment variables to `.env`

#### Step 2: Webhook Deduplication Service
- [ ] Create `src/services/WebhookDeduplicationService.ts`
- [ ] Implement Redis-based deduplication
- [ ] Add race condition protection
- [ ] Add unit tests

#### Step 3: Webhook Queue Setup
- [ ] Create `src/queue/WebhookEventsQueue.ts`
- [ ] Configure queue with QueueManager
- [ ] Define job structure and types
- [ ] Add queue monitoring

#### Step 4: Webhook Controller
- [ ] Create `src/controllers/WebhookController.ts`
- [ ] Implement endpoint handlers for each platform
- [ ] Add signature verification middleware
- [ ] Add payload validation
- [ ] Add idempotency checks
- [ ] Add audit logging
- [ ] Add error handling

#### Step 5: Webhook Routes
- [ ] Create `src/routes/v1/webhook.routes.ts`
- [ ] Define routes for each platform
- [ ] Add raw body parser middleware (for signature verification)
- [ ] Register routes in main router

#### Step 6: Middleware
- [ ] Create `src/middleware/rawBodyParser.ts` (for signature verification)
- [ ] Create `src/middleware/webhookAuth.ts` (signature verification)

#### Step 7: Environment Configuration
- [ ] Add webhook secrets to `.env`
- [ ] Document required environment variables
- [ ] Add validation for required secrets

#### Step 8: Testing
- [ ] Unit tests for signature verification
- [ ] Unit tests for deduplication
- [ ] Integration tests for webhook endpoints
- [ ] Mock webhook payloads for each platform

#### Step 9: Documentation
- [ ] API documentation for webhook endpoints
- [ ] Platform-specific setup guides
- [ ] Troubleshooting guide

### Phase 2.2: Event Processing (Future Phase)

- [ ] Implement webhook event worker
- [ ] Process token revocation events
- [ ] Process permission change events
- [ ] Process account disconnect events
- [ ] Implement notification system
- [ ] Add retry logic for failed processing

---

## Security Considerations

### 1. Signature Verification
- **CRITICAL:** All webhooks MUST verify signatures before processing
- Reject requests with missing or invalid signatures
- Use constant-time comparison to prevent timing attacks
- Log all signature verification failures

### 2. Raw Body Preservation
- Signature verification requires raw request body
- Must use raw body parser middleware
- Do NOT parse JSON before signature verification

### 3. Rate Limiting
- Implement rate limiting per platform
- Prevent webhook flooding attacks
- Use existing rate limiter infrastructure

### 4. IP Whitelisting (Optional)
- Consider IP whitelisting for known platform IPs
- Facebook, LinkedIn, Twitter publish webhook IP ranges
- Add as optional security layer

### 5. Secrets Management
- Store webhook secrets in environment variables
- Never commit secrets to version control
- Rotate secrets periodically
- Use different secrets per environment (dev, staging, prod)

### 6. HTTPS Only
- Webhooks must only be received over HTTPS in production
- Platforms require HTTPS for webhook URLs

### 7. Payload Size Limits
- Limit webhook payload size (e.g., 1MB)
- Prevent memory exhaustion attacks

---

## Monitoring & Observability

### Metrics to Track

#### 1. Webhook Ingestion Metrics
- `webhook_received_total` (counter) - by provider, event_type
- `webhook_signature_invalid_total` (counter) - by provider
- `webhook_duplicate_total` (counter) - by provider
- `webhook_queued_total` (counter) - by provider
- `webhook_failed_total` (counter) - by provider, error_type

#### 2. Queue Metrics
- `webhook_queue_size` (gauge)
- `webhook_queue_lag_ms` (histogram)
- `webhook_processing_duration_ms` (histogram)

#### 3. Deduplication Metrics
- `webhook_dedup_hit_total` (counter)
- `webhook_dedup_miss_total` (counter)
- `webhook_dedup_race_condition_total` (counter)

### Logging Strategy

#### Log Levels

**INFO:**
- Webhook received
- Event queued
- Event processed successfully

**WARN:**
- Duplicate event detected
- Unknown event type
- Payload validation warning

**ERROR:**
- Invalid signature
- Queue enqueue failed
- Processing failed
- System error

#### Log Structure

```typescript
logger.info('Webhook received', {
  provider: 'facebook',
  eventType: 'token_revoked',
  eventId: 'evt_123',
  correlationId: 'uuid',
  ipAddress: '1.2.3.4',
  userAgent: 'Facebook/1.0',
  payloadSize: 1234,
});
```

### Alerting

#### Critical Alerts
- Signature verification failure rate > 5%
- Queue size > 10,000 events
- Processing failure rate > 10%
- Queue lag > 5 minutes

#### Warning Alerts
- Duplicate event rate > 20%
- Unknown event type detected
- Queue size > 5,000 events

---

## File Structure

```
apps/backend/src/
├── controllers/
│   └── WebhookController.ts          # NEW
├── services/
│   ├── WebhookSignatureService.ts    # NEW
│   └── WebhookDeduplicationService.ts # NEW
├── queue/
│   └── WebhookEventsQueue.ts         # NEW
├── routes/v1/
│   └── webhook.routes.ts             # NEW
├── middleware/
│   ├── rawBodyParser.ts              # NEW
│   └── webhookAuth.ts                # NEW
├── types/
│   └── webhook.types.ts              # NEW
└── models/
    └── AuditLog.ts                   # EXTEND (existing)
```

---

## Environment Variables

Add to `apps/backend/.env`:

```bash
# Webhook Secrets
TWITTER_CONSUMER_SECRET=your-twitter-consumer-secret
GOOGLE_WEBHOOK_SECRET=your-google-webhook-secret
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret

# Existing (already in .env)
FACEBOOK_APP_SECRET=67867ce028f802173aa9824cdeede653
INSTAGRAM_CLIENT_SECRET=e802739200f42e8c5d2eea9d75c1e81d
LINKEDIN_CLIENT_SECRET=mpVgDvnIyJzAbRbx
THREADS_CLIENT_SECRET=15bfa46cc128455912ab20845ab06f9d
YOUTUBE_CLIENT_SECRET=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
```

---

## Testing Strategy

### Unit Tests

1. **Signature Verification Tests**
   - Test each platform's signature verification
   - Test invalid signatures
   - Test missing signatures
   - Test malformed signatures

2. **Deduplication Tests**
   - Test duplicate detection
   - Test race conditions
   - Test TTL expiration
   - Test Redis failures

3. **Queue Tests**
   - Test job enqueueing
   - Test job structure
   - Test job deduplication

### Integration Tests

1. **Webhook Endpoint Tests**
   - Test each platform endpoint
   - Test signature verification flow
   - Test idempotency
   - Test audit logging
   - Test error responses

2. **End-to-End Tests**
   - Mock platform webhook requests
   - Verify signature verification
   - Verify queue enqueueing
   - Verify audit log creation
   - Verify deduplication

### Mock Webhook Payloads

Create mock payloads for each platform:
- `tests/fixtures/webhooks/facebook.json`
- `tests/fixtures/webhooks/linkedin.json`
- `tests/fixtures/webhooks/twitter.json`
- etc.

---

## Success Criteria

Phase 2 is complete when:

1. ✅ All webhook endpoints are implemented
2. ✅ Signature verification works for all platforms
3. ✅ Events are queued to `webhook-events-queue`
4. ✅ Idempotency is enforced via Redis
5. ✅ All events are logged to AuditLog
6. ✅ Unit tests pass (>80% coverage)
7. ✅ Integration tests pass
8. ✅ Documentation is complete
9. ✅ Environment variables are documented
10. ✅ No modifications to Phase 1B infrastructure

---

## Next Steps (Phase 3)

After Phase 2 completion:

1. Implement webhook event worker
2. Process platform events (token revocations, permission changes)
3. Update SocialAccount status based on events
4. Trigger token refresh when needed
5. Implement user notifications
6. Add retry logic for failed processing
7. Add monitoring dashboards

---

## References

### Platform Documentation

- **Facebook Webhooks:** https://developers.facebook.com/docs/graph-api/webhooks
- **LinkedIn Webhooks:** https://learn.microsoft.com/en-us/linkedin/shared/api-guide/webhooks
- **Twitter Webhooks:** https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/guides/securing-webhooks
- **YouTube Webhooks:** https://developers.google.com/youtube/v3/guides/push_notifications
- **TikTok Webhooks:** https://developers.tiktok.com/doc/webhooks-overview

### Internal Documentation

- Phase 1B Validation Report: `PHASE_1B_VALIDATION_REPORT.md`
- Audit Log README: `src/models/AUDIT_LOG_README.md`
- Queue Manager: `src/queue/QueueManager.ts`

---

## Approval

This architecture plan must be reviewed and approved before implementation begins.

**Reviewed by:** _________________  
**Approved by:** _________________  
**Date:** _________________

---

**END OF ARCHITECTURE PLAN**
