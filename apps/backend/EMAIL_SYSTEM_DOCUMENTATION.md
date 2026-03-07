# Email Notification System Documentation

## Overview

The email notification system provides reliable, queue-based email delivery for all application events. It uses Resend as the email provider and BullMQ for queue management.

## Architecture

### Components

1. **EmailService** (`src/services/EmailService.ts`)
   - Low-level email sending using Resend API
   - Error classification (retryable vs non-retryable)
   - HTML and plain text support

2. **EmailTemplateService** (`src/services/EmailTemplateService.ts`)
   - Template rendering for all notification types
   - XSS protection (HTML escaping)
   - Fallback templates

3. **EmailNotificationService** (`src/services/EmailNotificationService.ts`)
   - High-level API for sending notifications
   - Queue integration
   - Type-safe notification methods

4. **EmailQueue** (`src/queue/EmailQueue.ts`)
   - BullMQ queue for email jobs
   - Job deduplication
   - Priority-based processing

5. **EmailWorker** (`src/workers/EmailWorker.ts`)
   - Processes email jobs from queue
   - Retry with exponential backoff
   - Metrics and monitoring

## Email Types

### Post Events
- `POST_SUCCESS` - Post published successfully
- `POST_FAILURE` - Post failed to publish

### OAuth Events
- `OAUTH_EXPIRED` - OAuth token expired
- `OAUTH_REFRESH_FAILURE` - Token refresh failed

### User Events
- `USER_SIGNUP` - New user registration
- `PASSWORD_RESET` - Password reset request

### Billing Events
- `SUBSCRIPTION_CREATED` - New subscription
- `SUBSCRIPTION_UPDATED` - Subscription changed
- `SUBSCRIPTION_CANCELLED` - Subscription cancelled
- `PAYMENT_FAILED` - Payment failure

### System Events
- `SYSTEM_ALERT` - Critical system alerts
- `ACCOUNT_LIMITS` - Account limit warnings

## Configuration

### Environment Variables

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Optional
EMAIL_FROM=noreply@yourdomain.com  # Default: noreply@example.com
```

### Resend Setup

1. Sign up at https://resend.com
2. Verify your domain
3. Create an API key
4. Add to `.env` file

## Usage

### Sending Emails

```typescript
import { emailNotificationService } from './services/EmailNotificationService';

// Post success
await emailNotificationService.sendPostSuccess({
  to: 'user@example.com',
  platform: 'Twitter',
  postTitle: 'My awesome post',
  platformUrl: 'https://twitter.com/user/status/123',
  userId: 'user-id',
  workspaceId: 'workspace-id',
});

// Post failure
await emailNotificationService.sendPostFailure({
  to: 'user@example.com',
  platform: 'LinkedIn',
  postTitle: 'Failed post',
  error: 'API rate limit exceeded',
  userId: 'user-id',
  workspaceId: 'workspace-id',
});

// OAuth expired
await emailNotificationService.sendOAuthExpired({
  to: 'user@example.com',
  platform: 'Facebook',
  reconnectUrl: 'https://app.example.com/reconnect',
  userId: 'user-id',
  workspaceId: 'workspace-id',
});

// User signup
await emailNotificationService.sendUserSignup({
  to: 'newuser@example.com',
  userName: 'John Doe',
  verificationUrl: 'https://app.example.com/verify?token=abc',
  userId: 'user-id',
});

// Password reset
await emailNotificationService.sendPasswordReset({
  to: 'user@example.com',
  resetUrl: 'https://app.example.com/reset?token=xyz',
  expiresIn: '1 hour',
  userId: 'user-id',
});
```

### Integration Points

The email system is integrated into:

1. **PublishingWorker** - Post success/failure emails
2. **SocialAccountService** - OAuth expiration emails
3. **AuthService** - Signup and password reset emails
4. **BillingService** - Subscription and payment emails

All integrations are non-blocking and never throw errors.

## Running the Email Worker

### Development

```bash
# Start email worker
tsx src/workers/email-worker-standalone.ts

# Or add to package.json
npm run worker:email
```

### Production

```bash
# Build
npm run build

# Run
node dist/workers/email-worker-standalone.js
```

### Docker

```yaml
services:
  email-worker:
    build: .
    command: node dist/workers/email-worker-standalone.js
    environment:
      - RESEND_API_KEY=${RESEND_API_KEY}
      - EMAIL_FROM=${EMAIL_FROM}
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
    depends_on:
      - mongodb
      - redis
```

## Testing

### Test Script

```bash
# Run test script
tsx scripts/test-email-system.ts
```

This will:
1. Connect to MongoDB and Redis
2. Start the email worker
3. Send test emails for all notification types
4. Display metrics
5. Stop the worker

### Manual Testing

```typescript
import { emailService } from './services/EmailService';

// Send test email
const result = await emailService.sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  body: 'This is a test email',
  html: '<p>This is a test email</p>',
});

console.log(result);
```

## Features

### Non-Blocking

All email operations are non-blocking:
- Emails are queued asynchronously
- Failures don't affect main workflow
- No exceptions thrown to caller

### Retry Logic

- 3 attempts with exponential backoff (5s, 25s, 125s)
- Retryable errors: network, timeout, rate limit, 500, 503
- Non-retryable errors: invalid email, auth failure, 400

### Idempotency

- Job IDs prevent duplicate emails
- Queue-level deduplication
- Safe for concurrent workers

### Graceful Degradation

- Email service not configured → logs warning, continues
- Email provider down → retries, then logs failure
- Template rendering error → uses fallback template

### Monitoring

- Structured logging for all operations
- Metrics: success, failure, retry, skipped
- Queue health monitoring
- Worker heartbeat

### Rate Limiting

- Worker concurrency: 3 emails at once
- Rate limit: 10 emails per second
- Prevents provider throttling

### Priority

Emails are processed by priority:
1. System alerts (highest)
2. Password reset
3. User signup
4. OAuth issues
5. Payment failures
6. Subscription events
7. Post failures
8. Post success
9. Account limits (lowest)

## Troubleshooting

### Emails Not Sending

1. Check Resend API key is configured
2. Verify domain is verified in Resend
3. Check email worker is running
4. Check Redis connection
5. Check queue stats: `emailQueue.getStats()`

### High Failure Rate

1. Check Resend dashboard for errors
2. Review error logs for patterns
3. Check rate limiting
4. Verify email addresses are valid

### Queue Backlog

1. Check worker is running
2. Increase worker concurrency
3. Check for slow email provider
4. Review retry configuration

## Monitoring

### Metrics

```typescript
const metrics = emailWorker.getMetrics();
console.log(metrics);
// {
//   email_success_total: 100,
//   email_failed_total: 5,
//   email_retry_total: 10,
//   email_skipped_total: 2,
//   queue_jobs_processed_total: 100,
//   queue_jobs_failed_total: 5
// }
```

### Queue Stats

```typescript
const stats = await emailQueue.getStats();
console.log(stats);
// {
//   waiting: 10,
//   active: 3,
//   completed: 100,
//   failed: 5,
//   delayed: 0,
//   total: 118,
//   failureRate: '4.24',
//   health: 'healthy'
// }
```

### Logs

All operations are logged with structured data:

```
[INFO] Email sent successfully { to: 'user@example.com', type: 'POST_SUCCESS', emailId: 'abc123', duration_ms: 234 }
[WARN] Email send failed - will retry { to: 'user@example.com', error: 'Rate limit', attempt: 1 }
[ERROR] Email send failed - final { to: 'user@example.com', error: 'Invalid email', attempt: 3 }
```

## Security

### Email Validation

- Email addresses validated before sending
- Invalid emails rejected immediately
- No retry for invalid addresses

### XSS Protection

- All user input HTML-escaped
- Template rendering sanitizes data
- No raw HTML from user input

### Rate Limiting

- Worker-level rate limiting
- Prevents abuse
- Protects email provider account

### Error Handling

- Sensitive errors not exposed to users
- Detailed logging for debugging
- Sentry integration for critical failures

## Performance

### Throughput

- 3 concurrent workers
- 10 emails per second rate limit
- ~30,000 emails per hour capacity

### Latency

- Queue latency: <100ms
- Send latency: 200-500ms (Resend)
- Total latency: <1 second

### Resource Usage

- Memory: ~50MB per worker
- CPU: <5% per worker
- Redis: ~1KB per job

## Future Enhancements

1. **Email Templates**
   - HTML email templates with branding
   - Template versioning
   - A/B testing

2. **Email Tracking**
   - Open tracking
   - Click tracking
   - Bounce handling

3. **Email Preferences**
   - User opt-out
   - Notification preferences
   - Frequency limits

4. **Multiple Providers**
   - Fallback providers
   - Provider selection
   - Cost optimization

5. **Advanced Features**
   - Scheduled emails
   - Batch sending
   - Email campaigns
