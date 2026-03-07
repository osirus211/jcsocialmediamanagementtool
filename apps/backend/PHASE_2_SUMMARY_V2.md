# Phase 2: Event-Driven Platform Integration
## Refined Architecture Summary (Version 2)

**Status:** Architecture Refinement Complete - Ready for Implementation  
**Date:** 2026-03-04  
**Version:** 2.0

---

## Key Improvements Over V1

### 1. Unified Webhook Controller ✅
**Before:** 7 separate endpoints  
**After:** 1 unified endpoint with provider parameter

**Benefits:**
- 85% reduction in controller code
- Consistent error handling
- Easier to add new providers
- Centralized monitoring

### 2. Provider Registry Pattern ✅
**Before:** Service-based approach  
**After:** Interface-driven provider registry

**Benefits:**
- Type-safe provider implementations
- Dynamic provider registration
- Clear separation of concerns
- Easy to test and mock

### 3. Two-Stage Queue Pipeline ✅
**Before:** Single queue  
**After:** Ingestion queue → Processing queue

**Benefits:**
- Fast response (< 100ms)
- Failure isolation
- Independent scaling
- Priority handling

---

## Architecture Components

### Unified Endpoint
```
POST /api/v1/webhooks/:provider
```

Supported providers: `facebook`, `linkedin`, `twitter`, `instagram`, `youtube`, `tiktok`, `threads`

### Provider Interface

```typescript
interface IWebhookProvider {
  name: string;
  verifySignature(headers, rawBody): Promise<boolean>;
  extractEvent(payload): Promise<WebhookEvent>;
  normalizeEvent(event): Promise<NormalizedWebhookEvent>;
  handleChallenge?(req, res): Promise<boolean>;
}
```

### Provider Registry

```typescript
class WebhookProviderRegistry {
  register(name: string, provider: IWebhookProvider): void;
  getProvider(name: string): IWebhookProvider;
  hasProvider(name: string): boolean;
  listProviders(): string[];
}
```

### Two-Stage Queues

**Stage 1: webhook-ingest-queue**
- Purpose: Fast ingestion (< 100ms)
- Concurrency: 20 workers
- Responsibilities: Validate, store, enqueue to Stage 2

**Stage 2: webhook-processing-queue**
- Purpose: Business logic execution
- Concurrency: 10 workers
- Responsibilities: Update DB, trigger actions, send notifications

---

## Request Flow

```
Platform Webhook
    ↓
POST /api/v1/webhooks/:provider
    ↓
WebhookController.handleWebhook()
    ↓
registry.getProvider(provider)
    ↓
provider.verifySignature()
    ↓
provider.extractEvent()
    ↓
provider.normalizeEvent()
    ↓
deduplicationService.isDuplicate()
    ↓
ingestQueue.add() [Stage 1]
    ↓
auditLog.log()
    ↓
200 OK Response
    ↓
[Async] Stage 1 Worker
    ↓
processingQueue.add() [Stage 2]
    ↓
[Async] Stage 2 Worker
    ↓
Execute business logic
```

---

## Event Normalization

### Platform-Specific → Internal Format

**Facebook:**
```
"deauthorize" → WebhookEventType.TOKEN_REVOKED
"permissions" → WebhookEventType.PERMISSION_CHANGED
"delete" → WebhookEventType.ACCOUNT_DELETED
```

**Twitter:**
```
"revoke" → WebhookEventType.TOKEN_REVOKED
"account_suspended" → WebhookEventType.ACCOUNT_SUSPENDED
"profile_update" → WebhookEventType.PROFILE_UPDATED
```

### Normalized Event Structure

```typescript
{
  eventId: string;
  provider: string;
  eventType: WebhookEventType;
  timestamp: Date;
  accountId?: string;
  workspaceId?: string;
  data: {
    raw: any;
    normalized: any;
  };
  metadata: {
    correlationId: string;
    receivedAt: Date;
  };
}
```

---

## Implementation Checklist

### Core Components
- [ ] `IWebhookProvider` interface
- [ ] `WebhookProviderRegistry` class
- [ ] 7 provider implementations
- [ ] `WebhookDeduplicationService`
- [ ] `WebhookIngestQueue` (Stage 1)
- [ ] `WebhookProcessingQueue` (Stage 2)
- [ ] `WebhookController` (unified)
- [ ] Webhook routes
- [ ] Middleware (rawBodyParser, webhookAuth)

### Testing
- [ ] Unit tests for each provider
- [ ] Unit tests for registry
- [ ] Unit tests for deduplication
- [ ] Integration tests for unified endpoint
- [ ] Mock webhook payloads

### Documentation
- [ ] API documentation
- [ ] Provider implementation guide
- [ ] Testing guide
- [ ] Troubleshooting guide

---

## File Structure

```
apps/backend/src/
├── types/
│   └── webhook.types.ts                      # NEW
├── providers/webhooks/
│   ├── BaseWebhookProvider.ts                # NEW
│   ├── FacebookWebhookProvider.ts            # NEW
│   ├── LinkedInWebhookProvider.ts            # NEW
│   ├── TwitterWebhookProvider.ts             # NEW
│   ├── InstagramWebhookProvider.ts           # NEW
│   ├── YouTubeWebhookProvider.ts             # NEW
│   ├── TikTokWebhookProvider.ts              # NEW
│   ├── ThreadsWebhookProvider.ts             # NEW
│   ├── WebhookProviderRegistry.ts            # NEW
│   └── index.ts                              # NEW
├── services/
│   └── WebhookDeduplicationService.ts        # NEW
├── queue/
│   ├── WebhookIngestQueue.ts                # NEW
│   └── WebhookProcessingQueue.ts            # NEW
├── controllers/
│   └── WebhookController.ts                  # NEW
├── routes/v1/
│   └── webhook.routes.ts                     # NEW
└── middleware/
    ├── rawBodyParser.ts                      # NEW
    └── webhookAuth.ts                        # NEW
```

---

## Comparison: V1 vs V2

| Aspect | V1 (Original) | V2 (Refined) |
|--------|---------------|--------------|
| Endpoints | 7 separate | 1 unified |
| Controllers | 7 controllers | 1 controller |
| Provider Pattern | Service-based | Interface-driven |
| Queue Architecture | Single queue | Two-stage pipeline |
| Response Time | Variable | < 100ms (Stage 1) |
| Scalability | Limited | Independent scaling |
| Code Duplication | High | Minimal |
| Extensibility | Moderate | High |

---

## Success Criteria

Phase 2 V2 is complete when:

1. ✅ Unified endpoint implemented (`/webhooks/:provider`)
2. ✅ Provider registry with 7 providers
3. ✅ All providers implement `IWebhookProvider`
4. ✅ Two-stage queue pipeline operational
5. ✅ Event normalization working
6. ✅ Idempotency enforced
7. ✅ Audit logging complete
8. ✅ Unit tests pass (>80% coverage)
9. ✅ Integration tests pass
10. ✅ Documentation complete
11. ✅ No Phase 1B modifications

---

## Environment Variables

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

## Monitoring Metrics (V2-Specific)

### Provider Metrics
- `webhook_provider_requests_total` - by provider
- `webhook_provider_signature_invalid_total` - by provider
- `webhook_provider_normalization_failed_total` - by provider

### Queue Metrics
- `webhook_ingest_queue_size` - Stage 1 queue size
- `webhook_ingest_queue_lag_ms` - Stage 1 processing lag
- `webhook_processing_queue_size` - Stage 2 queue size
- `webhook_processing_queue_lag_ms` - Stage 2 processing lag
- `webhook_stage1_duration_ms` - Stage 1 processing time
- `webhook_stage2_duration_ms` - Stage 2 processing time

### Event Type Metrics
- `webhook_events_by_type_total` - by event_type
- `webhook_events_normalized_total` - by provider, event_type

---

## Next Steps (Phase 3)

After Phase 2 V2 completion:

1. Implement Stage 2 worker (business logic)
2. Implement event handlers:
   - `TokenRevokedHandler`
   - `PermissionChangedHandler`
   - `AccountDisconnectedHandler`
   - `MediaPublishedHandler`
3. Update SocialAccount status
4. Trigger token refresh
5. Implement user notifications
6. Add monitoring dashboards

---

## Documentation

- **Full Architecture Plan:** `PHASE_2_ARCHITECTURE_PLAN_V2.md`
- **Architecture Diagrams:** `PHASE_2_ARCHITECTURE_DIAGRAM_V2.md`
- **Quick Reference:** `PHASE_2_QUICK_REFERENCE.md` (update for V2)
- **Phase 1B Report:** `PHASE_1B_VALIDATION_REPORT.md`

---

**Ready for Implementation:** Yes  
**Estimated Effort:** 3-4 days  
**Risk Level:** Low (no Phase 1B modifications)  
**Architecture Review:** Approved
