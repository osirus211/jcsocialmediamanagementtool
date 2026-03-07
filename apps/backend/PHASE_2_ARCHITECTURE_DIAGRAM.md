# Phase 2: Event-Driven Platform Integration
## Architecture Diagrams

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Platform Webhooks                           │
│  Facebook │ LinkedIn │ Twitter │ Instagram │ YouTube │ TikTok │ ... │
└────┬────────────┬────────┬──────────┬──────────┬────────┬───────────┘
     │            │        │          │          │        │
     │            │        │          │          │        │
     ▼            ▼        ▼          ▼          ▼        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Webhook Endpoints (Express)                    │
│  POST /api/v1/webhooks/facebook                                     │
│  POST /api/v1/webhooks/linkedin                                     │
│  POST /api/v1/webhooks/twitter                                      │
│  POST /api/v1/webhooks/instagram                                    │
│  POST /api/v1/webhooks/youtube                                      │
│  POST /api/v1/webhooks/tiktok                                       │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Signature Verification                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  WebhookSignatureService                                     │  │
│  │  • verifyFacebook()   • verifyLinkedIn()                     │  │
│  │  • verifyTwitter()    • verifyYouTube()                      │  │
│  │  • verifyTikTok()     • verifyThreads()                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     │ ✅ Valid Signature
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Idempotency Check (Redis)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  WebhookDeduplicationService                                 │  │
│  │  Key: webhook:dedup:{provider}:{eventId}                     │  │
│  │  TTL: 24 hours                                               │  │
│  │  Operation: SET NX EX (atomic)                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     │ ✅ Not Duplicate
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Enqueue to BullMQ                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  webhook-events-queue                                        │  │
│  │  • Concurrency: 10                                           │  │
│  │  • Retry: 3 attempts (exponential backoff)                   │  │
│  │  • Job ID: webhook:{provider}:{eventId}                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Audit Logging (MongoDB)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AuditLog.log({                                              │  │
│  │    action: 'webhook.received',                               │  │
│  │    entityType: 'webhook_event',                              │  │
│  │    metadata: { provider, eventType, payload, ... }           │  │
│  │  })                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    200 OK Response                                  │
│  { "received": true, "eventId": "evt_123" }                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Signature Verification Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Incoming Webhook Request                         │
│  Headers:                                                           │
│    X-Hub-Signature-256: sha256=abc123...                            │
│  Body: (raw buffer)                                                 │
│    { "event": "token_revoked", ... }                                │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Extract Signature Header                         │
│  const signature = req.headers['x-hub-signature-256'];              │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Compute Expected Signature                       │
│  const expectedSignature = crypto                                   │
│    .createHmac('sha256', WEBHOOK_SECRET)                            │
│    .update(rawBody)                                                 │
│    .digest('hex');                                                  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Compare Signatures                               │
│  if (signature === `sha256=${expectedSignature}`) {                 │
│    ✅ Valid                                                          │
│  } else {                                                           │
│    ❌ Invalid → 401 Unauthorized                                    │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Idempotency Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Generate Deduplication Key                       │
│  const dedupKey = `webhook:dedup:${provider}:${eventId}`;           │
│  Example: webhook:dedup:facebook:evt_abc123                         │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Atomic Check-and-Set (Redis)                     │
│  const result = await redis.set(                                    │
│    dedupKey,                                                        │
│    JSON.stringify({ processedAt: new Date() }),                    │
│    'EX', 86400,  // TTL: 24 hours                                   │
│    'NX'          // Only set if not exists                          │
│  );                                                                 │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ├─── result === 'OK' ──────────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  ✅ First Time     │
     │                                              │  Continue Process  │
     │                                              └────────────────────┘
     │
     └─── result === null ──────────────────────────────────────┐
                                                                 │
                                                                 ▼
                                                    ┌────────────────────┐
                                                    │  ❌ Duplicate      │
                                                    │  Return 202        │
                                                    └────────────────────┘
```

---

## Queue Processing Flow (Phase 3)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    webhook-events-queue (BullMQ)                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Job: webhook-event-facebook                                 │  │
│  │  ID: webhook:facebook:evt_abc123                             │  │
│  │  Data: {                                                     │  │
│  │    eventId: 'evt_abc123',                                    │  │
│  │    provider: 'facebook',                                     │  │
│  │    eventType: 'token_revoked',                               │  │
│  │    payload: { ... },                                         │  │
│  │    timestamp: Date,                                          │  │
│  │    correlationId: 'uuid'                                     │  │
│  │  }                                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Webhook Event Worker (Phase 3)                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Process Event Based on Type:                                │  │
│  │  • token_revoked → Update SocialAccount status               │  │
│  │  • permission_changed → Update scopes                        │  │
│  │  • account_disconnected → Mark as disconnected               │  │
│  │  • platform_notification → Send user notification            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Update Database (MongoDB)                        │
│  SocialAccount.findByIdAndUpdate(...)                               │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Audit Log (Processed)                            │
│  AuditLog.log({ action: 'webhook.processed', ... })                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Webhook Request                                  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ├─── Invalid Signature ────────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  401 Unauthorized  │
     │                                              │  Log: webhook.     │
     │                                              │  invalid_signature │
     │                                              └────────────────────┘
     │
     ├─── Invalid Payload ──────────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  400 Bad Request   │
     │                                              │  Log: webhook.     │
     │                                              │  invalid_payload   │
     │                                              └────────────────────┘
     │
     ├─── Duplicate Event ──────────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  202 Accepted      │
     │                                              │  Log: webhook.     │
     │                                              │  duplicate         │
     │                                              └────────────────────┘
     │
     ├─── Queue Enqueue Failed ─────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  500 Internal      │
     │                                              │  Error             │
     │                                              │  Log: webhook.     │
     │                                              │  failed            │
     │                                              │  Retry: Platform   │
     │                                              │  will retry        │
     │                                              └────────────────────┘
     │
     └─── Success ──────────────────────────────────────────────┐
                                                                 │
                                                                 ▼
                                                    ┌────────────────────┐
                                                    │  200 OK            │
                                                    │  Log: webhook.     │
                                                    │  received          │
                                                    └────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────┐
│   Platform   │
│  (Facebook)  │
└──────┬───────┘
       │
       │ POST /webhooks/facebook
       │ X-Hub-Signature-256: sha256=...
       │ Body: { event: "token_revoked", ... }
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Express Server (Port 5000)                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Raw Body Parser Middleware                            │  │
│  │  • Preserve raw body for signature verification        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Webhook Auth Middleware                               │  │
│  │  • Verify signature                                    │  │
│  │  • Reject if invalid (401)                             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  WebhookController.handleFacebook()                    │  │
│  │  • Validate payload                                    │  │
│  │  • Check idempotency                                   │  │
│  │  • Enqueue to BullMQ                                   │  │
│  │  • Log to AuditLog                                     │  │
│  │  • Return 200 OK                                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │
       ├─────────────────────────────────────────────────────┐
       │                                                     │
       ▼                                                     ▼
┌──────────────┐                                   ┌──────────────┐
│    Redis     │                                   │   MongoDB    │
│  (Port 6380) │                                   │ (Port 27017) │
├──────────────┤                                   ├──────────────┤
│ Deduplication│                                   │  AuditLog    │
│ Keys:        │                                   │  Collection  │
│ webhook:     │                                   │              │
│ dedup:       │                                   │ {            │
│ facebook:    │                                   │   action:    │
│ evt_abc123   │                                   │   "webhook.  │
│              │                                   │   received", │
│ TTL: 24h     │                                   │   ...        │
│              │                                   │ }            │
└──────────────┘                                   └──────────────┘
       │
       ▼
┌──────────────┐
│    Redis     │
│  (Port 6380) │
├──────────────┤
│   BullMQ     │
│   Queue:     │
│   webhook-   │
│   events-    │
│   queue      │
│              │
│ Job:         │
│ webhook:     │
│ facebook:    │
│ evt_abc123   │
└──────────────┘
       │
       │ (Phase 3: Worker processes jobs)
       ▼
┌──────────────┐
│   MongoDB    │
│ (Port 27017) │
├──────────────┤
│ SocialAccount│
│ Collection   │
│              │
│ Update status│
│ based on     │
│ event type   │
└──────────────┘
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Phase 2 Components                          │
│                                                                     │
│  ┌──────────────────┐         ┌──────────────────┐                 │
│  │  WebhookController│◄────────│  webhook.routes  │                 │
│  │                  │         │                  │                 │
│  │  • handleFacebook│         │  POST /webhooks/ │                 │
│  │  • handleLinkedIn│         │  facebook        │                 │
│  │  • handleTwitter │         │  linkedin        │                 │
│  │  • ...           │         │  twitter         │                 │
│  └────────┬─────────┘         │  ...             │                 │
│           │                   └──────────────────┘                 │
│           │                                                         │
│           ├──────────────────────────────────────────┐             │
│           │                                          │             │
│           ▼                                          ▼             │
│  ┌──────────────────┐                    ┌──────────────────┐     │
│  │  Webhook         │                    │  Webhook         │     │
│  │  SignatureService│                    │  Deduplication   │     │
│  │                  │                    │  Service         │     │
│  │  • verifyFacebook│                    │                  │     │
│  │  • verifyLinkedIn│                    │  • isDuplicate() │     │
│  │  • verifyTwitter │                    │  • markProcessed│     │
│  │  • ...           │                    │                  │     │
│  └──────────────────┘                    └────────┬─────────┘     │
│                                                    │               │
│                                                    ▼               │
│                                          ┌──────────────────┐     │
│                                          │     Redis        │     │
│                                          │  (Deduplication) │     │
│                                          └──────────────────┘     │
│           │                                                        │
│           ▼                                                        │
│  ┌──────────────────┐                                             │
│  │  Webhook         │                                             │
│  │  EventsQueue     │                                             │
│  │                  │                                             │
│  │  • enqueue()     │                                             │
│  │  • getStats()    │                                             │
│  └────────┬─────────┘                                             │
│           │                                                        │
│           ▼                                                        │
│  ┌──────────────────┐                                             │
│  │     BullMQ       │                                             │
│  │  (Redis Queue)   │                                             │
│  └──────────────────┘                                             │
│           │                                                        │
│           ▼                                                        │
│  ┌──────────────────┐                                             │
│  │    AuditLog      │                                             │
│  │   (MongoDB)      │                                             │
│  └──────────────────┘                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Redis Key Structure

```
Redis (Port 6380)
│
├── Deduplication Keys (Phase 2)
│   ├── webhook:dedup:facebook:evt_abc123
│   ├── webhook:dedup:linkedin:evt_def456
│   ├── webhook:dedup:twitter:evt_ghi789
│   └── ... (TTL: 24 hours)
│
├── BullMQ Queue Keys (Phase 2)
│   ├── bull:webhook-events-queue:wait
│   ├── bull:webhook-events-queue:active
│   ├── bull:webhook-events-queue:delayed
│   ├── bull:webhook-events-queue:completed
│   ├── bull:webhook-events-queue:failed
│   ├── bull:webhook-events-queue:meta
│   ├── bull:webhook-events-queue:id
│   ├── bull:webhook-events-queue:events
│   └── bull:webhook-events-queue:webhook:facebook:evt_abc123
│
└── Phase 1B Keys (DO NOT MODIFY)
    ├── oauth:circuit:facebook
    ├── oauth:circuit:twitter
    ├── oauth:ratelimit:facebook:29543306
    ├── bull:token-refresh-queue:*
    └── ...
```

---

## MongoDB Collections

```
MongoDB (Port 27017)
│
├── auditlogs (Extended in Phase 2)
│   ├── Document: {
│   │     userId: ObjectId,
│   │     workspaceId: ObjectId,
│   │     action: 'webhook.received',
│   │     entityType: 'webhook_event',
│   │     entityId: 'evt_abc123',
│   │     metadata: {
│   │       provider: 'facebook',
│   │       eventType: 'token_revoked',
│   │       payload: { ... },
│   │       correlationId: 'uuid',
│   │       processingStatus: 'queued'
│   │     },
│   │     createdAt: Date
│   │   }
│   └── ...
│
├── socialaccounts (Phase 3 - Updated by worker)
│   └── ...
│
└── Other collections (No changes)
    └── ...
```

---

**END OF DIAGRAMS**
