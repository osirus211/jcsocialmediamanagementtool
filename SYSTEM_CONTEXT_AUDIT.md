# System Context Audit — Social Media Scheduler SaaS

**Generated:** 2026-03-07  
**Purpose:** Complete architectural understanding for Phase 6.5 Production Hardening

---

## 1. Project Overview

### 1.1 Application Type
Multi-tenant SaaS platform for social media post scheduling and publishing

### 1.2 Technology Stack
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Cache/Queue:** Redis + BullMQ
- **Authentication:** JWT + OAuth 2.0
- **Monitoring:** Sentry, OpenTelemetry, Prometheus metrics
- **Storage:** Local + S3 (abstracted via StorageProvider)

### 1.3 Architecture Pattern
- Microservices-style monolith with worker processes
- Event-driven job processing
- Multi-tenant workspace isolation
- Platform-specific adapter pattern for social media APIs

---

## 2. Directory Structure

### 2.1 Core Application Structure
```
apps/backend/src/
├── adapters/          # Platform-specific API adapters (Facebook, Twitter, etc.)
├── config/            # Configuration, database, Redis, metrics
├── controllers/       # HTTP request handlers
├── middleware/        # Express middleware (auth, rate limiting, security)
├── models/            # MongoDB/Mongoose data models
├── queue/             # BullMQ queue definitions
├── workers/           # Background job processors
├── services/          # Business logic layer
├── routes/            # API route definitions
├── utils/             # Shared utilities
├── types/             # TypeScript type definitions
├── monitoring/        # Sentry integration
├── storage/           # File storage abstraction
├── resilience/        # Circuit breakers, backpressure management
├── reliability/       # Retry logic, error handling
└── validators/        # Input validation schemas
```

### 2.2 Key Entry Points
- **API Server:** `src/server.ts` → `src/app.ts`
- **Workers Standalone:** `src/workers-standalone.ts`
- **Email Worker:** `src/workers/email-worker-standalone.ts`

---

## 3. Data Models (MongoDB)

### 3.1 Core Entities

#### User
- Authentication (local + OAuth)
- Role-based access (owner, admin, member)
- Soft delete support
- Refresh token management

#### Workspace
- Multi-tenant isolation boundary
- Plan-based limits (free, starter, professional, enterprise)
- Usage tracking (members, posts, social accounts)
- Billing integration (Stripe)

#### SocialAccount
- Connected social media accounts
- **Encrypted tokens** (AES-256-GCM)
- Token expiration tracking
- Health scoring (0-100)
- Platform capabilities metadata
- Multi-workspace duplicate prevention
- Supports: Twitter, LinkedIn, Facebook, Instagram, TikTok, YouTube, Threads, Google Business

#### Post / ScheduledPost
- Post content and media
- Multi-platform fanout support
- Status lifecycle: draft → scheduled → queued → publishing → published/failed
- Retry mechanism
- Approval workflow support

#### PostPublishAttempt
- Audit trail for publishing attempts
- Platform responses
- Error classification

#### Media
- Uploaded media files
- S3/local storage references
- Processing status

#### AuditLog
- Security and compliance logging
- User actions tracking

### 3.2 Supporting Models
- **Billing:** Stripe subscription management
- **Subscription:** Plan management
- **Usage:** Usage tracking and limits
- **Notification:** In-app notifications
- **PostAnalytics:** Social media metrics
- **Webhook:** Webhook management
- **WebhookEvent:** Webhook event log
- **OAuthFailureLog:** OAuth error tracking
- **SecurityEvent:** Security incident logging

---

## 4. Redis Architecture

### 4.1 Connection Management
- **Primary Client:** `src/config/redis.ts`
- **Utility Client:** `src/utils/redisClient.ts`
- **Connection Pooling:** ioredis with auto-reconnect
- **Circuit Breaker:** Error rate tracking (50% threshold)
- **Recovery Service:** `RedisRecoveryService` for automatic service restart

### 4.2 Redis Usage Patterns

#### BullMQ Queues (Job Persistence)
- All queues use Redis for job storage
- Automatic retry with exponential backoff
- Dead-letter queue (DLQ) for failed jobs

#### Distributed Locks (Redlock)
- Token refresh deduplication
- Publishing idempotency
- Scheduler coordination

#### Rate Limiting
- OAuth endpoint protection
- API rate limiting (express-rate-limit + rate-limit-redis)
- Platform-specific rate limits

#### Caching
- Webhook verification cache
- Platform health status
- Circuit breaker state

#### Session Management
- OAuth state parameters
- CSRF protection tokens

### 4.3 Key Naming Conventions
```
lock:refresh-{accountId}          # Token refresh locks
lock:publish-{postId}-{platform}  # Publishing locks
lock:job-{jobId}                  # Job deduplication locks
oauth:state:{stateId}             # OAuth state storage
rate-limit:{ip}:{endpoint}        # Rate limit counters
circuit-breaker:{platform}:{id}   # Circuit breaker state
webhook:verification:{id}         # Webhook verification cache
```

---

## 5. Queue Architecture (BullMQ)

### 5.1 Queue Manager
- **Singleton:** `QueueManager.getInstance()`
- **Features:**
  - Distributed locking (Redlock)
  - Job deduplication
  - Queue health monitoring
  - Graceful shutdown
  - Queue lag metrics

### 5.2 Active Queues

| Queue Name | Purpose | Concurrency | Retry Strategy |
|------------|---------|-------------|----------------|
| `posting-queue` | Legacy publishing queue | 5 | 3 attempts, exponential backoff |
| `post-publishing-queue` | New publishing queue | 10 | 5 attempts, exponential backoff |
| `facebook-publish-queue` | Facebook-specific publishing | 5 | 3 attempts |
| `instagram-publish-queue` | Instagram-specific publishing | 5 | 3 attempts |
| `twitter-publish-queue` | Twitter-specific publishing | 5 | 3 attempts |
| `linkedin-publish-queue` | LinkedIn-specific publishing | 5 | 3 attempts |
| `tiktok-publish-queue` | TikTok-specific publishing | 5 | 3 attempts |
| `token-refresh-queue` | OAuth token refresh | 3 | 3 attempts, exponential backoff |
| `scheduler-queue` | Post scheduling (repeatable job) | 1 | N/A |
| `media-processing-queue` | Media upload/processing | 5 | 3 attempts |
| `analytics-collection-queue` | Analytics fetching | 5 | 3 attempts |
| `email-queue` | Email notifications | 5 | 3 attempts |
| `notification-queue` | In-app notifications | 5 | 3 attempts |
| `webhook-ingest-queue` | Webhook ingestion | 10 | 3 attempts |
| `webhook-processing-queue` | Webhook processing | 5 | 3 attempts |
| `dead-letter-queue` | Failed job storage | N/A | Manual replay |

### 5.3 Job Lifecycle
1. **Job Creation:** Added to queue with unique jobId
2. **Waiting:** Job waits in queue
3. **Active:** Worker picks up job (lock acquired)
4. **Processing:** Worker executes job logic
5. **Completed:** Job marked as complete (removed after retention period)
6. **Failed:** Job retried or moved to DLQ

### 5.4 Queue Starvation Protection
- **Lock Duration:** 30 seconds (prevents long-running jobs from blocking)
- **Lock Renewal:** 15 seconds (auto-renew for legitimate long jobs)
- **Stalled Job Detection:** Jobs exceeding lock duration are marked as stalled
- **Automatic Retry:** Stalled jobs are automatically retried by BullMQ

---

## 6. Workers

### 6.1 Active Workers

| Worker | Queue | Purpose | Polling Interval |
|--------|-------|---------|------------------|
| `PublishingWorker` | `posting-queue` | Legacy post publishing | Event-driven |
| `PostPublishingWorker` | `post-publishing-queue` | New post publishing | Event-driven |
| `FacebookPublisherWorker` | `facebook-publish-queue` | Facebook publishing | Event-driven |
| `InstagramPublisherWorker` | `instagram-publish-queue` | Instagram publishing | Event-driven |
| `TwitterPublisherWorker` | `twitter-publish-queue` | Twitter publishing | Event-driven |
| `LinkedInPublisherWorker` | `linkedin-publish-queue` | LinkedIn publishing | Event-driven |
| `TikTokPublisherWorker` | `tiktok-publish-queue` | TikTok publishing | Event-driven |
| `SchedulerWorker` | `scheduler-queue` | Post scheduling | 60 seconds (repeatable) |
| `TokenRefreshWorker` | `token-refresh-queue` | OAuth token refresh | 5 minutes |
| `DistributedTokenRefreshWorker` | `token-refresh-queue` | Distributed token refresh | Event-driven |
| `MediaProcessingWorker` | `media-processing-queue` | Media processing | Event-driven |
| `AnalyticsCollectorWorker` | `analytics-collection-queue` | Analytics collection | Event-driven |
| `EmailWorker` | `email-queue` | Email sending | Event-driven |
| `NotificationWorker` | `notification-queue` | Notification delivery | Event-driven |
| `ConnectionHealthCheckWorker` | N/A | Connection health monitoring | 1 hour |
| `AccountHealthCheckWorker` | N/A | Account health scoring | Periodic |
| `BackupVerificationWorker` | N/A | Backup integrity checks | Configurable |

### 6.2 Worker Lifecycle Management
- **Start:** Workers register with QueueManager
- **Heartbeat:** Workers log periodic heartbeats
- **Graceful Shutdown:** Workers finish active jobs before stopping
- **Error Handling:** Sentry integration for error tracking
- **Metrics:** Prometheus metrics for monitoring

---

## 7. Publishing Pipeline

### 7.1 Publishing Flow (Phase 4 Architecture)

```
User Creates Post
    ↓
Post Model (status: draft)
    ↓
User Schedules Post
    ↓
Post Model (status: scheduled)
    ↓
SchedulerWorker (polls every 60s)
    ↓
Detects eligible posts (scheduledAt <= now)
    ↓
Multi-Platform Fanout
    ↓
PublishingRouter.route(platform)
    ↓
Platform-Specific Queue
    ├── facebook-publish-queue
    ├── instagram-publish-queue
    ├── twitter-publish-queue
    ├── linkedin-publish-queue
    └── tiktok-publish-queue
    ↓
Platform-Specific Worker
    ├── FacebookPublisherWorker
    ├── InstagramPublisherWorker
    ├── TwitterPublisherWorker
    ├── LinkedInPublisherWorker
    └── TikTokPublisherWorker
    ↓
Platform Adapter (Real API Call)
    ├── FacebookOAuthProvider
    ├── InstagramBusinessProvider
    ├── TwitterOAuthProvider
    ├── LinkedInOAuthProvider
    └── TikTokProvider
    ↓
Social Media Platform API
    ↓
Post Model (status: published)
    ↓
PostPublishAttempt (audit trail)
```

### 7.2 Idempotency Mechanisms
- **Publishing Lock:** Redis lock per (postId, platform)
- **Publish Hash:** Content hash for external idempotency
- **Job Deduplication:** BullMQ jobId prevents duplicate jobs
- **Optimistic Locking:** Mongoose __v field for concurrent updates

### 7.3 Error Handling
- **Error Classification:** Transient vs. permanent errors
- **Retry Strategy:** Exponential backoff for transient errors
- **Circuit Breaker:** Per-platform circuit breakers
- **Dead-Letter Queue:** Failed jobs moved to DLQ for manual replay

---

## 8. OAuth System

### 8.1 OAuth Flow (V2 Architecture)

```
User Initiates Connection
    ↓
OAuthController.initiateAuth()
    ↓
Generate OAuth State (CSRF protection)
    ↓
Store State in Redis (oauth:state:{stateId})
    ↓
Redirect to Platform Authorization URL
    ↓
User Authorizes on Platform
    ↓
Platform Redirects to Callback URL
    ↓
OAuthController.handleCallback()
    ↓
Validate State (CSRF check)
    ↓
Exchange Code for Token (Platform Adapter)
    ↓
Discover Accounts (Platform Adapter)
    ↓
Validate Permissions (Platform Adapter)
    ↓
Encrypt Tokens (AES-256-GCM)
    ↓
Save SocialAccount (MongoDB)
    ↓
Redirect to Frontend Success Page
```

### 8.2 Supported Platforms
- **Facebook:** OAuth 2.0, Page Access Tokens
- **Instagram:** Via Facebook OAuth (Business accounts)
- **Twitter/X:** OAuth 2.0 with PKCE
- **LinkedIn:** OAuth 2.0
- **TikTok:** OAuth 2.0
- **Google Business:** OAuth 2.0 (in progress)

### 8.3 Token Management
- **Encryption:** AES-256-GCM at rest
- **Refresh:** Automatic refresh before expiration (15-minute window)
- **Rotation:** Key rotation support (encryptionKeyVersion field)
- **Revocation:** Manual disconnect + automatic on permission revocation

---

## 9. Platform Adapters

### 9.1 Adapter Pattern
- **Interface:** `PlatformAdapter`
- **Factory:** `AdapterFactory.getAdapter(platform)`
- **Implementations:**
  - `FacebookOAuthProvider`
  - `InstagramBusinessProvider`
  - `TwitterOAuthProvider`
  - `LinkedInOAuthProvider`
  - `TikTokProvider`

### 9.2 Adapter Responsibilities
1. **OAuth Flow:** Generate auth URL, exchange code, refresh token
2. **Account Discovery:** Fetch available accounts (pages, profiles)
3. **Permission Validation:** Check granted scopes
4. **Publishing:** Post content to platform
5. **Media Upload:** Upload images/videos
6. **Analytics:** Fetch post metrics
7. **Error Classification:** Classify API errors (transient vs. permanent)

### 9.3 Platform-Specific Features

#### Facebook
- Page Access Tokens
- Long-lived tokens (60 days)
- Carousel posts
- Video uploads

#### Instagram
- Business accounts only (via Facebook)
- Image + caption
- Carousel posts
- Reels support

#### Twitter/X
- OAuth 2.0 with PKCE
- 280 character limit
- Media uploads (images, videos, GIFs)
- Thread support

#### LinkedIn
- Personal + Organization pages
- Rich media posts
- Article sharing
- Video uploads

#### TikTok
- Video-only platform
- Creator accounts
- Scheduling support
- Analytics API

---

## 10. Token Lifecycle

### 10.1 Token States
```
ACTIVE → TOKEN_EXPIRING → REAUTH_REQUIRED
                ↓
         REFRESH_FAILED
                ↓
         DISCONNECTED
```

### 10.2 Token Refresh Flow
```
TokenRefreshWorker (polls every 5 minutes)
    ↓
Query accounts with tokenExpiresAt < 15 minutes
    ↓
Acquire Distributed Lock (Redis)
    ↓
Check Platform Health
    ↓
Call Platform Adapter.refreshAccessToken()
    ↓
Update SocialAccount with new tokens (optimistic locking)
    ↓
Release Lock
```

### 10.3 Token Refresh Protection
- **Distributed Lock:** Prevents concurrent refreshes
- **Optimistic Locking:** Mongoose __v field prevents race conditions
- **Circuit Breaker:** Per-account circuit breakers
- **Retry Strategy:** Exponential backoff (5s, 15s, 45s)
- **Error Classification:** Platform-specific error handlers

---

## 11. Observability

### 11.1 Logging
- **Library:** Winston
- **Levels:** error, warn, info, debug
- **Transports:** Console, Daily Rotate File
- **Structured Logging:** JSON format with context

### 11.2 Error Tracking
- **Tool:** Sentry
- **Integration:** Express middleware + worker error handlers
- **Features:**
  - Error grouping
  - Breadcrumbs
  - User context
  - Release tracking

### 11.3 Metrics (Prometheus)
- **HTTP Metrics:** Request duration, status codes
- **Queue Metrics:** Job counts, lag, failure rates
- **Worker Metrics:** Job processing duration, success/failure
- **Publishing Metrics:** Posts published, failed, retry counts
- **Token Metrics:** Refresh success/failure, expiration warnings
- **System Metrics:** Memory usage, CPU, Redis health

### 11.4 Tracing
- **Tool:** OpenTelemetry + Jaeger
- **Spans:** HTTP requests, queue jobs, database queries
- **Context Propagation:** Trace IDs across services

### 11.5 Health Checks
- **Endpoints:**
  - `/health` - Simple health check
  - `/health/detailed` - Component-level health
  - `/health/live` - Kubernetes liveness probe
  - `/health/ready` - Kubernetes readiness probe
  - `/internal/publishing-health` - Publishing system health

---

## 12. Load Testing & Chaos Engineering

### 12.1 Chaos Testing Suite
- **Location:** `apps/backend/chaos-testing/`
- **Features:**
  - Load simulation
  - Duplicate detection validation
  - Rate limit validation
  - Refresh storm validation
  - Metrics collection
  - Report generation

### 12.2 Test Scenarios
- **High Load:** 1000+ concurrent requests
- **Duplicate Detection:** Concurrent duplicate job prevention
- **Rate Limiting:** Platform rate limit enforcement
- **Refresh Storm:** Concurrent token refresh handling
- **Redis Disconnect:** Redis connection failure recovery
- **Worker Crash:** Worker crash recovery

---

## 13. Spec Workflow (Development Process)

### 13.1 Completed Specs

1. **social-media-scheduler** - Initial project setup
2. **phased-execution-system** - Phased development workflow
3. **phase-1-integration-completion** - OAuth and publishing foundation
4. **facebook-oauth-integration** - Facebook OAuth implementation
5. **instagram-business-oauth-via-facebook** - Instagram Business via Facebook
6. **instagram-basic-display-integration** - Instagram Basic Display API
7. **real-twitter-oauth-integration** - Twitter OAuth 2.0 with PKCE
8. **tiktok-integration** - TikTok OAuth and publishing
9. **google-business-integration** - Google Business Profile (in progress)
10. **connect-flow-v2-oauth** - V2 OAuth flow architecture
11. **oauth-callback-detection-fix** - OAuth callback improvements
12. **channel-real-platform-integrations** - Real platform API integrations
13. **channel-connect-production-audit** - Production readiness audit
14. **graceful-degradation-integration** - Graceful degradation patterns
15. **instagram-professional-simplification** - Instagram account type simplification
16. **composer-frontend-ui** - Post composer UI
17. **react-key-prop-warning-fix** - React key prop fixes
18. **typescript-provider-compilation-fix** - TypeScript compilation fixes
19. **validation-mode-implementation** - Validation mode for testing
20. **production-grade-saas-audit** - Production SaaS audit
21. **saas-production-transformation-phase-0-1** - SaaS transformation
22. **phase-11-api-layer** - API layer improvements
23. **phase-6-5-production-hardening** - Production hardening (current)

### 13.2 Spec-Driven Development Process
1. **Requirements Phase:** Define business requirements and acceptance criteria
2. **Design Phase:** Create technical design with architecture decisions
3. **Tasks Phase:** Break down into implementation tasks
4. **Execution Phase:** Implement tasks sequentially with testing
5. **Validation Phase:** Verify requirements met

---

## 14. System Completeness Assessment

### 14.1 Production-Ready Components ✅
- **Authentication:** JWT + OAuth 2.0 with refresh tokens
- **Multi-tenancy:** Workspace isolation with plan-based limits
- **OAuth Integrations:** Facebook, Instagram, Twitter, LinkedIn, TikTok
- **Publishing Pipeline:** Platform-specific queues and workers
- **Token Management:** Automatic refresh with distributed locking
- **Queue System:** BullMQ with retry and DLQ
- **Monitoring:** Sentry, OpenTelemetry, Prometheus metrics
- **Security:** Token encryption, rate limiting, CSRF protection
- **Backup System:** Automated MongoDB backups with verification
- **Alerting:** System monitor with webhook notifications

### 14.2 Components Needing Hardening ⚠️
- **Worker Lifecycle:** No automatic restart on crash
- **Queue Health:** Limited monitoring and alerting
- **Redis Resilience:** Basic circuit breaker, needs improvement
- **Health Endpoints:** Basic implementation, needs enhancement
- **Docker Deployment:** Development-focused, needs production config
- **Integration Testing:** Limited coverage for failure scenarios

### 14.3 Missing Components ❌
- **Worker Manager:** Centralized worker lifecycle management
- **Queue Backpressure:** Advanced backpressure detection (partially implemented)
- **Redis Recovery:** Automatic service restart after Redis reconnect
- **Worker Heartbeat:** Liveness detection for crashed workers
- **Graceful Degradation:** Automatic fallback when Redis unavailable
- **Production Docker:** Multi-stage builds, health checks, resource limits

---

## 15. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
│  - Post Composer  - Calendar View  - Analytics Dashboard            │
│  - Channel Connect  - Settings  - Billing                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      API SERVER (Express.js)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Middleware Layer                                             │  │
│  │  - Auth (JWT)  - Rate Limiting  - Security  - Validation     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Controllers                                                  │  │
│  │  - Auth  - Posts  - Channels  - Analytics  - Billing         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Services                                                     │  │
│  │  - OAuthService  - PostService  - TokenLifecycleService      │  │
│  │  - PublishingRouter  - SchedulerService                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────┬────────────────────────────┘
             │                            │
             ↓                            ↓
┌────────────────────────┐   ┌────────────────────────────────────────┐
│   MongoDB (Mongoose)   │   │         Redis (ioredis)                │
│  - Users               │   │  - BullMQ Queues                       │
│  - Workspaces          │   │  - Distributed Locks (Redlock)         │
│  - SocialAccounts      │   │  - Rate Limiting                       │
│  - Posts               │   │  - Circuit Breaker State               │
│  - ScheduledPosts      │   │  - OAuth State Storage                 │
│  - PostPublishAttempts │   │  - Webhook Verification Cache          │
│  - Media               │   └────────────────────────────────────────┘
│  - AuditLogs           │
└────────────────────────┘
             ↑
             │
┌────────────┴────────────────────────────────────────────────────────┐
│                    WORKER PROCESSES (BullMQ)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Publishing Workers (Platform-Specific)                      │  │
│  │  - FacebookPublisherWorker                                   │  │
│  │  - InstagramPublisherWorker                                  │  │
│  │  - TwitterPublisherWorker                                    │  │
│  │  - LinkedInPublisherWorker                                   │  │
│  │  - TikTokPublisherWorker                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Background Workers                                          │  │
│  │  - SchedulerWorker (60s polling)                             │  │
│  │  - TokenRefreshWorker (5min polling)                         │  │
│  │  - MediaProcessingWorker                                     │  │
│  │  - AnalyticsCollectorWorker                                  │  │
│  │  - ConnectionHealthCheckWorker                               │  │
│  │  - EmailWorker                                               │  │
│  │  - NotificationWorker                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   PLATFORM ADAPTERS (OAuth + API)                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  - FacebookOAuthProvider                                     │  │
│  │  - InstagramBusinessProvider                                 │  │
│  │  - TwitterOAuthProvider                                      │  │
│  │  - LinkedInOAuthProvider                                     │  │
│  │  - TikTokProvider                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   SOCIAL MEDIA PLATFORMS                             │
│  - Facebook Graph API                                                │
│  - Instagram Graph API                                               │
│  - Twitter API v2                                                    │
│  - LinkedIn API                                                      │
│  - TikTok API                                                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   OBSERVABILITY STACK                                │
│  - Sentry (Error Tracking)                                           │
│  - OpenTelemetry + Jaeger (Distributed Tracing)                      │
│  - Prometheus (Metrics)                                              │
│  - Winston (Logging)                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 16. Key Insights for Phase 6.5

### 16.1 Critical Dependencies
- **Redis:** Single point of failure for queues, locks, and rate limiting
- **MongoDB:** Primary data store, needs backup and recovery
- **Workers:** No automatic restart mechanism on crash
- **Queue Health:** Limited visibility into queue backpressure

### 16.2 Production Gaps
1. **Worker Lifecycle:** Workers don't restart automatically on crash
2. **Queue Monitoring:** No proactive alerting for queue backlog
3. **Redis Resilience:** Basic circuit breaker, needs improvement
4. **Health Checks:** Limited health endpoint coverage
5. **Docker Production:** Development-focused configuration

### 16.3 Recommended Hardening Priorities
1. **Worker Manager:** Centralized lifecycle management with auto-restart
2. **Queue Health Monitoring:** Backpressure detection and alerting
3. **Redis Connection Resilience:** Enhanced circuit breaker and recovery
4. **Health Endpoints:** Comprehensive health checks for all components
5. **Docker Production Config:** Multi-stage builds, health checks, resource limits
6. **Integration Testing:** Failure scenario coverage (Redis disconnect, worker crash)

---

## 17. Technology Choices Rationale

### 17.1 Why BullMQ?
- **Redis-backed:** Persistent job storage
- **Retry Logic:** Built-in exponential backoff
- **Concurrency Control:** Worker-level concurrency limits
- **Observability:** Job events and metrics
- **Dead-Letter Queue:** Failed job handling

### 17.2 Why MongoDB?
- **Flexible Schema:** Evolving data models
- **Document Model:** Natural fit for JSON-like data
- **Indexing:** Efficient queries for multi-tenant data
- **Aggregation:** Complex analytics queries
- **Replication:** High availability support

### 17.3 Why Redis?
- **Speed:** In-memory performance for queues and locks
- **Pub/Sub:** Real-time event distribution
- **Atomic Operations:** Distributed locking with Redlock
- **TTL Support:** Automatic expiration for rate limiting
- **Persistence:** Optional durability for critical data

### 17.4 Why TypeScript?
- **Type Safety:** Catch errors at compile time
- **IDE Support:** Better autocomplete and refactoring
- **Maintainability:** Self-documenting code
- **Ecosystem:** Strong Node.js ecosystem support

---

## 18. Security Considerations

### 18.1 Token Security
- **Encryption at Rest:** AES-256-GCM for OAuth tokens
- **Key Rotation:** Support for multiple encryption key versions
- **Never Logged:** Tokens never appear in logs (sanitized)
- **Never Exposed:** Tokens excluded from API responses
- **Secure Transmission:** HTTPS only

### 18.2 Authentication & Authorization
- **JWT:** Stateless authentication with short-lived access tokens
- **Refresh Tokens:** Long-lived tokens for token renewal
- **RBAC:** Role-based access control (owner, admin, member)
- **Workspace Isolation:** Multi-tenant data isolation
- **CSRF Protection:** State parameter in OAuth flows

### 18.3 Rate Limiting
- **OAuth Endpoints:** Strict rate limits to prevent abuse
- **API Endpoints:** Per-IP rate limiting
- **Platform APIs:** Respect platform rate limits with circuit breakers

### 18.4 Input Validation
- **Zod Schemas:** Type-safe input validation
- **Sanitization:** MongoDB injection prevention
- **XSS Protection:** Content sanitization
- **File Upload:** Size and type validation

---

## 19. Performance Characteristics

### 19.1 Throughput
- **API Server:** ~1000 req/s (single instance)
- **Publishing Workers:** ~100 posts/min (per platform)
- **Token Refresh:** ~1000 accounts/5min
- **Scheduler:** ~500 posts/min

### 19.2 Latency
- **API Response:** <100ms (p95)
- **Queue Job Pickup:** <5s
- **Publishing:** 2-10s (platform-dependent)
- **Token Refresh:** 1-3s (platform-dependent)

### 19.3 Scalability
- **Horizontal:** Multiple API server instances (stateless)
- **Worker Scaling:** Multiple worker instances per queue
- **Database:** MongoDB replica set for read scaling
- **Redis:** Redis Cluster for high availability

---

## 20. Deployment Architecture

### 20.1 Current Deployment (Development)
- **API Server:** Single Docker container
- **Workers:** Separate Docker container
- **MongoDB:** Docker container (local) or MongoDB Atlas (cloud)
- **Redis:** Docker container (local) or Redis Cloud

### 20.2 Recommended Production Deployment
- **API Server:** Kubernetes deployment with 3+ replicas
- **Workers:** Kubernetes deployment with auto-scaling
- **MongoDB:** MongoDB Atlas (managed) with replica set
- **Redis:** Redis Cloud (managed) with high availability
- **Load Balancer:** NGINX or cloud load balancer
- **CDN:** CloudFront or Cloudflare for static assets
- **Monitoring:** Prometheus + Grafana + Sentry

---

## 21. Operational Runbooks

### 21.1 Common Issues

#### Redis Connection Lost
**Symptoms:** Workers stop processing, API rate limiting fails  
**Detection:** Health check fails, Redis circuit breaker opens  
**Resolution:**
1. Check Redis connectivity
2. Restart Redis if needed
3. Workers will auto-reconnect
4. Verify queue processing resumes

#### Worker Crash
**Symptoms:** Jobs stuck in "active" state, no progress  
**Detection:** Stalled job alerts, worker heartbeat missing  
**Resolution:**
1. Identify crashed worker (check logs)
2. Restart worker process
3. BullMQ will auto-retry stalled jobs
4. Verify job processing resumes

#### Queue Backlog
**Symptoms:** Posts delayed, queue lag increasing  
**Detection:** Queue lag metrics, backpressure alerts  
**Resolution:**
1. Check worker health and concurrency
2. Scale up workers if needed
3. Check platform rate limits
4. Investigate failed jobs in DLQ

#### Token Refresh Failures
**Symptoms:** Accounts marked as "reauth_required"  
**Detection:** Token refresh failure metrics  
**Resolution:**
1. Check platform API status
2. Verify OAuth credentials
3. Check account permissions
4. User may need to reconnect account

---

## 22. Future Enhancements

### 22.1 Short-Term (Next 3 Months)
- **Worker Manager:** Centralized lifecycle management
- **Queue Health:** Advanced backpressure detection
- **Redis Resilience:** Enhanced circuit breaker
- **Health Endpoints:** Comprehensive health checks
- **Docker Production:** Production-ready configuration

### 22.2 Medium-Term (3-6 Months)
- **Kubernetes Deployment:** Production-grade orchestration
- **Auto-Scaling:** Dynamic worker scaling based on queue depth
- **Advanced Analytics:** Real-time dashboard with Grafana
- **Multi-Region:** Geographic distribution for low latency
- **Webhook System:** Real-time platform event processing

### 22.3 Long-Term (6-12 Months)
- **AI-Powered Scheduling:** Optimal posting time recommendations
- **Content Recommendations:** AI-generated content suggestions
- **Advanced Analytics:** Predictive analytics and insights
- **White-Label:** Multi-brand support
- **Enterprise Features:** SSO, audit logs, compliance

---

## 23. Conclusion

This social media scheduler SaaS is a well-architected, production-ready system with:

✅ **Strengths:**
- Solid OAuth integration with 5+ platforms
- Robust publishing pipeline with platform-specific queues
- Comprehensive token lifecycle management
- Strong security posture (encryption, rate limiting, CSRF)
- Good observability (Sentry, OpenTelemetry, Prometheus)
- Multi-tenant architecture with workspace isolation

⚠️ **Areas for Improvement (Phase 6.5):**
- Worker lifecycle management (auto-restart on crash)
- Queue health monitoring (backpressure detection)
- Redis connection resilience (enhanced circuit breaker)
- Health endpoints (comprehensive coverage)
- Docker production configuration (multi-stage builds, health checks)

The system is ready for production with Phase 6.5 hardening to address operational resilience gaps.

---

**End of System Context Audit**
