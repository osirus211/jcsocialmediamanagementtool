# Phase 2: Event-Driven Platform Integration
## Refined Architecture Plan (Version 2)

**Date:** 2026-03-04  
**Status:** Architecture Refinement - Ready for Review  
**Version:** 2.0 (Incorporates Architecture Adjustments 1-3)

---

## Table of Contents
1. [Architecture Adjustments Summary](#architecture-adjustments-summary)
2. [Unified Webhook Controller](#unified-webhook-controller)
3. [Provider Registry Design](#provider-registry-design)
4. [Webhook Provider Interface](#webhook-provider-interface)
5. [Two-Stage Queue Architecture](#two-stage-queue-architecture)
6. [Event Normalization Strategy](#event-normalization-strategy)
7. [Implementation Plan](#implementation-plan)
8. [File Structure](#file-structure)

---

## Architecture Adjustments Summary

### Adjustment 1: Unified Webhook Controller
**Before:** Multiple endpoints (`/webhooks/facebook`, `/webhooks/linkedin`, etc.)  
**After:** Single unified endpoint (`/webhooks/:provider`)

**Benefits:**
- Reduced code duplication
- Consistent error handling
- Easier to add new providers
- Centralized monitoring and logging

### Adjustment 2: Two-Stage Queue Pipeline
**Before:** Single queue (`webhook-events-queue`)  
**After:** Two-stage pipeline (`webhook-ingest-queue` → `webhook-processing-queue`)

**Benefits:**
- Fast ingestion (Stage 1) prevents webhook timeouts
- Decoupled business logic (Stage 2) from ingestion
- Better failure isolation
- Independent scaling of ingestion vs processing

### Adjustment 3: WebhookProvider Interface
**Before:** Service-based approach with multiple methods  
**After:** Interface-driven provider pattern

**Benefits:**
- Enforced contract for all providers
- Type-safe provider implementations
- Easy to test and mock
- Clear separation of concerns

---

## Unified Webhook Controller

### Endpoint Structure

```
POST /api/v1/webhooks/:provider
```

**Supported Providers:**
- `facebook`
- `linkedin`
- `twitter`
- `instagram`
- `youtube`
- `tiktok`
- `threads`

### Controller Responsibilities

The unified `WebhookController` handles:
1. **Provider Resolution** - Map `:provider` param to provider implementation
2. **Signature Verification** - Delegate to provider's `verifySignature()`
3. **Event Extraction** - Delegate to provider's `extractEvent()`
4. **Idempotency Check** - Check Redis for duplicate events
5. **Stage 1 Enqueue** - Push to `webhook-ingest-queue`
6. **Audit Logging** - Log webhook receipt
7. **Response** - Return 200 OK immediately

### Request Flow

```
POST /api/v1/webhooks/facebook
    ↓
WebhookController.handleWebhook(req, res)
    ↓
1. Resolve provider: registry.getProvider('facebook')
    ↓
2. Verify signature: provider.verifySignature(headers, rawBody)
    ↓
3. Extract event: provider.extractEvent(payload)
    ↓
4. Check idempotency: deduplicationService.isDuplicate(provider, eventId)
    ↓
5. Enqueue Stage 1: ingestQueue.add(event)
    ↓
6. Audit log: AuditLog.log({ action: 'webhook.received', ... })
    ↓
7. Return 200 OK
```

### Controller Implementation Structure

```typescript
export class WebhookController {
  constructor(
    private providerRegistry: WebhookProviderRegistry,
    private deduplicationService: WebhookDeduplicationService,
    private ingestQueue: WebhookIngestQueue,
    private auditLog: typeof AuditLog
  ) {}

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const provider = req.params.provider;
    
    // 1. Resolve provider
    const webhookProvider = this.providerRegistry.getProvider(provider);
    
    // 2. Verify signature
    const isValid = await webhookProvider.verifySignature(
      req.headers,
      req.rawBody
    );
    
    // 3. Extract event
    const event = await webhookProvider.extractEvent(req.body);
    
    // 4. Check idempotency
    const isDuplicate = await this.deduplicationService.isDuplicate(
      provider,
      event.id
    );
    
    // 5. Enqueue to Stage 1
    await this.ingestQueue.add(event);
    
    // 6. Audit log
    await this.auditLog.log({
      action: 'webhook.received',
      ...
    });
    
    // 7. Return 200 OK
    res.status(200).json({ received: true, eventId: event.id });
  }
}
```

---


## Provider Registry Design

### Registry Purpose

The `WebhookProviderRegistry` is a centralized registry that:
- Maps provider names to provider implementations
- Validates provider existence
- Provides type-safe provider access
- Enables dynamic provider registration

### Registry Interface

```typescript
interface IWebhookProviderRegistry {
  register(name: string, provider: IWebhookProvider): void;
  getProvider(name: string): IWebhookProvider;
  hasProvider(name: string): boolean;
  listProviders(): string[];
}
```

### Registry Implementation Structure

```typescript
export class WebhookProviderRegistry implements IWebhookProviderRegistry {
  private providers: Map<string, IWebhookProvider> = new Map();

  constructor() {
    // Auto-register all providers on initialization
    this.registerDefaultProviders();
  }

  private registerDefaultProviders(): void {
    this.register('facebook', new FacebookWebhookProvider());
    this.register('linkedin', new LinkedInWebhookProvider());
    this.register('twitter', new TwitterWebhookProvider());
    this.register('instagram', new InstagramWebhookProvider());
    this.register('youtube', new YouTubeWebhookProvider());
    this.register('tiktok', new TikTokWebhookProvider());
    this.register('threads', new ThreadsWebhookProvider());
  }

  register(name: string, provider: IWebhookProvider): void {
    if (this.providers.has(name)) {
      throw new Error(`Provider ${name} already registered`);
    }
    this.providers.set(name, provider);
    logger.info('Webhook provider registered', { provider: name });
  }

  getProvider(name: string): IWebhookProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new WebhookProviderNotFoundError(name);
    }
    return provider;
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
```

### Provider Registration Flow

```
Application Startup
    ↓
WebhookProviderRegistry.constructor()
    ↓
registerDefaultProviders()
    ↓
register('facebook', new FacebookWebhookProvider())
register('linkedin', new LinkedInWebhookProvider())
register('twitter', new TwitterWebhookProvider())
register('instagram', new InstagramWebhookProvider())
register('youtube', new YouTubeWebhookProvider())
register('tiktok', new TikTokWebhookProvider())
register('threads', new ThreadsWebhookProvider())
    ↓
Registry Ready
```

### Provider Lookup Flow

```
Request: POST /api/v1/webhooks/facebook
    ↓
WebhookController.handleWebhook(req, res)
    ↓
const provider = registry.getProvider('facebook')
    ↓
if (!provider) → throw WebhookProviderNotFoundError
    ↓
return FacebookWebhookProvider instance
```

### Error Handling

```typescript
export class WebhookProviderNotFoundError extends Error {
  constructor(provider: string) {
    super(`Webhook provider not found: ${provider}`);
    this.name = 'WebhookProviderNotFoundError';
  }
}

// Usage in controller
try {
  const provider = registry.getProvider(req.params.provider);
} catch (error) {
  if (error instanceof WebhookProviderNotFoundError) {
    return res.status(404).json({
      error: 'Provider not found',
      provider: req.params.provider,
      availableProviders: registry.listProviders()
    });
  }
  throw error;
}
```

---


## Webhook Provider Interface

### Interface Definition

```typescript
/**
 * Webhook Provider Interface
 * 
 * All webhook providers must implement this interface to ensure
 * consistent behavior across different platforms.
 */
export interface IWebhookProvider {
  /**
   * Provider name (e.g., 'facebook', 'linkedin', 'twitter')
   */
  readonly name: string;

  /**
   * Verify webhook signature
   * 
   * @param headers - Request headers containing signature
   * @param rawBody - Raw request body (Buffer)
   * @returns true if signature is valid, false otherwise
   * @throws WebhookSignatureError if signature is invalid
   */
  verifySignature(headers: IncomingHttpHeaders, rawBody: Buffer): Promise<boolean>;

  /**
   * Extract event from webhook payload
   * 
   * @param payload - Parsed webhook payload
   * @returns Extracted event with id, type, and data
   * @throws WebhookPayloadError if payload is invalid
   */
  extractEvent(payload: any): Promise<WebhookEvent>;

  /**
   * Normalize event to standard format
   * 
   * Converts platform-specific event format to our internal format
   * 
   * @param event - Raw webhook event
   * @returns Normalized event
   */
  normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent>;

  /**
   * Handle platform-specific challenges (e.g., Twitter CRC)
   * 
   * @param req - Express request
   * @param res - Express response
   * @returns true if challenge was handled, false otherwise
   */
  handleChallenge?(req: Request, res: Response): Promise<boolean>;
}
```

### Supporting Types

```typescript
/**
 * Raw webhook event extracted from platform payload
 */
export interface WebhookEvent {
  id: string;                    // Platform event ID
  type: string;                  // Platform event type
  timestamp: Date;               // Event timestamp
  data: any;                     // Platform-specific data
}

/**
 * Normalized webhook event (internal format)
 */
export interface NormalizedWebhookEvent {
  eventId: string;               // Unique event ID
  provider: string;              // Provider name
  eventType: WebhookEventType;   // Normalized event type
  timestamp: Date;               // Event timestamp
  accountId?: string;            // Social account ID (if applicable)
  userId?: string;               // User ID (if applicable)
  workspaceId?: string;          // Workspace ID (if applicable)
  data: {
    raw: any;                    // Original platform data
    normalized: any;             // Normalized data
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    receivedAt: Date;
    correlationId: string;
  };
}

/**
 * Normalized event types (internal)
 */
export enum WebhookEventType {
  TOKEN_REVOKED = 'token_revoked',
  TOKEN_EXPIRED = 'token_expired',
  PERMISSION_CHANGED = 'permission_changed',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
  ACCOUNT_DELETED = 'account_deleted',
  ACCOUNT_SUSPENDED = 'account_suspended',
  PROFILE_UPDATED = 'profile_updated',
  MEDIA_PUBLISHED = 'media_published',
  MEDIA_DELETED = 'media_deleted',
  COMMENT_RECEIVED = 'comment_received',
  MESSAGE_RECEIVED = 'message_received',
  UNKNOWN = 'unknown',
}
```

### Provider Implementation Example: Facebook

```typescript
export class FacebookWebhookProvider implements IWebhookProvider {
  readonly name = 'facebook';

  async verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer
  ): Promise<boolean> {
    const signature = headers['x-hub-signature-256'] as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing signature header');
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.FACEBOOK_APP_SECRET!)
      .update(rawBody)
      .digest('hex');

    const isValid = signature === `sha256=${expectedSignature}`;
    
    if (!isValid) {
      throw new WebhookSignatureError('Invalid signature');
    }

    return true;
  }

  async extractEvent(payload: any): Promise<WebhookEvent> {
    // Facebook webhook structure:
    // { object: 'user', entry: [{ id: '...', changes: [...] }] }
    
    if (!payload.entry || !Array.isArray(payload.entry)) {
      throw new WebhookPayloadError('Invalid Facebook webhook payload');
    }

    const entry = payload.entry[0];
    const change = entry.changes?.[0];

    return {
      id: entry.id || `fb_${Date.now()}`,
      type: change?.field || 'unknown',
      timestamp: new Date(entry.time * 1000),
      data: payload,
    };
  }

  async normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent> {
    // Map Facebook event types to our internal types
    const eventTypeMap: Record<string, WebhookEventType> = {
      'permissions': WebhookEventType.PERMISSION_CHANGED,
      'deauthorize': WebhookEventType.TOKEN_REVOKED,
      'delete': WebhookEventType.ACCOUNT_DELETED,
      'feed': WebhookEventType.MEDIA_PUBLISHED,
    };

    const normalizedType = eventTypeMap[event.type] || WebhookEventType.UNKNOWN;

    return {
      eventId: event.id,
      provider: this.name,
      eventType: normalizedType,
      timestamp: event.timestamp,
      data: {
        raw: event.data,
        normalized: this.normalizeData(event.data, normalizedType),
      },
      metadata: {
        receivedAt: new Date(),
        correlationId: generateCorrelationId(),
      },
    };
  }

  private normalizeData(data: any, eventType: WebhookEventType): any {
    // Platform-specific normalization logic
    switch (eventType) {
      case WebhookEventType.TOKEN_REVOKED:
        return {
          userId: data.entry?.[0]?.id,
          reason: 'user_deauthorized',
        };
      case WebhookEventType.PERMISSION_CHANGED:
        return {
          userId: data.entry?.[0]?.id,
          permissions: data.entry?.[0]?.changes?.[0]?.value,
        };
      default:
        return data;
    }
  }
}
```

### Provider Implementation Example: Twitter

```typescript
export class TwitterWebhookProvider implements IWebhookProvider {
  readonly name = 'twitter';

  async verifySignature(
    headers: IncomingHttpHeaders,
    rawBody: Buffer
  ): Promise<boolean> {
    const signature = headers['x-twitter-webhooks-signature'] as string;
    
    if (!signature) {
      throw new WebhookSignatureError('Missing signature header');
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.TWITTER_CONSUMER_SECRET!)
      .update(rawBody)
      .digest('base64');

    const isValid = signature === `sha256=${expectedSignature}`;
    
    if (!isValid) {
      throw new WebhookSignatureError('Invalid signature');
    }

    return true;
  }

  async extractEvent(payload: any): Promise<WebhookEvent> {
    // Twitter webhook structure varies by event type
    let eventType = 'unknown';
    let eventId = `tw_${Date.now()}`;

    if (payload.revoke) {
      eventType = 'revoke';
      eventId = payload.revoke.source.user_id;
    } else if (payload.user_event) {
      eventType = payload.user_event;
    }

    return {
      id: eventId,
      type: eventType,
      timestamp: new Date(),
      data: payload,
    };
  }

  async normalizeEvent(event: WebhookEvent): Promise<NormalizedWebhookEvent> {
    const eventTypeMap: Record<string, WebhookEventType> = {
      'revoke': WebhookEventType.TOKEN_REVOKED,
      'account_suspended': WebhookEventType.ACCOUNT_SUSPENDED,
      'profile_update': WebhookEventType.PROFILE_UPDATED,
    };

    const normalizedType = eventTypeMap[event.type] || WebhookEventType.UNKNOWN;

    return {
      eventId: event.id,
      provider: this.name,
      eventType: normalizedType,
      timestamp: event.timestamp,
      data: {
        raw: event.data,
        normalized: this.normalizeData(event.data, normalizedType),
      },
      metadata: {
        receivedAt: new Date(),
        correlationId: generateCorrelationId(),
      },
    };
  }

  /**
   * Handle Twitter CRC challenge
   */
  async handleChallenge(req: Request, res: Response): Promise<boolean> {
    const crcToken = req.query.crc_token as string;
    
    if (!crcToken) {
      return false;
    }

    const responseToken = crypto
      .createHmac('sha256', process.env.TWITTER_CONSUMER_SECRET!)
      .update(crcToken)
      .digest('base64');

    res.json({ response_token: `sha256=${responseToken}` });
    return true;
  }

  private normalizeData(data: any, eventType: WebhookEventType): any {
    switch (eventType) {
      case WebhookEventType.TOKEN_REVOKED:
        return {
          userId: data.revoke?.source?.user_id,
          reason: 'user_revoked',
        };
      default:
        return data;
    }
  }
}
```

### Error Classes

```typescript
export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export class WebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookPayloadError';
  }
}
```

---


## Two-Stage Queue Architecture

### Overview

The two-stage queue pipeline separates webhook ingestion from business logic processing:

**Stage 1: webhook-ingest-queue**
- Fast ingestion and storage
- Minimal processing
- Quick response to platform

**Stage 2: webhook-processing-queue**
- Business logic execution
- Database updates
- Notifications
- Complex operations

### Stage 1: Webhook Ingest Queue

#### Purpose
- Accept webhook events quickly (< 100ms)
- Store events safely in Redis
- Prevent webhook timeouts
- Enable fast 200 OK response

#### Queue Configuration

```typescript
{
  name: 'webhook-ingest-queue',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 5s, 25s
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // 24 hours
      count: 5000,
    },
  },
}
```

#### Worker Configuration

```typescript
{
  concurrency: 20,               // High concurrency for fast ingestion
  limiter: {
    max: 1000,                   // Max 1000 jobs per minute
    duration: 60000,
  },
  lockDuration: 10000,           // 10 second lock (fast processing)
  lockRenewTime: 5000,
}
```

#### Job Structure

```typescript
interface WebhookIngestJob {
  eventId: string;
  provider: string;
  rawEvent: WebhookEvent;
  normalizedEvent: NormalizedWebhookEvent;
  metadata: {
    receivedAt: Date;
    correlationId: string;
    ipAddress?: string;
    userAgent?: string;
  };
}
```

#### Worker Responsibilities

The ingest worker:
1. **Validate Event** - Ensure event structure is valid
2. **Store Raw Event** - Save to audit log
3. **Enqueue Stage 2** - Push to processing queue
4. **Mark Complete** - Job done

```typescript
async function processIngestJob(job: Job<WebhookIngestJob>): Promise<void> {
  const { eventId, provider, normalizedEvent } = job.data;

  logger.info('Processing webhook ingest', {
    eventId,
    provider,
    eventType: normalizedEvent.eventType,
  });

  // 1. Store in audit log
  await AuditLog.log({
    userId: SYSTEM_USER_ID,
    workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
    action: 'webhook.ingested',
    entityType: 'webhook_event',
    entityId: eventId,
    metadata: {
      provider,
      eventType: normalizedEvent.eventType,
      payload: normalizedEvent.data.raw,
      correlationId: normalizedEvent.metadata.correlationId,
    },
  });

  // 2. Enqueue to Stage 2 (processing queue)
  await processingQueue.add('process-webhook-event', {
    eventId,
    provider,
    normalizedEvent,
  }, {
    jobId: `webhook-process:${provider}:${eventId}`,
    priority: getPriority(normalizedEvent.eventType),
  });

  logger.info('Webhook ingested and queued for processing', {
    eventId,
    provider,
    eventType: normalizedEvent.eventType,
  });
}
```

### Stage 2: Webhook Processing Queue

#### Purpose
- Execute business logic
- Update database (SocialAccount, User, etc.)
- Trigger token refresh if needed
- Send notifications
- Handle complex operations

#### Queue Configuration

```typescript
{
  name: 'webhook-processing-queue',
  defaultJobOptions: {
    attempts: 5,                 // More retries for business logic
    backoff: {
      type: 'exponential',
      delay: 5000,               // 5s, 25s, 125s, 625s, 3125s
    },
    removeOnComplete: {
      age: 86400,                // 24 hours
      count: 10000,
    },
    removeOnFail: {
      age: 604800,               // 7 days
      count: 10000,
    },
  },
}
```

#### Worker Configuration

```typescript
{
  concurrency: 10,               // Lower concurrency for complex processing
  limiter: {
    max: 100,                    // Max 100 jobs per minute
    duration: 60000,
  },
  lockDuration: 60000,           // 60 second lock (complex processing)
  lockRenewTime: 30000,
}
```

#### Job Structure

```typescript
interface WebhookProcessingJob {
  eventId: string;
  provider: string;
  normalizedEvent: NormalizedWebhookEvent;
}
```

#### Worker Responsibilities

The processing worker:
1. **Route Event** - Determine handler based on event type
2. **Execute Business Logic** - Process event
3. **Update Database** - Update SocialAccount, User, etc.
4. **Trigger Actions** - Token refresh, notifications, etc.
5. **Audit Log** - Log processing result

```typescript
async function processWebhookEvent(job: Job<WebhookProcessingJob>): Promise<void> {
  const { eventId, provider, normalizedEvent } = job.data;

  logger.info('Processing webhook event', {
    eventId,
    provider,
    eventType: normalizedEvent.eventType,
  });

  try {
    // Route to appropriate handler
    const handler = getEventHandler(normalizedEvent.eventType);
    await handler.handle(normalizedEvent);

    // Audit log success
    await AuditLog.log({
      userId: SYSTEM_USER_ID,
      workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
      action: 'webhook.processed',
      entityType: 'webhook_event',
      entityId: eventId,
      metadata: {
        provider,
        eventType: normalizedEvent.eventType,
        status: 'success',
      },
    });

    logger.info('Webhook event processed successfully', {
      eventId,
      provider,
      eventType: normalizedEvent.eventType,
    });
  } catch (error: any) {
    logger.error('Webhook event processing failed', {
      eventId,
      provider,
      eventType: normalizedEvent.eventType,
      error: error.message,
      stack: error.stack,
    });

    // Audit log failure
    await AuditLog.log({
      userId: SYSTEM_USER_ID,
      workspaceId: normalizedEvent.workspaceId || SYSTEM_WORKSPACE_ID,
      action: 'webhook.failed',
      entityType: 'webhook_event',
      entityId: eventId,
      metadata: {
        provider,
        eventType: normalizedEvent.eventType,
        status: 'failed',
        error: error.message,
      },
    });

    throw error; // Re-throw for BullMQ retry
  }
}
```

### Event Priority

Different event types have different priorities:

```typescript
function getPriority(eventType: WebhookEventType): number {
  const priorityMap: Record<WebhookEventType, number> = {
    [WebhookEventType.TOKEN_REVOKED]: 1,           // Highest priority
    [WebhookEventType.TOKEN_EXPIRED]: 1,
    [WebhookEventType.ACCOUNT_DISCONNECTED]: 2,
    [WebhookEventType.ACCOUNT_DELETED]: 2,
    [WebhookEventType.ACCOUNT_SUSPENDED]: 2,
    [WebhookEventType.PERMISSION_CHANGED]: 3,
    [WebhookEventType.PROFILE_UPDATED]: 4,
    [WebhookEventType.MEDIA_PUBLISHED]: 5,
    [WebhookEventType.MEDIA_DELETED]: 5,
    [WebhookEventType.COMMENT_RECEIVED]: 6,
    [WebhookEventType.MESSAGE_RECEIVED]: 6,
    [WebhookEventType.UNKNOWN]: 10,                // Lowest priority
  };

  return priorityMap[eventType] || 10;
}
```

### Queue Flow Diagram

```
Platform Webhook
    ↓
WebhookController
    ↓
Signature Verification
    ↓
Event Extraction & Normalization
    ↓
Idempotency Check
    ↓
┌─────────────────────────────────────────┐
│  STAGE 1: webhook-ingest-queue          │
│  • Fast ingestion (< 100ms)             │
│  • Store in audit log                   │
│  • Enqueue to Stage 2                   │
│  • High concurrency (20 workers)        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  STAGE 2: webhook-processing-queue      │
│  • Execute business logic               │
│  • Update database                      │
│  • Trigger actions                      │
│  • Send notifications                   │
│  • Lower concurrency (10 workers)       │
└─────────────────────────────────────────┘
```

### Benefits of Two-Stage Pipeline

1. **Fast Response:** Stage 1 ensures quick 200 OK response (< 100ms)
2. **Failure Isolation:** Stage 1 failures don't affect Stage 2
3. **Independent Scaling:** Scale ingestion and processing independently
4. **Better Monitoring:** Separate metrics for ingestion vs processing
5. **Retry Flexibility:** Different retry strategies per stage
6. **Priority Handling:** Stage 2 can prioritize critical events

---


## Event Normalization Strategy

### Purpose

Event normalization converts platform-specific webhook formats into a unified internal format, enabling:
- Consistent event processing logic
- Platform-agnostic business rules
- Easier testing and debugging
- Simplified event routing

### Normalization Flow

```
Platform-Specific Event
    ↓
Provider.extractEvent()
    ↓
Raw WebhookEvent { id, type, timestamp, data }
    ↓
Provider.normalizeEvent()
    ↓
NormalizedWebhookEvent { eventId, provider, eventType, ... }
```

### Platform Event Mapping

#### Facebook Event Mapping

```typescript
// Facebook → Internal
{
  'permissions': WebhookEventType.PERMISSION_CHANGED,
  'deauthorize': WebhookEventType.TOKEN_REVOKED,
  'delete': WebhookEventType.ACCOUNT_DELETED,
  'feed': WebhookEventType.MEDIA_PUBLISHED,
  'comments': WebhookEventType.COMMENT_RECEIVED,
}
```

#### LinkedIn Event Mapping

```typescript
// LinkedIn → Internal
{
  'TOKEN_REVOKED': WebhookEventType.TOKEN_REVOKED,
  'MEMBER_PROFILE_CHANGED': WebhookEventType.PROFILE_UPDATED,
  'SHARE_CREATED': WebhookEventType.MEDIA_PUBLISHED,
}
```

#### Twitter Event Mapping

```typescript
// Twitter → Internal
{
  'revoke': WebhookEventType.TOKEN_REVOKED,
  'account_suspended': WebhookEventType.ACCOUNT_SUSPENDED,
  'profile_update': WebhookEventType.PROFILE_UPDATED,
  'tweet_create': WebhookEventType.MEDIA_PUBLISHED,
  'tweet_delete': WebhookEventType.MEDIA_DELETED,
}
```

### Normalization Examples

#### Example 1: Facebook Token Revocation

**Input (Platform-Specific):**
```json
{
  "object": "user",
  "entry": [{
    "id": "123456789",
    "time": 1709510400,
    "changes": [{
      "field": "deauthorize",
      "value": {
        "user_id": "123456789"
      }
    }]
  }]
}
```

**Output (Normalized):**
```json
{
  "eventId": "123456789",
  "provider": "facebook",
  "eventType": "token_revoked",
  "timestamp": "2024-03-04T00:00:00.000Z",
  "accountId": "123456789",
  "data": {
    "raw": { /* original payload */ },
    "normalized": {
      "userId": "123456789",
      "reason": "user_deauthorized"
    }
  },
  "metadata": {
    "receivedAt": "2024-03-04T00:00:01.000Z",
    "correlationId": "uuid-123"
  }
}
```

#### Example 2: Twitter Account Suspension

**Input (Platform-Specific):**
```json
{
  "user_event": "account_suspended",
  "for_user_id": "987654321",
  "user": {
    "id": "987654321",
    "screen_name": "example_user"
  }
}
```

**Output (Normalized):**
```json
{
  "eventId": "tw_987654321_1709510400",
  "provider": "twitter",
  "eventType": "account_suspended",
  "timestamp": "2024-03-04T00:00:00.000Z",
  "accountId": "987654321",
  "data": {
    "raw": { /* original payload */ },
    "normalized": {
      "userId": "987654321",
      "screenName": "example_user",
      "reason": "platform_suspension"
    }
  },
  "metadata": {
    "receivedAt": "2024-03-04T00:00:01.000Z",
    "correlationId": "uuid-456"
  }
}
```

### Account ID Resolution

Each provider must implement logic to extract the relevant account ID:

```typescript
abstract class BaseWebhookProvider implements IWebhookProvider {
  /**
   * Extract account ID from normalized event
   * Used to lookup SocialAccount in database
   */
  protected extractAccountId(event: WebhookEvent): string | undefined {
    // Override in subclass
    return undefined;
  }

  /**
   * Extract workspace ID from normalized event
   * Used for multi-tenant isolation
   */
  protected async extractWorkspaceId(accountId: string): Promise<string | undefined> {
    if (!accountId) return undefined;

    // Lookup SocialAccount to get workspaceId
    const account = await SocialAccount.findOne({
      provider: this.name,
      providerUserId: accountId,
    });

    return account?.workspaceId?.toString();
  }
}
```

### Data Normalization Patterns

#### Pattern 1: User/Account Identification

```typescript
normalized: {
  userId: string;           // Platform user ID
  accountId: string;        // Our SocialAccount ID
  workspaceId: string;      // Our Workspace ID
}
```

#### Pattern 2: Token Events

```typescript
normalized: {
  userId: string;
  reason: 'user_revoked' | 'expired' | 'platform_revoked';
  revokedAt: Date;
  scopes?: string[];        // Affected scopes
}
```

#### Pattern 3: Permission Events

```typescript
normalized: {
  userId: string;
  addedPermissions: string[];
  removedPermissions: string[];
  currentPermissions: string[];
}
```

#### Pattern 4: Media Events

```typescript
normalized: {
  userId: string;
  mediaId: string;          // Platform media ID
  mediaType: 'post' | 'video' | 'image' | 'story';
  action: 'published' | 'deleted' | 'updated';
  url?: string;
}
```

### Normalization Validation

Each normalized event must pass validation:

```typescript
function validateNormalizedEvent(event: NormalizedWebhookEvent): void {
  // Required fields
  if (!event.eventId) throw new Error('Missing eventId');
  if (!event.provider) throw new Error('Missing provider');
  if (!event.eventType) throw new Error('Missing eventType');
  if (!event.timestamp) throw new Error('Missing timestamp');

  // Valid event type
  if (!Object.values(WebhookEventType).includes(event.eventType)) {
    throw new Error(`Invalid eventType: ${event.eventType}`);
  }

  // Valid timestamp
  if (!(event.timestamp instanceof Date)) {
    throw new Error('Invalid timestamp');
  }

  // Metadata required
  if (!event.metadata?.correlationId) {
    throw new Error('Missing correlationId');
  }
}
```

---


## Implementation Plan

### Phase 2.1: Core Infrastructure

#### Step 1: Webhook Provider Interface & Types
- [ ] Create `src/types/webhook.types.ts`
  - Define `IWebhookProvider` interface
  - Define `WebhookEvent` type
  - Define `NormalizedWebhookEvent` type
  - Define `WebhookEventType` enum
  - Define error classes

#### Step 2: Base Provider Class
- [ ] Create `src/providers/webhooks/BaseWebhookProvider.ts`
  - Implement common functionality
  - Account ID extraction
  - Workspace ID resolution
  - Validation helpers

#### Step 3: Provider Implementations
- [ ] Create `src/providers/webhooks/FacebookWebhookProvider.ts`
- [ ] Create `src/providers/webhooks/LinkedInWebhookProvider.ts`
- [ ] Create `src/providers/webhooks/TwitterWebhookProvider.ts`
- [ ] Create `src/providers/webhooks/InstagramWebhookProvider.ts`
- [ ] Create `src/providers/webhooks/YouTubeWebhookProvider.ts`
- [ ] Create `src/providers/webhooks/TikTokWebhookProvider.ts`
- [ ] Create `src/providers/webhooks/ThreadsWebhookProvider.ts`

#### Step 4: Provider Registry
- [ ] Create `src/providers/webhooks/WebhookProviderRegistry.ts`
  - Implement registry pattern
  - Auto-register providers
  - Provider lookup
  - Error handling

#### Step 5: Deduplication Service
- [ ] Create `src/services/WebhookDeduplicationService.ts`
  - Redis-based deduplication
  - Atomic operations
  - TTL management

#### Step 6: Queue Setup
- [ ] Create `src/queue/WebhookIngestQueue.ts`
  - Configure Stage 1 queue
  - Define job structure
  - Implement worker
- [ ] Create `src/queue/WebhookProcessingQueue.ts`
  - Configure Stage 2 queue
  - Define job structure
  - Implement worker (Phase 3)

#### Step 7: Unified Webhook Controller
- [ ] Create `src/controllers/WebhookController.ts`
  - Implement unified endpoint handler
  - Provider resolution
  - Signature verification
  - Event extraction & normalization
  - Idempotency check
  - Queue enqueueing
  - Audit logging

#### Step 8: Routes
- [ ] Create `src/routes/v1/webhook.routes.ts`
  - Define unified route: `POST /webhooks/:provider`
  - Add raw body parser middleware
  - Register routes

#### Step 9: Middleware
- [ ] Create `src/middleware/rawBodyParser.ts`
  - Preserve raw body for signature verification
- [ ] Create `src/middleware/webhookAuth.ts`
  - Provider-based authentication

#### Step 10: Environment Configuration
- [ ] Add webhook secrets to `.env`
- [ ] Validate required environment variables
- [ ] Document configuration

#### Step 11: Testing
- [ ] Unit tests for each provider
- [ ] Unit tests for registry
- [ ] Unit tests for deduplication
- [ ] Integration tests for unified endpoint
- [ ] Mock webhook payloads

#### Step 12: Documentation
- [ ] API documentation
- [ ] Provider implementation guide
- [ ] Testing guide
- [ ] Troubleshooting guide

---

## File Structure

```
apps/backend/src/
├── types/
│   └── webhook.types.ts                      # NEW - Interface & types
│
├── providers/
│   └── webhooks/
│       ├── BaseWebhookProvider.ts            # NEW - Base class
│       ├── FacebookWebhookProvider.ts        # NEW
│       ├── LinkedInWebhookProvider.ts        # NEW
│       ├── TwitterWebhookProvider.ts         # NEW
│       ├── InstagramWebhookProvider.ts       # NEW
│       ├── YouTubeWebhookProvider.ts         # NEW
│       ├── TikTokWebhookProvider.ts          # NEW
│       ├── ThreadsWebhookProvider.ts         # NEW
│       ├── WebhookProviderRegistry.ts        # NEW - Registry
│       └── index.ts                          # NEW - Exports
│
├── services/
│   └── WebhookDeduplicationService.ts        # NEW
│
├── queue/
│   ├── WebhookIngestQueue.ts                # NEW - Stage 1
│   └── WebhookProcessingQueue.ts            # NEW - Stage 2
│
├── controllers/
│   └── WebhookController.ts                  # NEW - Unified controller
│
├── routes/v1/
│   └── webhook.routes.ts                     # NEW
│
├── middleware/
│   ├── rawBodyParser.ts                      # NEW
│   └── webhookAuth.ts                        # NEW
│
└── models/
    └── AuditLog.ts                           # EXTEND (existing)
```

---

## Comparison: V1 vs V2 Architecture

### Endpoint Structure

**V1 (Original):**
```
POST /api/v1/webhooks/facebook
POST /api/v1/webhooks/linkedin
POST /api/v1/webhooks/twitter
POST /api/v1/webhooks/instagram
POST /api/v1/webhooks/youtube
POST /api/v1/webhooks/tiktok
POST /api/v1/webhooks/threads
```

**V2 (Refined):**
```
POST /api/v1/webhooks/:provider
```

### Controller Structure

**V1 (Original):**
```
WebhookController
├── handleFacebook()
├── handleLinkedIn()
├── handleTwitter()
├── handleInstagram()
├── handleYouTube()
├── handleTikTok()
└── handleThreads()
```

**V2 (Refined):**
```
WebhookController
└── handleWebhook(req, res)
    ↓
WebhookProviderRegistry
├── FacebookWebhookProvider
├── LinkedInWebhookProvider
├── TwitterWebhookProvider
├── InstagramWebhookProvider
├── YouTubeWebhookProvider
├── TikTokWebhookProvider
└── ThreadsWebhookProvider
```

### Queue Structure

**V1 (Original):**
```
webhook-events-queue
└── Process everything
```

**V2 (Refined):**
```
webhook-ingest-queue (Stage 1)
└── Fast ingestion & storage
    ↓
webhook-processing-queue (Stage 2)
└── Business logic & database updates
```

### Benefits of V2

1. **Reduced Code Duplication:** Single controller vs 7 controllers
2. **Easier to Add Providers:** Register new provider vs create new controller
3. **Consistent Error Handling:** Centralized vs duplicated
4. **Better Separation of Concerns:** Interface-driven vs ad-hoc
5. **Faster Response Times:** Two-stage pipeline vs single queue
6. **Better Failure Isolation:** Stage 1 failures don't affect Stage 2
7. **Independent Scaling:** Scale ingestion and processing separately

---

## Success Criteria

Phase 2 is complete when:

1. ✅ Unified webhook endpoint implemented (`/webhooks/:provider`)
2. ✅ Provider registry with 7 providers registered
3. ✅ All providers implement `IWebhookProvider` interface
4. ✅ Two-stage queue pipeline operational
5. ✅ Event normalization working for all providers
6. ✅ Idempotency enforced via Redis
7. ✅ All events logged to AuditLog
8. ✅ Unit tests pass (>80% coverage)
9. ✅ Integration tests pass
10. ✅ Documentation complete
11. ✅ No Phase 1B modifications

---

## Next Steps (Phase 3)

After Phase 2 completion:

1. Implement webhook processing worker (Stage 2)
2. Implement event handlers:
   - `TokenRevokedHandler`
   - `PermissionChangedHandler`
   - `AccountDisconnectedHandler`
   - `MediaPublishedHandler`
   - etc.
3. Update SocialAccount status based on events
4. Trigger token refresh when needed
5. Implement user notifications
6. Add monitoring dashboards

---

## Environment Variables

Add to `apps/backend/.env`:

```bash
# Webhook Secrets (same as V1)
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

## Monitoring Metrics

### V2-Specific Metrics

#### Provider Metrics
- `webhook_provider_requests_total` (counter) - by provider
- `webhook_provider_signature_invalid_total` (counter) - by provider
- `webhook_provider_normalization_failed_total` (counter) - by provider

#### Queue Metrics
- `webhook_ingest_queue_size` (gauge)
- `webhook_ingest_queue_lag_ms` (histogram)
- `webhook_processing_queue_size` (gauge)
- `webhook_processing_queue_lag_ms` (histogram)
- `webhook_stage1_duration_ms` (histogram)
- `webhook_stage2_duration_ms` (histogram)

#### Event Type Metrics
- `webhook_events_by_type_total` (counter) - by event_type
- `webhook_events_normalized_total` (counter) - by provider, event_type

---

## Security Considerations

### V2-Specific Security

1. **Provider Validation:** Validate provider parameter against registry
2. **Interface Enforcement:** TypeScript ensures all providers implement interface
3. **Signature Verification:** Delegated to provider implementation
4. **Event Validation:** Validate normalized events before enqueueing
5. **Rate Limiting:** Per-provider rate limiting
6. **Queue Isolation:** Stage 1 and Stage 2 queues are isolated

---

## Testing Strategy

### V2-Specific Tests

#### Provider Tests
```typescript
describe('FacebookWebhookProvider', () => {
  it('should verify valid signature', async () => {});
  it('should reject invalid signature', async () => {});
  it('should extract event from payload', async () => {});
  it('should normalize event correctly', async () => {});
});
```

#### Registry Tests
```typescript
describe('WebhookProviderRegistry', () => {
  it('should register provider', () => {});
  it('should get provider by name', () => {});
  it('should throw error for unknown provider', () => {});
  it('should list all providers', () => {});
});
```

#### Integration Tests
```typescript
describe('POST /api/v1/webhooks/:provider', () => {
  it('should accept valid facebook webhook', async () => {});
  it('should reject invalid signature', async () => {});
  it('should return 404 for unknown provider', async () => {});
  it('should enqueue to both queues', async () => {});
});
```

---

**END OF REFINED ARCHITECTURE PLAN V2**
