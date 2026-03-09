# System Architecture Snapshot

**Purpose:** Concise runtime architecture overview for engineers (5-minute read)  
**Source:** Extracted from SYSTEM_CONTEXT_AUDIT.md  
**Last Updated:** 2026-03-07

---

## SECTION 1 — CORE SERVICES

### Publishing & Queue Management
- **PublishingRouter** (`src/services/PublishingRouter.ts`) - Routes posts to platform-specific queues
- **QueueMonitoringService** (`src/services/QueueMonitoringService.ts`) - Queue health and lag metrics
- **WorkerManager** (`src/services/WorkerManager.ts`) - Worker lifecycle management
- **WorkerHeartbeatService** (`src/services/WorkerHeartbeatService.ts`) - Worker health monitoring

### Rate Limiting & Circuit Breaking
- **RateLimiterService** (`src/services/RateLimiterService.ts`) - API rate limiting
- **PlatformRateLimitService** (`src/services/PlatformRateLimitService.ts`) - Platform-specific rate limits
- **GlobalRateLimitManager** (`src/services/GlobalRateLimitManager.ts`) - Cross-platform rate limit coordination
- **CircuitBreakerService** (`src/services/CircuitBreakerService.ts`) - Generic circuit breaker
- **PlatformCircuitBreakerService** (`src/services/PlatformCircuitBreakerService.ts`) - Platform-specific circuit breakers
- **CircuitBreakerManager** (`src/services/CircuitBreakerManager.ts`) - Circuit breaker orchestration

### Token & OAuth Management
- **TokenEncryptionService** (`src/services/TokenEncryptionService.ts`) - AES-256-GCM token encryption
- **TokenLifecycleService** (`src/services/TokenLifecycleService.ts`) - Token state management
- **TokenRefreshWorker** (`src/workers/TokenRefreshWorker.ts`) - Automatic token refresh
- **OAuthService** (`src/services/OAuthService.ts`) - OAuth flow orchestration
- **OAuthStateService** (`src/services/OAuthStateService.ts`) - CSRF protection via state parameters

### Health & Monitoring
- **HealthCheckService** (`src/services/HealthCheckService.ts`) - System health checks
- **PlatformHealthService** (`src/services/PlatformHealthService.ts`) - Platform API health monitoring
- **ConnectionHealthService** (`src/services/ConnectionHealthService.ts`) - Redis/MongoDB connection health
- **PublishingHealthService** (`src/services/PublishingHealthService.ts`) - Publishing pipeline health

### Security & Resilience
- **DistributedLockService** (`src/services/DistributedLockService.ts`) - Redlock distributed locking
- **PublishingLockService** (`src/services/PublishingLockService.ts`) - Publishing idempotency locks
- **PublishHashService** (`src/services/PublishHashService.ts`) - Content hash for external idempotency
- **RetryStormProtectionService** (`src/services/RetryStormProtectionService.ts`) - Prevents retry storms
- **SecurityAuditService** (`src/services/SecurityAuditService.ts`) - Security event logging

### Business Logic
- **PostService** (`src/services/PostService.ts`) - Post CRUD operations
- **SchedulerService** (`src/services/SchedulerService.ts`) - Post scheduling logic
- **SocialAccountService** (`src/services/SocialAccountService.ts`) - Social account management
- **BillingService** (`src/services/BillingService.ts`) - Stripe billing integration
- **AnalyticsService** (`src/services/AnalyticsService.ts`) - Analytics aggregation

---

## SECTION 2 — ACTIVE WORKERS

| Worker | Queue | Responsibility |
|--------|-------|----------------|
| **SchedulerWorker** | `scheduler-queue` | Polls every 60s for posts with `scheduledAt <= now`, routes to platform queues |
| **PostPublishingWorker** | `post-publishing-queue` | New publishing pipeline (Phase 4) |
| **FacebookPublisherWorker** | `facebook-publish-queue` | Publishes to Facebook Pages via Graph API |
| **InstagramPublisherWorker** | `instagram-publish-queue` | Publishes to Instagram Business via Graph API |
| **TwitterPublisherWorker** | `twitter-publish-queue` | Publishes to Twitter/X via OAuth 2.0 API |
| **LinkedInPublisherWorker** | `linkedin-publish-queue` | Publishes to LinkedIn personal/org pages |
| **TikTokPublisherWorker** | `tiktok-publish-queue` | Publishes videos to TikTok Creator accounts |
| **TokenRefreshWorker** | `token-refresh-queue` | Polls every 5 minutes for tokens expiring in <15 minutes |
| **DistributedTokenRefreshWorker** | `token-refresh-queue` | Event-driven token refresh with distributed locking |
| **MediaProcessingWorker** | `media-processing-queue` | Uploads and processes media files |
| **AnalyticsCollectorWorker** | `analytics-collection-queue` | Fetches post metrics from platforms |
| **EmailWorker** | `email-queue` | Sends transactional emails via SMTP |
| **NotificationWorker** | `notification-queue` | Delivers in-app notifications |
| **ConnectionHealthCheckWorker** | N/A | Monitors Redis/MongoDB connections (1 hour interval) |
| **AccountHealthCheckWorker** | N/A | Scores account health based on token status |
| **BackupVerificationWorker** | N/A | Verifies backup integrity |

---

## SECTION 3 — ACTIVE QUEUES

| Queue Name | Worker | Job Payload | Concurrency | Retry |
|------------|--------|-------------|-------------|-------|
| `scheduler-queue` | SchedulerWorker | `{ type: 'check-scheduled-posts' }` | 1 | N/A (repeatable) |
| `post-publishing-queue` | PostPublishingWorker | `{ postId, platform }` | 10 | 5 attempts |
| `facebook-publish-queue` | FacebookPublisherWorker | `{ postId, accountId }` | 5 | 3 attempts |
| `instagram-publish-queue` | InstagramPublisherWorker | `{ postId, accountId }` | 5 | 3 attempts |
| `twitter-publish-queue` | TwitterPublisherWorker | `{ postId, accountId }` | 5 | 3 attempts |
| `linkedin-publish-queue` | LinkedInPublisherWorker | `{ postId, accountId }` | 5 | 3 attempts |
| `tiktok-publish-queue` | TikTokPublisherWorker | `{ postId, accountId }` | 5 | 3 attempts |
| `token-refresh-queue` | TokenRefreshWorker, DistributedTokenRefreshWorker | `{ accountId }` | 3 | 3 attempts |
| `media-processing-queue` | MediaProcessingWorker | `{ mediaId, workspaceId }` | 5 | 3 attempts |
| `analytics-collection-queue` | AnalyticsCollectorWorker | `{ postId, platform }` | 5 | 3 attempts |
| `email-queue` | EmailWorker | `{ to, subject, body, template }` | 5 | 3 attempts |
| `notification-queue` | NotificationWorker | `{ userId, type, data }` | 5 | 3 attempts |
| `webhook-ingest-queue` | N/A | `{ webhookId, payload }` | 10 | 3 attempts |
| `webhook-processing-queue` | N/A | `{ eventId, type }` | 5 | 3 attempts |
| `dead-letter-queue` | N/A | Failed jobs from all queues | N/A | Manual replay |

---

## SECTION 4 — MONGODB MODELS

| Model | Key Indexes | Purpose |
|-------|-------------|---------|
| **User** | `email`, `clerkId` | User authentication and profile |
| **Workspace** | `ownerId`, `slug` | Multi-tenant workspace isolation |
| **WorkspaceMember** | `workspaceId + userId` | Workspace membership and roles |
| **SocialAccount** | `workspaceId + platform`, `tokenExpiresAt` | Connected social media accounts |
| **Post** | `workspaceId + status`, `scheduledAt`, `workspaceId + platforms` | Scheduled posts |
| **PostPublishAttempt** | `postId + platform`, `createdAt` | Publishing audit trail |
| **PostAnalytics** | `postId + platform` | Post performance metrics |
| **Media** | `workspaceId`, `uploadedBy` | Media library |
| **DraftPost** | `workspaceId + userId` | Draft posts (auto-save) |
| **Subscription** | `workspaceId`, `stripeSubscriptionId` | Stripe billing subscriptions |
| **Usage** | `workspaceId + period` | Usage tracking for billing |
| **Notification** | `userId + read`, `createdAt` | In-app notifications |
| **AuditLog** | `workspaceId + timestamp`, `userId + timestamp` | Security audit trail |
| **OAuthFailureLog** | `accountId + timestamp` | OAuth failure tracking |
| **Webhook** | `workspaceId + platform` | Webhook configurations |
| **WebhookEvent** | `webhookId + timestamp` | Webhook event log |

---

## SECTION 5 — REDIS KEY PATTERNS

### Distributed Locking
```
lock:refresh-{accountId}          # Token refresh locks (30s TTL)
lock:publish-{postId}-{platform}  # Publishing locks (30s TTL)
lock:job-{jobId}                  # Job deduplication locks
```

### OAuth & Session Management
```
oauth:state:{stateId}             # OAuth state storage (10 min TTL)
session:{sessionId}               # User session data
```

### Rate Limiting
```
rate-limit:{ip}:{endpoint}        # API rate limit counters
rate-limit:platform:{platform}:{accountId}  # Platform rate limits
rate-limit:global:{platform}      # Global platform rate limits
```

### Circuit Breakers
```
circuit-breaker:{platform}:{id}   # Circuit breaker state (open/closed/half-open)
circuit-breaker:account:{accountId}  # Per-account circuit breakers
```

### Queue Health
```
queue:lag:{queueName}             # Queue lag metrics
queue:backpressure:{queueName}    # Backpressure detection
worker:heartbeat:{workerId}       # Worker heartbeat timestamps
```

### Webhook & Caching
```
webhook:verification:{id}         # Webhook verification cache
webhook:dedup:{hash}              # Webhook deduplication
cache:analytics:{postId}          # Analytics cache
```

---

## SECTION 6 — PUBLISHING PIPELINE

### Complete Flow (Phase 4 Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER CREATES POST                                            │
│    → Post Model (status: draft)                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. USER SCHEDULES POST                                          │
│    → Post Model (status: scheduled, scheduledAt: timestamp)     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. SCHEDULER WORKER (polls every 60s)                           │
│    → Query: { status: 'scheduled', scheduledAt: { $lte: now } }│
│    → Detects eligible posts                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. MULTI-PLATFORM FANOUT                                        │
│    → PublishingRouter.route(platform)                           │
│    → Creates job per platform in post.platforms[]              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. PLATFORM-SPECIFIC QUEUES                                     │
│    ├── facebook-publish-queue                                   │
│    ├── instagram-publish-queue                                  │
│    ├── twitter-publish-queue                                    │
│    ├── linkedin-publish-queue                                   │
│    └── tiktok-publish-queue                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. PLATFORM-SPECIFIC WORKERS                                    │
│    → Acquire publishing lock (Redis)                            │
│    → Check circuit breaker status                               │
│    → Validate token expiration                                  │
│    → Call platform adapter                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. PLATFORM ADAPTERS (Real API Calls)                           │
│    ├── FacebookOAuthProvider → Graph API                        │
│    ├── InstagramBusinessProvider → Graph API                    │
│    ├── TwitterOAuthProvider → Twitter API v2                    │
│    ├── LinkedInOAuthProvider → LinkedIn API                     │
│    └── TikTokProvider → TikTok Creator API                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. POST-PUBLISH UPDATES                                         │
│    → Post Model (status: published, publishedAt: timestamp)     │
│    → PostPublishAttempt (audit trail)                           │
│    → Release publishing lock                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Idempotency Mechanisms
1. **Publishing Lock:** Redis lock per `(postId, platform)` prevents duplicate publishes
2. **Publish Hash:** Content hash stored in `PostPublishAttempt` for external idempotency
3. **Job Deduplication:** BullMQ `jobId` prevents duplicate queue jobs
4. **Optimistic Locking:** Mongoose `__v` field prevents concurrent Post updates

### Error Handling
1. **Error Classification:** `PlatformErrorClassifier` categorizes errors as transient or permanent
2. **Retry Strategy:** Exponential backoff (5s, 15s, 45s) for transient errors
3. **Circuit Breaker:** Per-platform circuit breakers prevent cascading failures
4. **Dead-Letter Queue:** Failed jobs moved to DLQ for manual investigation

---

## SECTION 7 — SYSTEM COMPLETENESS

### ✅ COMPLETE SYSTEMS
- **OAuth Integration:** Facebook, Instagram, Twitter, LinkedIn, TikTok
- **Publishing Pipeline:** Phase 4 architecture with platform-specific queues
- **Token Lifecycle:** Automatic refresh, encryption, rotation
- **Rate Limiting:** API + platform-specific rate limits
- **Circuit Breakers:** Per-platform and per-account circuit breakers
- **Distributed Locking:** Redlock for token refresh and publishing
- **Queue System:** BullMQ with 16+ active queues
- **Worker System:** 17 active workers with heartbeat monitoring
- **Observability:** Sentry, OpenTelemetry, Prometheus
- **Security:** Token encryption, CSRF protection, audit logging
- **Billing:** Stripe integration with usage tracking
- **Multi-Tenancy:** Workspace isolation with role-based access

### ⚠️ PARTIAL SYSTEMS
- **Worker Lifecycle Management:** Basic heartbeat, no auto-restart on crash
- **Queue Health Monitoring:** Basic lag metrics, no backpressure detection
- **Redis Resilience:** Basic circuit breaker, no enhanced reconnection logic
- **Health Endpoints:** Basic health checks, not comprehensive
- **Docker Production:** Development config, not production-hardened

### ❌ MISSING SYSTEMS
- **Kubernetes Deployment:** No production orchestration
- **Auto-Scaling:** No dynamic worker scaling
- **Multi-Region:** Single-region deployment only
- **Advanced Analytics:** No real-time dashboard
- **Webhook System:** Partial implementation

---

## SECTION 8 — HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │Dashboard │  │Composer  │  │Calendar  │  │Analytics │  │Settings  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓ HTTPS
┌─────────────────────────────────────────────────────────────────────────┐
│                        API SERVER (Express + TypeScript)                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Controllers: Auth, Post, SocialAccount, Billing, Analytics      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Services: OAuth, Publishing, Token, RateLimit, CircuitBreaker   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Middleware: Auth, CSRF, RateLimit, ErrorHandler                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓                                   ↓
┌──────────────────────────────┐    ┌──────────────────────────────────────┐
│      MONGODB (Atlas)         │    │         REDIS (Cloud)                │
│  ┌────────────────────────┐  │    │  ┌────────────────────────────────┐ │
│  │ Users, Workspaces      │  │    │  │ Locks, Sessions, Rate Limits   │ │
│  │ SocialAccounts, Posts  │  │    │  │ Circuit Breakers, OAuth State  │ │
│  │ Analytics, Billing     │  │    │  │ Queue Health, Worker Heartbeat │ │
│  └────────────────────────┘  │    │  └────────────────────────────────┘ │
└──────────────────────────────┘    └──────────────────────────────────────┘
                                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      BULLMQ QUEUE SYSTEM (Redis-backed)                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ scheduler-queue → post-publishing-queue → platform queues        │   │
│  │ facebook-publish-queue, instagram-publish-queue, twitter-...     │   │
│  │ token-refresh-queue, media-processing-queue, email-queue         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKER PROCESSES (17 Active Workers)                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ SchedulerWorker: Polls for scheduled posts every 60s            │   │
│  │ Platform Workers: Facebook, Instagram, Twitter, LinkedIn, TikTok│   │
│  │ TokenRefreshWorker: Polls for expiring tokens every 5 minutes   │   │
│  │ MediaProcessingWorker, AnalyticsCollectorWorker, EmailWorker    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      PLATFORM ADAPTERS (OAuth Providers)                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ FacebookOAuthProvider, InstagramBusinessProvider                 │   │
│  │ TwitterOAuthProvider, LinkedInOAuthProvider, TikTokProvider      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    SOCIAL MEDIA PLATFORM APIs                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │Facebook  │  │Instagram │  │Twitter/X │  │LinkedIn  │  │TikTok    │ │
│  │Graph API │  │Graph API │  │API v2    │  │API       │  │Creator   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY & MONITORING                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Sentry: Error tracking and alerting                              │   │
│  │ OpenTelemetry: Distributed tracing                               │   │
│  │ Prometheus: Metrics collection (queue lag, worker health)        │   │
│  │ Grafana: Dashboards and visualization (future)                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## KEY INSIGHTS FOR PHASE 6.5

### Current Gaps
1. **Worker Crashes:** No auto-restart mechanism, manual intervention required
2. **Queue Backpressure:** No detection or throttling when queues are overwhelmed
3. **Redis Disconnects:** Basic circuit breaker, no enhanced reconnection with exponential backoff
4. **Health Endpoints:** Missing comprehensive health checks for production readiness
5. **Docker Production:** Development config lacks multi-stage builds, health checks, and resource limits

### Phase 6.5 Goals
1. **Worker Lifecycle Management:** Auto-restart on crash, graceful shutdown, health checks
2. **Queue Health Monitoring:** Backpressure detection, queue lag alerts, stalled job recovery
3. **Redis Connection Resilience:** Enhanced circuit breaker, exponential backoff, connection pooling
4. **Comprehensive Health Endpoints:** `/health`, `/health/ready`, `/health/live` with detailed checks
5. **Production Docker Config:** Multi-stage builds, health checks, resource limits, security hardening

---

**End of Architecture Snapshot**
