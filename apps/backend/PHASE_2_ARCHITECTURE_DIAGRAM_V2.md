# Phase 2: Event-Driven Platform Integration
## Refined Architecture Diagrams (Version 2)

---

## System Overview (V2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Platform Webhooks                           │
│  Facebook │ LinkedIn │ Twitter │ Instagram │ YouTube │ TikTok │ ... │
└────┬────────────┬────────┬──────────┬──────────┬────────┬───────────┘
     │            │        │          │          │        │
     │            │        │          │          │        │
     ▼            ▼        ▼          ▼          ▼        ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Unified Webhook Endpoint (Express)                     │
│                                                                     │
│              POST /api/v1/webhooks/:provider                        │
│                                                                     │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WebhookController                                │
│  • Resolve provider from registry                                  │
│  • Delegate to provider implementation                             │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 WebhookProviderRegistry                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  getProvider('facebook') → FacebookWebhookProvider           │  │
│  │  getProvider('linkedin') → LinkedInWebhookProvider           │  │
│  │  getProvider('twitter')  → TwitterWebhookProvider            │  │
│  │  ...                                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Provider Implementation (IWebhookProvider)             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. verifySignature(headers, rawBody)                       │  │
│  │  2. extractEvent(payload)                                   │  │
│  │  3. normalizeEvent(event)                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Idempotency Check (Redis)                        │
│  Key: webhook:dedup:{provider}:{eventId}                            │
│  TTL: 24 hours                                                      │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STAGE 1: webhook-ingest-queue                          │
│  • Fast ingestion (< 100ms)                                         │
│  • Store in audit log                                               │
│  • Enqueue to Stage 2                                               │
│  • Concurrency: 20 workers                                          │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STAGE 2: webhook-processing-queue                      │
│  • Execute business logic                                           │
│  • Update database                                                  │
│  • Trigger actions                                                  │
│  • Send notifications                                               │
│  • Concurrency: 10 workers                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Provider Registry Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                   WebhookProviderRegistry                           │
│                                                                     │
│  providers: Map<string, IWebhookProvider>                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  'facebook'  → FacebookWebhookProvider                        │ │
│  │  'linkedin'  → LinkedInWebhookProvider                        │ │
│  │  'twitter'   → TwitterWebhookProvider                         │ │
│  │  'instagram' → InstagramWebhookProvider                       │ │
│  │  'youtube'   → YouTubeWebhookProvider                         │ │
│  │  'tiktok'    → TikTokWebhookProvider                          │ │
│  │  'threads'   → ThreadsWebhookProvider                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Methods:                                                           │
│  • register(name, provider)                                         │
│  • getProvider(name): IWebhookProvider                              │
│  • hasProvider(name): boolean                                       │
│  • listProviders(): string[]                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Provider Interface Implementation

```
┌─────────────────────────────────────────────────────────────────────┐
│                      IWebhookProvider                               │
│                                                                     │
│  + name: string                                                     │
│  + verifySignature(headers, rawBody): Promise<boolean>              │
│  + extractEvent(payload): Promise<WebhookEvent>                     │
│  + normalizeEvent(event): Promise<NormalizedWebhookEvent>           │
│  + handleChallenge?(req, res): Promise<boolean>                     │
└────┬────────────────────────────────────────────────────────────────┘
     │
     │ implements
     │
     ├──────────────────────────────────────────────────────────────┐
     │                                                              │
     ▼                                                              ▼
┌─────────────────────┐                              ┌─────────────────────┐
│ FacebookWebhook     │                              │ TwitterWebhook      │
│ Provider            │                              │ Provider            │
├─────────────────────┤                              ├─────────────────────┤
│ name: 'facebook'    │                              │ name: 'twitter'     │
│                     │                              │                     │
│ verifySignature()   │                              │ verifySignature()   │
│ • X-Hub-Signature-  │                              │ • X-Twitter-        │
│   256               │                              │   Webhooks-         │
│ • HMAC SHA256       │                              │   Signature         │
│                     │                              │ • HMAC SHA256       │
│ extractEvent()      │                              │ • Base64            │
│ • Parse entry[]     │                              │                     │
│ • Extract changes   │                              │ extractEvent()      │
│                     │                              │ • Parse revoke      │
│ normalizeEvent()    │                              │ • Parse user_event  │
│ • Map to internal   │                              │                     │
│   types             │                              │ normalizeEvent()    │
│ • Extract user ID   │                              │ • Map to internal   │
│                     │                              │   types             │
└─────────────────────┘                              │                     │
                                                     │ handleChallenge()   │
                                                     │ • CRC response      │
                                                     └─────────────────────┘
```

---

## Two-Stage Queue Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: Ingestion                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  webhook-ingest-queue                                         │ │
│  │                                                               │ │
│  │  Purpose: Fast ingestion & storage                           │ │
│  │  Concurrency: 20 workers                                     │ │
│  │  Lock Duration: 10 seconds                                   │ │
│  │  Retry: 3 attempts (1s, 5s, 25s)                             │ │
│  │                                                               │ │
│  │  Worker Responsibilities:                                    │ │
│  │  1. Validate event structure                                 │ │
│  │  2. Store in audit log                                       │ │
│  │  3. Enqueue to Stage 2                                       │ │
│  │  4. Mark complete                                            │ │
│  │                                                               │ │
│  │  Target: < 100ms processing time                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
└────┬────────────────────────────────────────────────────────────────┘
     │
     │ Enqueue with priority
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: Processing                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  webhook-processing-queue                                     │ │
│  │                                                               │ │
│  │  Purpose: Business logic execution                           │ │
│  │  Concurrency: 10 workers                                     │ │
│  │  Lock Duration: 60 seconds                                   │ │
│  │  Retry: 5 attempts (5s, 25s, 125s, 625s, 3125s)              │ │
│  │                                                               │ │
│  │  Worker Responsibilities:                                    │ │
│  │  1. Route to event handler                                   │ │
│  │  2. Execute business logic                                   │ │
│  │  3. Update database                                          │ │
│  │  4. Trigger actions (token refresh, notifications)           │ │
│  │  5. Audit log result                                         │ │
│  │                                                               │ │
│  │  Priority Levels:                                            │ │
│  │  1 - TOKEN_REVOKED, TOKEN_EXPIRED                            │ │
│  │  2 - ACCOUNT_DISCONNECTED, ACCOUNT_DELETED                   │ │
│  │  3 - PERMISSION_CHANGED                                      │ │
│  │  4 - PROFILE_UPDATED                                         │ │
│  │  5 - MEDIA_PUBLISHED, MEDIA_DELETED                          │ │
│  │  6 - COMMENT_RECEIVED, MESSAGE_RECEIVED                      │ │
│  │  10 - UNKNOWN                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Event Normalization Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                Platform-Specific Webhook Payload                    │
│                                                                     │
│  Facebook:                                                          │
│  {                                                                  │
│    "object": "user",                                                │
│    "entry": [{                                                      │
│      "id": "123456789",                                             │
│      "changes": [{ "field": "deauthorize", ... }]                   │
│    }]                                                               │
│  }                                                                  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Provider.extractEvent(payload)                         │
│                                                                     │
│  Extract platform-specific fields:                                 │
│  • Event ID                                                         │
│  • Event type                                                       │
│  • Timestamp                                                        │
│  • Raw data                                                         │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Raw WebhookEvent                                 │
│                                                                     │
│  {                                                                  │
│    id: "123456789",                                                 │
│    type: "deauthorize",                                             │
│    timestamp: Date,                                                 │
│    data: { /* original payload */ }                                 │
│  }                                                                  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Provider.normalizeEvent(event)                         │
│                                                                     │
│  1. Map platform type to internal type                              │
│     "deauthorize" → WebhookEventType.TOKEN_REVOKED                  │
│                                                                     │
│  2. Extract account identifiers                                     │
│     • userId, accountId, workspaceId                                │
│                                                                     │
│  3. Normalize data structure                                        │
│     • Convert to standard format                                    │
│     • Extract relevant fields                                       │
│                                                                     │
│  4. Add metadata                                                    │
│     • correlationId, receivedAt                                     │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              NormalizedWebhookEvent                                 │
│                                                                     │
│  {                                                                  │
│    eventId: "123456789",                                            │
│    provider: "facebook",                                            │
│    eventType: "token_revoked",                                      │
│    timestamp: Date,                                                 │
│    accountId: "123456789",                                          │
│    workspaceId: "workspace_id",                                     │
│    data: {                                                          │
│      raw: { /* original */ },                                       │
│      normalized: {                                                  │
│        userId: "123456789",                                         │
│        reason: "user_deauthorized"                                  │
│      }                                                              │
│    },                                                               │
│    metadata: {                                                      │
│      correlationId: "uuid",                                         │
│      receivedAt: Date                                               │
│    }                                                                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---


## Request Flow Comparison: V1 vs V2

### V1 Architecture (Original)

```
POST /api/v1/webhooks/facebook
    ↓
WebhookController.handleFacebook()
    ↓
WebhookSignatureService.verifyFacebook()
    ↓
Extract event (inline logic)
    ↓
Idempotency check
    ↓
Enqueue to webhook-events-queue
    ↓
Audit log
    ↓
200 OK
```

### V2 Architecture (Refined)

```
POST /api/v1/webhooks/facebook
    ↓
WebhookController.handleWebhook(req, res)
    ↓
registry.getProvider('facebook')
    ↓
FacebookWebhookProvider.verifySignature()
    ↓
FacebookWebhookProvider.extractEvent()
    ↓
FacebookWebhookProvider.normalizeEvent()
    ↓
Idempotency check
    ↓
Enqueue to webhook-ingest-queue (Stage 1)
    ↓
Audit log
    ↓
200 OK
    ↓
[Async] Stage 1 Worker
    ↓
Enqueue to webhook-processing-queue (Stage 2)
    ↓
[Async] Stage 2 Worker
    ↓
Execute business logic
```

---

## Component Interaction Diagram (V2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Phase 2 V2 Components                       │
│                                                                     │
│  ┌──────────────────┐         ┌──────────────────┐                 │
│  │  WebhookController│◄────────│  webhook.routes  │                 │
│  │                  │         │                  │                 │
│  │  • handleWebhook │         │  POST /webhooks/ │                 │
│  │                  │         │  :provider       │                 │
│  └────────┬─────────┘         └──────────────────┘                 │
│           │                                                         │
│           ├──────────────────────────────────────────┐             │
│           │                                          │             │
│           ▼                                          ▼             │
│  ┌──────────────────┐                    ┌──────────────────┐     │
│  │  Webhook         │                    │  Webhook         │     │
│  │  ProviderRegistry│                    │  Deduplication   │     │
│  │                  │                    │  Service         │     │
│  │  • getProvider() │                    │                  │     │
│  │  • register()    │                    │  • isDuplicate() │     │
│  │  • listProviders │                    │  • markProcessed │     │
│  └────────┬─────────┘                    └────────┬─────────┘     │
│           │                                       │               │
│           ▼                                       ▼               │
│  ┌──────────────────┐                    ┌──────────────────┐     │
│  │  IWebhookProvider│                    │     Redis        │     │
│  │  (Interface)     │                    │  (Deduplication) │     │
│  │                  │                    └──────────────────┘     │
│  │  • verifySignature                                             │
│  │  • extractEvent  │                                             │
│  │  • normalizeEvent│                                             │
│  └────────┬─────────┘                                             │
│           │                                                        │
│           ├──────────────────────────────────────────┐            │
│           │                                          │            │
│           ▼                                          ▼            │
│  ┌──────────────────┐                    ┌──────────────────┐    │
│  │  Facebook        │                    │  Twitter         │    │
│  │  WebhookProvider │                    │  WebhookProvider │    │
│  └──────────────────┘                    └──────────────────┘    │
│           │                                          │            │
│           └──────────────────┬───────────────────────┘            │
│                              │                                    │
│                              ▼                                    │
│                    ┌──────────────────┐                           │
│                    │  Webhook         │                           │
│                    │  IngestQueue     │                           │
│                    │  (Stage 1)       │                           │
│                    └────────┬─────────┘                           │
│                             │                                     │
│                             ▼                                     │
│                    ┌──────────────────┐                           │
│                    │  Webhook         │                           │
│                    │  ProcessingQueue │                           │
│                    │  (Stage 2)       │                           │
│                    └────────┬─────────┘                           │
│                             │                                     │
│                             ▼                                     │
│                    ┌──────────────────┐                           │
│                    │    AuditLog      │                           │
│                    │   (MongoDB)      │                           │
│                    └──────────────────┘                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Redis Key Structure (V2)

```
Redis (Port 6380)
│
├── Deduplication Keys (Phase 2)
│   ├── webhook:dedup:facebook:evt_abc123
│   ├── webhook:dedup:linkedin:evt_def456
│   ├── webhook:dedup:twitter:evt_ghi789
│   └── ... (TTL: 24 hours)
│
├── BullMQ Queue Keys - Stage 1 (Phase 2)
│   ├── bull:webhook-ingest-queue:wait
│   ├── bull:webhook-ingest-queue:active
│   ├── bull:webhook-ingest-queue:delayed
│   ├── bull:webhook-ingest-queue:completed
│   ├── bull:webhook-ingest-queue:failed
│   ├── bull:webhook-ingest-queue:meta
│   ├── bull:webhook-ingest-queue:id
│   ├── bull:webhook-ingest-queue:events
│   └── bull:webhook-ingest-queue:webhook:facebook:evt_abc123
│
├── BullMQ Queue Keys - Stage 2 (Phase 2)
│   ├── bull:webhook-processing-queue:wait
│   ├── bull:webhook-processing-queue:active
│   ├── bull:webhook-processing-queue:delayed
│   ├── bull:webhook-processing-queue:completed
│   ├── bull:webhook-processing-queue:failed
│   ├── bull:webhook-processing-queue:meta
│   ├── bull:webhook-processing-queue:id
│   ├── bull:webhook-processing-queue:events
│   └── bull:webhook-processing-queue:webhook-process:facebook:evt_abc123
│
└── Phase 1B Keys (DO NOT MODIFY)
    ├── oauth:circuit:facebook
    ├── oauth:circuit:twitter
    ├── oauth:ratelimit:facebook:29543306
    ├── bull:token-refresh-queue:*
    └── ...
```

---

## MongoDB Collections (V2)

```
MongoDB (Port 27017)
│
├── auditlogs (Extended in Phase 2)
│   ├── Document (Stage 1 - Ingested): {
│   │     userId: ObjectId,
│   │     workspaceId: ObjectId,
│   │     action: 'webhook.ingested',
│   │     entityType: 'webhook_event',
│   │     entityId: 'evt_abc123',
│   │     metadata: {
│   │       provider: 'facebook',
│   │       eventType: 'token_revoked',
│   │       payload: { ... },
│   │       correlationId: 'uuid',
│   │       stage: 'ingest'
│   │     },
│   │     createdAt: Date
│   │   }
│   │
│   ├── Document (Stage 2 - Processed): {
│   │     userId: ObjectId,
│   │     workspaceId: ObjectId,
│   │     action: 'webhook.processed',
│   │     entityType: 'webhook_event',
│   │     entityId: 'evt_abc123',
│   │     metadata: {
│   │       provider: 'facebook',
│   │       eventType: 'token_revoked',
│   │       status: 'success',
│   │       correlationId: 'uuid',
│   │       stage: 'processing'
│   │     },
│   │     createdAt: Date
│   │   }
│   └── ...
│
├── socialaccounts (Phase 3 - Updated by Stage 2 worker)
│   └── ...
│
└── Other collections (No changes)
    └── ...
```

---

## Error Handling Flow (V2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Webhook Request                                  │
└────┬────────────────────────────────────────────────────────────────┘
     │
     ├─── Unknown Provider ─────────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  404 Not Found     │
     │                                              │  {                 │
     │                                              │    error: "Provider│
     │                                              │    not found",     │
     │                                              │    available: [...]│
     │                                              │  }                 │
     │                                              └────────────────────┘
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
     ├─── Extraction Failed ────────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  400 Bad Request   │
     │                                              │  Log: webhook.     │
     │                                              │  extraction_failed │
     │                                              └────────────────────┘
     │
     ├─── Normalization Failed ─────────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  400 Bad Request   │
     │                                              │  Log: webhook.     │
     │                                              │  normalization_    │
     │                                              │  failed            │
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
     ├─── Stage 1 Enqueue Failed ───────────────────────────────┐
     │                                                           │
     │                                                           ▼
     │                                              ┌────────────────────┐
     │                                              │  500 Internal      │
     │                                              │  Error             │
     │                                              │  Log: webhook.     │
     │                                              │  enqueue_failed    │
     │                                              │  Platform will     │
     │                                              │  retry             │
     │                                              └────────────────────┘
     │
     └─── Success ──────────────────────────────────────────────┐
                                                                 │
                                                                 ▼
                                                    ┌────────────────────┐
                                                    │  200 OK            │
                                                    │  {                 │
                                                    │    received: true, │
                                                    │    eventId: "..."  │
                                                    │  }                 │
                                                    │  Log: webhook.     │
                                                    │  received          │
                                                    └────────────────────┘
```

---

## Sequence Diagram: Complete Flow (V2)

```
Platform    Controller    Registry    Provider    Dedup    Stage1    Stage2    DB
   │            │            │           │          │        │         │        │
   │  POST      │            │           │          │        │         │        │
   │ /webhooks/ │            │           │          │        │         │        │
   │ facebook   │            │           │          │        │         │        │
   ├───────────>│            │           │          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │ getProvider│           │          │        │         │        │
   │            │ ('facebook')          │          │        │         │        │
   │            ├───────────>│           │          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │ return    │          │        │         │        │
   │            │            │ Facebook  │          │        │         │        │
   │            │            │ Provider  │          │        │         │        │
   │            │<───────────┤           │          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │ verifySignature()      │          │        │         │        │
   │            ├───────────────────────>│          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │ ✅ Valid │        │         │        │
   │            │<───────────────────────┤          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │ extractEvent()         │          │        │         │        │
   │            ├───────────────────────>│          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │ Raw Event│        │         │        │
   │            │<───────────────────────┤          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │ normalizeEvent()       │          │        │         │        │
   │            ├───────────────────────>│          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │ Normalized        │         │        │
   │            │<───────────────────────┤          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │ isDuplicate()          │          │        │         │        │
   │            ├───────────────────────────────────>│        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │ ❌ Not │         │        │
   │            │            │           │          │ Dup    │         │        │
   │            │<───────────────────────────────────┤        │         │        │
   │            │            │           │          │        │         │        │
   │            │ enqueue(Stage1)        │          │        │         │        │
   │            ├───────────────────────────────────────────>│         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │ ✅ Queued        │
   │            │<───────────────────────────────────────────┤         │        │
   │            │            │           │          │        │         │        │
   │  200 OK    │            │           │          │        │         │        │
   │<───────────┤            │           │          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │  [Async Worker]   │        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │ process │        │
   │            │            │           │          │        │ job     │        │
   │            │            │           │          │        ├────────>│        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │         │ audit  │
   │            │            │           │          │        │         │ log    │
   │            │            │           │          │        │         ├───────>│
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │         │ enqueue│
   │            │            │           │          │        │         │ Stage2 │
   │            │            │           │          │        │<────────┤        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │  [Async Worker]  │
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │         │ process│
   │            │            │           │          │        │         │ event  │
   │            │            │           │          │        │         ├───────>│
   │            │            │           │          │        │         │        │
   │            │            │           │          │        │         │ update │
   │            │            │           │          │        │         │ account│
   │            │            │           │          │        │         ├───────>│
   │            │            │           │          │        │         │        │
```

---

**END OF REFINED ARCHITECTURE DIAGRAMS V2**
