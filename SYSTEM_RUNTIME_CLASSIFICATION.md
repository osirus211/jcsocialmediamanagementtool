# System Runtime Classification

**Purpose:** Classify all workers and queues by runtime importance for WorkerManager configuration  
**Source:** SYSTEM_ARCHITECTURE_SNAPSHOT.md + SYSTEM_CONTEXT_AUDIT.md  
**Last Updated:** 2026-03-07

---

## Classification Categories

### Worker Categories
- **CORE_RUNTIME:** Essential for basic SaaS operation (publishing, scheduling, token refresh)
- **FEATURE_RUNTIME:** Required for specific features (analytics, notifications, media)
- **OPTIONAL_RUNTIME:** Nice-to-have operational features (health checks, backups)
- **INACTIVE/LEGACY:** Deprecated or unused workers

### WorkerManager Auto-Start Policy
- **YES:** WorkerManager must start this worker automatically on system boot
- **OPTIONAL:** WorkerManager can start this worker based on configuration flag
- **NO:** WorkerManager should NOT start this worker (manual start only, or deprecated)

---

## SECTION 1 — CORE RUNTIME WORKERS

These workers are CRITICAL for the SaaS to function. Without them, users cannot schedule or publish posts.

| Worker Name | Queue Name | Responsibility | Category | Auto-Start |
|-------------|------------|----------------|----------|------------|
| **SchedulerWorker** | `scheduler-queue` | Polls every 60s for posts with `scheduledAt <= now`, routes to platform queues | CORE_RUNTIME | YES |
| **FacebookPublisherWorker** | `facebook-publish-queue` | Publishes to Facebook Pages via Graph API | CORE_RUNTIME | YES |
| **InstagramPublisherWorker** | `instagram-publish-queue` | Publishes to Instagram Business via Graph API | CORE_RUNTIME | YES |
| **TwitterPublisherWorker** | `twitter-publish-queue` | Publishes to Twitter/X via OAuth 2.0 API | CORE_RUNTIME | YES |
| **LinkedInPublisherWorker** | `linkedin-publish-queue` | Publishes to LinkedIn personal/org pages | CORE_RUNTIME | YES |
| **TikTokPublisherWorker** | `tiktok-publish-queue` | Publishes videos to TikTok Creator accounts | CORE_RUNTIME | YES |
| **TokenRefreshWorker** | `token-refresh-queue` | Polls every 5 minutes for tokens expiring in <15 minutes | CORE_RUNTIME | YES |
| **DistributedTokenRefreshWorker** | `token-refresh-queue` | Event-driven token refresh with distributed locking | CORE_RUNTIME | YES |

### Rationale
- **SchedulerWorker:** Without this, scheduled posts never get queued for publishing
- **Platform Publishers:** Without these, posts cannot be published to social media platforms
- **Token Refresh Workers:** Without these, OAuth tokens expire and publishing fails

### Critical Dependencies
- Redis (for queues and distributed locks)
- MongoDB (for Post, SocialAccount models)
- Platform APIs (Facebook, Instagram, Twitter, LinkedIn, TikTok)

---

## SECTION 2 — FEATURE RUNTIME WORKERS

These workers enable specific features. The SaaS can operate without them, but users lose functionality.

| Worker Name | Queue Name | Responsibility | Category | Auto-Start |
|-------------|------------|----------------|----------|------------|
| **MediaProcessingWorker** | `media-processing-queue` | Uploads and processes media files | FEATURE_RUNTIME | YES |
| **EmailWorker** | `email-queue` | Sends transactional emails via SMTP | FEATURE_RUNTIME | YES |
| **NotificationWorker** | `notification-queue` | Delivers in-app notifications | FEATURE_RUNTIME | OPTIONAL |
| **AnalyticsCollectorWorker** | `analytics-collection-queue` | Fetches post metrics from platforms | FEATURE_RUNTIME | OPTIONAL |

### Rationale
- **MediaProcessingWorker:** Required for posts with images/videos (most posts have media)
- **EmailWorker:** Required for critical notifications (password reset, billing alerts)
- **NotificationWorker:** Nice-to-have for in-app notifications (not critical)
- **AnalyticsCollectorWorker:** Nice-to-have for post analytics (not critical for publishing)

### Impact if Disabled
- **MediaProcessingWorker:** Posts with media will fail to publish
- **EmailWorker:** Users won't receive critical emails (password reset, billing)
- **NotificationWorker:** Users won't see in-app notifications (minor UX degradation)
- **AnalyticsCollectorWorker:** Analytics dashboard will be stale (no real-time impact)

---

## SECTION 3 — OPTIONAL RUNTIME WORKERS

These workers provide operational monitoring and maintenance. The SaaS operates normally without them.

| Worker Name | Queue Name | Responsibility | Category | Auto-Start |
|-------------|------------|----------------|----------|------------|
| **ConnectionHealthCheckWorker** | N/A | Monitors Redis/MongoDB connections (1 hour interval) | OPTIONAL_RUNTIME | OPTIONAL |
| **AccountHealthCheckWorker** | N/A | Scores account health based on token status | OPTIONAL_RUNTIME | OPTIONAL |
| **BackupVerificationWorker** | N/A | Verifies backup integrity | OPTIONAL_RUNTIME | OPTIONAL |

### Rationale
- **ConnectionHealthCheckWorker:** Useful for monitoring, but not required for operation
- **AccountHealthCheckWorker:** Useful for proactive alerts, but not required for publishing
- **BackupVerificationWorker:** Useful for disaster recovery, but not required for operation

### Recommendation
- Start these workers in production for operational visibility
- Disable in development/test environments to reduce resource usage

---

## SECTION 4 — LEGACY OR UNUSED WORKERS

These workers are deprecated or replaced by newer implementations.

| Worker Name | Queue Name | Responsibility | Category | Auto-Start |
|-------------|------------|----------------|----------|------------|
| **PublishingWorker** | `posting-queue` | Legacy post publishing (replaced by platform-specific workers) | INACTIVE/LEGACY | NO |
| **PostPublishingWorker** | `post-publishing-queue` | New publishing pipeline (Phase 4) - may be transitional | INACTIVE/LEGACY | NO |

### Rationale
- **PublishingWorker:** Replaced by platform-specific workers (FacebookPublisherWorker, etc.) in Phase 4
- **PostPublishingWorker:** Transitional worker, may be replaced by direct platform routing

### Migration Status
- **PublishingWorker:** DEPRECATED - Do not use in new deployments
- **PostPublishingWorker:** TRANSITIONAL - Verify if still needed or replaced by SchedulerWorker + platform workers

### Action Required
- Audit codebase to confirm if `PostPublishingWorker` is still in use
- If not used, remove from worker registration
- If used, clarify its role vs. platform-specific workers

---

## SECTION 5 — OPERATIONAL QUEUES

These queues MUST be monitored for health, lag, and backpressure.

| Queue Name | Worker(s) | Monitoring Priority | Lag Threshold | Backpressure Threshold |
|------------|-----------|---------------------|---------------|------------------------|
| `scheduler-queue` | SchedulerWorker | CRITICAL | 5 minutes | 100 jobs |
| `facebook-publish-queue` | FacebookPublisherWorker | CRITICAL | 10 minutes | 500 jobs |
| `instagram-publish-queue` | InstagramPublisherWorker | CRITICAL | 10 minutes | 500 jobs |
| `twitter-publish-queue` | TwitterPublisherWorker | CRITICAL | 10 minutes | 500 jobs |
| `linkedin-publish-queue` | LinkedInPublisherWorker | CRITICAL | 10 minutes | 500 jobs |
| `tiktok-publish-queue` | TikTokPublisherWorker | CRITICAL | 10 minutes | 500 jobs |
| `token-refresh-queue` | TokenRefreshWorker, DistributedTokenRefreshWorker | CRITICAL | 15 minutes | 1000 jobs |
| `media-processing-queue` | MediaProcessingWorker | HIGH | 30 minutes | 1000 jobs |
| `email-queue` | EmailWorker | HIGH | 5 minutes | 500 jobs |
| `notification-queue` | NotificationWorker | MEDIUM | 1 hour | 5000 jobs |
| `analytics-collection-queue` | AnalyticsCollectorWorker | LOW | 24 hours | 10000 jobs |
| `dead-letter-queue` | N/A | CRITICAL | N/A | 100 jobs |

### Monitoring Metrics
- **Queue Lag:** Time between job creation and job processing
- **Queue Depth:** Number of waiting jobs
- **Backpressure:** Queue depth exceeds threshold (indicates worker overload)
- **Stalled Jobs:** Jobs stuck in "active" state beyond lock duration
- **Failed Jobs:** Jobs moved to dead-letter queue

### Alerting Thresholds
- **CRITICAL:** Alert immediately (Slack, PagerDuty)
- **HIGH:** Alert within 15 minutes
- **MEDIUM:** Alert within 1 hour
- **LOW:** Daily digest report

---

## SECTION 6 — NON-OPERATIONAL QUEUES

These queues are for testing, development, or deprecated features.

| Queue Name | Status | Reason |
|------------|--------|--------|
| `posting-queue` | LEGACY | Replaced by platform-specific queues in Phase 4 |
| `post-publishing-queue` | TRANSITIONAL | May be deprecated, needs audit |
| `webhook-ingest-queue` | PARTIAL | Webhook system partially implemented |
| `webhook-processing-queue` | PARTIAL | Webhook system partially implemented |

### Action Required
- **posting-queue:** Remove from production deployment
- **post-publishing-queue:** Audit usage and clarify status
- **webhook-ingest-queue:** Complete webhook implementation or disable
- **webhook-processing-queue:** Complete webhook implementation or disable

---

## SECTION 7 — MINIMAL RUNTIME SYSTEM

### Absolute Minimum for SaaS Operation

**Required Workers (8):**
1. SchedulerWorker
2. FacebookPublisherWorker
3. InstagramPublisherWorker
4. TwitterPublisherWorker
5. LinkedInPublisherWorker
6. TikTokPublisherWorker
7. TokenRefreshWorker
8. DistributedTokenRefreshWorker

**Required Queues (8):**
1. scheduler-queue
2. facebook-publish-queue
3. instagram-publish-queue
4. twitter-publish-queue
5. linkedin-publish-queue
6. tiktok-publish-queue
7. token-refresh-queue
8. dead-letter-queue

**Required Services:**
- Redis (queues, locks, circuit breakers)
- MongoDB (data persistence)
- Platform APIs (Facebook, Instagram, Twitter, LinkedIn, TikTok)

### Recommended Production System

**Core Workers (8):** All minimal runtime workers  
**Feature Workers (2):** MediaProcessingWorker, EmailWorker  
**Optional Workers (3):** ConnectionHealthCheckWorker, AccountHealthCheckWorker, BackupVerificationWorker

**Total Workers:** 13 workers

---

## SECTION 8 — WORKERMANAGER CONFIGURATION

### Recommended Auto-Start Configuration

```typescript
// WorkerManager configuration for production
const workerConfig = {
  // CORE_RUNTIME - Always start
  'scheduler-worker': { enabled: true, maxRestarts: 5, restartDelay: 5000 },
  'facebook-publisher-worker': { enabled: true, maxRestarts: 3, restartDelay: 5000 },
  'instagram-publisher-worker': { enabled: true, maxRestarts: 3, restartDelay: 5000 },
  'twitter-publisher-worker': { enabled: true, maxRestarts: 3, restartDelay: 5000 },
  'linkedin-publisher-worker': { enabled: true, maxRestarts: 3, restartDelay: 5000 },
  'tiktok-publisher-worker': { enabled: true, maxRestarts: 3, restartDelay: 5000 },
  'token-refresh-worker': { enabled: true, maxRestarts: 5, restartDelay: 10000 },
  'distributed-token-refresh-worker': { enabled: true, maxRestarts: 5, restartDelay: 10000 },
  
  // FEATURE_RUNTIME - Start by default
  'media-processing-worker': { enabled: true, maxRestarts: 3, restartDelay: 5000 },
  'email-worker': { enabled: true, maxRestarts: 3, restartDelay: 5000 },
  
  // FEATURE_RUNTIME - Optional (configurable)
  'notification-worker': { enabled: process.env.ENABLE_NOTIFICATIONS !== 'false', maxRestarts: 3, restartDelay: 5000 },
  'analytics-collector-worker': { enabled: process.env.ENABLE_ANALYTICS !== 'false', maxRestarts: 3, restartDelay: 5000 },
  
  // OPTIONAL_RUNTIME - Optional (configurable)
  'connection-health-check-worker': { enabled: process.env.ENABLE_HEALTH_CHECKS !== 'false', maxRestarts: 3, restartDelay: 30000 },
  'account-health-check-worker': { enabled: process.env.ENABLE_HEALTH_CHECKS !== 'false', maxRestarts: 3, restartDelay: 30000 },
  'backup-verification-worker': { enabled: process.env.ENABLE_BACKUPS !== 'false', maxRestarts: 3, restartDelay: 60000 },
  
  // LEGACY - Never start
  'publishing-worker': { enabled: false },
  'post-publishing-worker': { enabled: false }, // Audit first
};
```

### Environment Variable Overrides

```bash
# Disable optional features in development
ENABLE_NOTIFICATIONS=false
ENABLE_ANALYTICS=false
ENABLE_HEALTH_CHECKS=false
ENABLE_BACKUPS=false

# Enable all features in production (default)
ENABLE_NOTIFICATIONS=true
ENABLE_ANALYTICS=true
ENABLE_HEALTH_CHECKS=true
ENABLE_BACKUPS=true
```

---

## SECTION 9 — WORKER DEPENDENCY GRAPH

### Dependency Relationships

```
SchedulerWorker (CORE)
    ↓ (creates jobs for)
    ├── FacebookPublisherWorker (CORE)
    ├── InstagramPublisherWorker (CORE)
    ├── TwitterPublisherWorker (CORE)
    ├── LinkedInPublisherWorker (CORE)
    └── TikTokPublisherWorker (CORE)
        ↓ (depends on)
        TokenRefreshWorker (CORE)
        DistributedTokenRefreshWorker (CORE)
        
Platform Publishers (CORE)
    ↓ (may create jobs for)
    MediaProcessingWorker (FEATURE)
    
EmailWorker (FEATURE)
    ↓ (triggered by)
    - User actions (password reset, billing)
    - System events (token expiration, publishing failures)
    
NotificationWorker (FEATURE)
    ↓ (triggered by)
    - User actions (post published, analytics ready)
    - System events (account health warnings)
    
AnalyticsCollectorWorker (FEATURE)
    ↓ (triggered by)
    - Post published events
    - Scheduled analytics refresh
    
ConnectionHealthCheckWorker (OPTIONAL)
    ↓ (monitors)
    - Redis connection
    - MongoDB connection
    
AccountHealthCheckWorker (OPTIONAL)
    ↓ (monitors)
    - SocialAccount token status
    - Platform API health
    
BackupVerificationWorker (OPTIONAL)
    ↓ (verifies)
    - MongoDB backup integrity
```

### Startup Order Recommendation

1. **Phase 1 - Core Infrastructure (CRITICAL):**
   - TokenRefreshWorker
   - DistributedTokenRefreshWorker
   - SchedulerWorker

2. **Phase 2 - Platform Publishers (CRITICAL):**
   - FacebookPublisherWorker
   - InstagramPublisherWorker
   - TwitterPublisherWorker
   - LinkedInPublisherWorker
   - TikTokPublisherWorker

3. **Phase 3 - Feature Workers (HIGH PRIORITY):**
   - MediaProcessingWorker
   - EmailWorker

4. **Phase 4 - Optional Workers (LOW PRIORITY):**
   - NotificationWorker
   - AnalyticsCollectorWorker
   - ConnectionHealthCheckWorker
   - AccountHealthCheckWorker
   - BackupVerificationWorker

### Shutdown Order Recommendation

Reverse of startup order to ensure graceful degradation:

1. **Phase 1 - Optional Workers:** Stop health checks and analytics first
2. **Phase 2 - Feature Workers:** Stop media and email workers
3. **Phase 3 - Platform Publishers:** Stop publishing workers
4. **Phase 4 - Core Infrastructure:** Stop scheduler and token refresh last

---

## SECTION 10 — PRODUCTION DEPLOYMENT CHECKLIST

### Pre-Deployment Verification

- [ ] Confirm all CORE_RUNTIME workers are enabled in WorkerManager config
- [ ] Verify Redis connection is healthy
- [ ] Verify MongoDB connection is healthy
- [ ] Confirm platform API credentials are valid
- [ ] Test token refresh for all platforms
- [ ] Verify queue monitoring is configured
- [ ] Confirm alerting thresholds are set
- [ ] Test graceful shutdown for all workers
- [ ] Verify worker auto-restart on crash
- [ ] Confirm dead-letter queue monitoring is active

### Post-Deployment Monitoring

- [ ] Monitor queue lag for all operational queues
- [ ] Monitor worker heartbeats
- [ ] Monitor worker restart counts
- [ ] Monitor dead-letter queue depth
- [ ] Monitor platform API error rates
- [ ] Monitor token refresh success rates
- [ ] Monitor publishing success rates
- [ ] Monitor Redis connection health
- [ ] Monitor MongoDB connection health

---

## SECTION 11 — SUMMARY

### Critical Workers (8)
Must be running for SaaS to function:
- SchedulerWorker
- 5x Platform Publishers (Facebook, Instagram, Twitter, LinkedIn, TikTok)
- 2x Token Refresh Workers

### Recommended Workers (13)
Core + Feature workers for full functionality:
- 8x Critical Workers
- MediaProcessingWorker
- EmailWorker
- NotificationWorker (optional)
- AnalyticsCollectorWorker (optional)
- ConnectionHealthCheckWorker (optional)

### Legacy Workers (2)
Do not start in production:
- PublishingWorker (deprecated)
- PostPublishingWorker (audit required)

### Monitoring Priority
- **CRITICAL:** scheduler-queue, platform publish queues, token-refresh-queue, dead-letter-queue
- **HIGH:** media-processing-queue, email-queue
- **MEDIUM:** notification-queue
- **LOW:** analytics-collection-queue

---

**End of Runtime Classification**
