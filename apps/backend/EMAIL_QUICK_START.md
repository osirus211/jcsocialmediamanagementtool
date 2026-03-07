# Email System - Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies

```bash
cd apps/backend
npm install
```

### 2. Get Resend API Key

1. Go to https://resend.com
2. Sign up for free account
3. Verify your domain (or use test mode)
4. Create API key

### 3. Configure Environment

Add to `apps/backend/.env`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### 4. Start Email Worker

```bash
# Terminal 1: Start main app
npm run dev

# Terminal 2: Start email worker
tsx src/workers/email-worker-standalone.ts
```

### 5. Test It

```bash
tsx scripts/test-email-system.ts
```

## Usage Examples

### Send Post Success Email

```typescript
import { emailNotificationService } from './services/EmailNotificationService';

await emailNotificationService.sendPostSuccess({
  to: 'user@example.com',
  platform: 'Twitter',
  postTitle: 'My awesome post',
  platformUrl: 'https://twitter.com/user/status/123',
});
```

### Send Post Failure Email

```typescript
await emailNotificationService.sendPostFailure({
  to: 'user@example.com',
  platform: 'LinkedIn',
  postTitle: 'Failed post',
  error: 'API rate limit exceeded',
});
```

### Send OAuth Expired Email

```typescript
await emailNotificationService.sendOAuthExpired({
  to: 'user@example.com',
  platform: 'Facebook',
  reconnectUrl: 'https://app.example.com/reconnect',
});
```

### Send Welcome Email

```typescript
await emailNotificationService.sendUserSignup({
  to: 'newuser@example.com',
  userName: 'John Doe',
  verificationUrl: 'https://app.example.com/verify?token=abc',
});
```

## All Available Methods

```typescript
// Post events
emailNotificationService.sendPostSuccess(params)
emailNotificationService.sendPostFailure(params)

// OAuth events
emailNotificationService.sendOAuthExpired(params)
emailNotificationService.sendOAuthRefreshFailure(params)

// User events
emailNotificationService.sendUserSignup(params)
emailNotificationService.sendPasswordReset(params)

// Billing events
emailNotificationService.sendSubscriptionCreated(params)
emailNotificationService.sendSubscriptionUpdated(params)
emailNotificationService.sendSubscriptionCancelled(params)
emailNotificationService.sendPaymentFailed(params)

// System events
emailNotificationService.sendSystemAlert(params)
emailNotificationService.sendAccountLimits(params)
```

## Monitoring

### Check Queue Stats

```typescript
import { EmailQueue } from './queue/EmailQueue';

const emailQueue = new EmailQueue();
const stats = await emailQueue.getStats();
console.log(stats);
// {
//   waiting: 10,
//   active: 3,
//   completed: 100,
//   failed: 5,
//   health: 'healthy'
// }
```

### Check Worker Metrics

```typescript
import { EmailWorker } from './workers/EmailWorker';

const emailWorker = new EmailWorker();
const metrics = emailWorker.getMetrics();
console.log(metrics);
// {
//   email_success_total: 100,
//   email_failed_total: 5,
//   email_retry_total: 10
// }
```

## Troubleshooting

### Emails Not Sending?

1. Check Resend API key is set: `echo $RESEND_API_KEY`
2. Check email worker is running: `ps aux | grep email-worker`
3. Check Redis is running: `redis-cli ping`
4. Check logs: `tail -f logs/combined.log`

### High Failure Rate?

1. Check Resend dashboard for errors
2. Review error logs: `grep "Email send failed" logs/error.log`
3. Verify email addresses are valid
4. Check rate limiting

### Queue Backlog?

1. Check worker is running
2. Increase worker concurrency in `EmailWorker.ts`
3. Check for slow email provider
4. Review retry configuration

## Production Deployment

### Docker

Add to `docker-compose.yml`:

```yaml
services:
  email-worker:
    build: .
    command: node dist/workers/email-worker-standalone.js
    environment:
      - RESEND_API_KEY=${RESEND_API_KEY}
      - EMAIL_FROM=${EMAIL_FROM}
    depends_on:
      - mongodb
      - redis
```

### PM2

```bash
pm2 start dist/workers/email-worker-standalone.js --name email-worker
```

### Systemd

```ini
[Unit]
Description=Email Worker
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/app
ExecStart=/usr/bin/node dist/workers/email-worker-standalone.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## Key Features

✅ **Non-Blocking** - Email failures don't affect main workflow
✅ **Retry Logic** - 3 attempts with exponential backoff
✅ **Idempotent** - No duplicate emails
✅ **Graceful Degradation** - Continues if email service is down
✅ **Monitoring** - Comprehensive logging and metrics
✅ **Rate Limiting** - Prevents provider throttling
✅ **Priority-Based** - Critical emails sent first

## Need Help?

- Full documentation: `EMAIL_SYSTEM_DOCUMENTATION.md`
- Implementation summary: `EMAIL_NOTIFICATION_IMPLEMENTATION_SUMMARY.md`
- Test script: `scripts/test-email-system.ts`
