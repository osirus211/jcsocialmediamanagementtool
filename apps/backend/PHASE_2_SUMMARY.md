# Phase 2: Event-Driven Platform Integration
## Executive Summary

**Status:** Design Complete - Ready for Implementation  
**Date:** 2026-03-04

---

## Overview

Phase 2 implements a webhook ingestion system to handle platform events such as token revocations, permission changes, account disconnects, and platform notifications.

**Key Principle:** Do NOT modify Phase 1B infrastructure (Circuit Breaker, Rate Limiter, Token Refresh).

---

## Architecture Components

### 1. Webhook Endpoints
```
POST /api/v1/webhooks/facebook
POST /api/v1/webhooks/linkedin
POST /api/v1/webhooks/twitter
POST /api/v1/webhooks/instagram
POST /api/v1/webhooks/youtube
POST /api/v1/webhooks/tiktok
POST /api/v1/webhooks/threads
```

### 2. Signature Verification
Each platform uses different verification methods:
- **Facebook/Instagram/Threads:** `X-Hub-Signature-256` (HMAC SHA256)
- **LinkedIn:** `X-LinkedIn-Signature` (HMAC SHA256)
- **Twitter:** `X-Twitter-Webhooks-Signature` (HMAC SHA256 + CRC Challenge)
- **YouTube/Google:** `X-Goog-Signature` (HMAC SHA256)
- **TikTok:** `X-TikTok-Signature` (HMAC SHA256)

### 3. Event Queue
- **Queue Name:** `webhook-events-queue`
- **Purpose:** Async processing to prevent blocking API threads
- **Concurrency:** 10 workers
- **Retry:** 3 attempts with exponential backoff

### 4. Idempotent Processing
- **Strategy:** Redis-based deduplication
- **Key Format:** `webhook:dedup:{provider}:{eventId}`
- **TTL:** 24 hours
- **Race Protection:** Atomic `SET NX EX` operations

### 5. Audit Logging
- **Model:** Existing `AuditLog` model (extended)
- **Actions:** `webhook.received`, `webhook.processed`, `webhook.failed`, `webhook.duplicate`
- **Retention:** Configurable TTL (default: 90 days)

---

## Request Flow

```
Platform Webhook
    ↓
Signature Verification (401 if invalid)
    ↓
Payload Validation (400 if invalid)
    ↓
Idempotency Check (202 if duplicate)
    ↓
Enqueue to BullMQ
    ↓
Audit Log
    ↓
200 OK Response
```

---

## Implementation Checklist

### Core Services
- [ ] `WebhookSignatureService` - Platform-specific signature verification
- [ ] `WebhookDeduplicationService` - Redis-based duplicate detection
- [ ] `WebhookEventsQueue` - BullMQ queue configuration

### Controllers & Routes
- [ ] `WebhookController` - Endpoint handlers for all platforms
- [ ] `webhook.routes.ts` - Route definitions

### Middleware
- [ ] `rawBodyParser` - Preserve raw body for signature verification
- [ ] `webhookAuth` - Signature verification middleware

### Configuration
- [ ] Add webhook secrets to `.env`
- [ ] Configure queue in QueueManager
- [ ] Extend AuditLog actions

### Testing
- [ ] Unit tests for signature verification (all platforms)
- [ ] Unit tests for deduplication
- [ ] Integration tests for webhook endpoints
- [ ] Mock webhook payloads

### Documentation
- [ ] API documentation
- [ ] Platform setup guides
- [ ] Troubleshooting guide

---

## New Environment Variables

Add to `apps/backend/.env`:

```bash
# New Webhook Secrets
TWITTER_CONSUMER_SECRET=your-twitter-consumer-secret
GOOGLE_WEBHOOK_SECRET=your-google-webhook-secret
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret

# Existing (already configured)
FACEBOOK_APP_SECRET=67867ce028f802173aa9824cdeede653
INSTAGRAM_CLIENT_SECRET=e802739200f42e8c5d2eea9d75c1e81d
LINKEDIN_CLIENT_SECRET=mpVgDvnIyJzAbRbx
THREADS_CLIENT_SECRET=15bfa46cc128455912ab20845ab06f9d
YOUTUBE_CLIENT_SECRET=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
```

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
    └── AuditLog.ts                   # EXTEND
```

---

## Security Highlights

1. **Signature Verification:** All webhooks MUST verify signatures
2. **Raw Body Preservation:** Required for signature verification
3. **Rate Limiting:** Prevent webhook flooding
4. **HTTPS Only:** Production webhooks require HTTPS
5. **Secrets Management:** Environment variables, never committed
6. **Payload Size Limits:** Prevent memory exhaustion

---

## Monitoring Metrics

### Key Metrics
- `webhook_received_total` - Total webhooks received by provider
- `webhook_signature_invalid_total` - Invalid signature attempts
- `webhook_duplicate_total` - Duplicate events detected
- `webhook_queued_total` - Events successfully queued
- `webhook_queue_lag_ms` - Queue processing lag

### Alerts
- **Critical:** Signature failure rate > 5%, Queue size > 10,000
- **Warning:** Duplicate rate > 20%, Queue size > 5,000

---

## Success Criteria

Phase 2 is complete when:

1. ✅ All 7 webhook endpoints implemented
2. ✅ Signature verification works for all platforms
3. ✅ Events queued to `webhook-events-queue`
4. ✅ Idempotency enforced via Redis
5. ✅ All events logged to AuditLog
6. ✅ Unit tests pass (>80% coverage)
7. ✅ Integration tests pass
8. ✅ Documentation complete
9. ✅ No Phase 1B modifications

---

## Phase 3 Preview

After Phase 2 completion:
- Implement webhook event worker
- Process token revocations
- Process permission changes
- Update SocialAccount status
- Trigger token refresh
- Implement user notifications

---

## Documentation

- **Full Architecture Plan:** `PHASE_2_ARCHITECTURE_PLAN.md`
- **Phase 1B Report:** `PHASE_1B_VALIDATION_REPORT.md`
- **Audit Log README:** `src/models/AUDIT_LOG_README.md`

---

**Ready for Implementation:** Yes  
**Estimated Effort:** 2-3 days  
**Risk Level:** Low (no Phase 1B modifications)
