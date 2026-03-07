# Phase 2: Quick Reference Guide

**For Developers Implementing Webhook Integration**

---

## Quick Start

### 1. Add Environment Variables

```bash
# Add to apps/backend/.env
TWITTER_CONSUMER_SECRET=your-twitter-consumer-secret
GOOGLE_WEBHOOK_SECRET=your-google-webhook-secret
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
```

### 2. Test Webhook Endpoint

```bash
# Test Facebook webhook
curl -X POST http://localhost:5000/api/v1/webhooks/facebook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"event":"token_revoked","data":{...}}'
```

### 3. Monitor Queue

```bash
# Check webhook queue status
curl http://localhost:5000/api/v1/metrics/queues
```

---

## Platform-Specific Signature Headers

| Platform | Header Name | Format |
|----------|-------------|--------|
| Facebook | `X-Hub-Signature-256` | `sha256=<hex>` |
| Instagram | `X-Hub-Signature-256` | `sha256=<hex>` |
| Threads | `X-Hub-Signature-256` | `sha256=<hex>` |
| LinkedIn | `X-LinkedIn-Signature` | `<hex>` |
| Twitter | `X-Twitter-Webhooks-Signature` | `sha256=<base64>` |
| YouTube | `X-Goog-Signature` | `<hex>` |
| TikTok | `X-TikTok-Signature` | `<hex>` |

---

## Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Event received and queued | Success |
| 202 | Event already processed | Idempotent skip |
| 400 | Invalid payload | Check payload structure |
| 401 | Invalid signature | Check webhook secret |
| 500 | Internal error | Platform will retry |

---

## Redis Keys

### Deduplication Keys
```
webhook:dedup:{provider}:{eventId}
TTL: 24 hours
```

### Queue Keys
```
bull:webhook-events-queue:wait
bull:webhook-events-queue:active
bull:webhook-events-queue:completed
bull:webhook-events-queue:failed
```

---

## Common Event Types

### Facebook/Instagram
- `token_revoked` - User revoked access
- `permissions_changed` - User changed permissions
- `account_deleted` - User deleted account

### LinkedIn
- `token_revoked` - Token invalidated
- `member_profile_changed` - Profile updated

### Twitter
- `revoke` - User revoked access
- `account_suspended` - Account suspended

---

## Testing Signature Verification

### Facebook Example

```typescript
import crypto from 'crypto';

const secret = 'your-facebook-app-secret';
const payload = JSON.stringify({ event: 'test' });
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log(`X-Hub-Signature-256: sha256=${signature}`);
```

### Twitter CRC Challenge

```bash
# Twitter will send GET request to verify webhook
GET /api/v1/webhooks/twitter?crc_token=abc123

# Response must be:
{
  "response_token": "sha256=<base64_hmac>"
}
```

---

## Debugging

### Check if event was processed

```bash
# Redis CLI
redis-cli -p 6380
> GET webhook:dedup:facebook:evt_abc123
```

### Check queue status

```bash
# Redis CLI
redis-cli -p 6380
> LLEN bull:webhook-events-queue:wait
> LLEN bull:webhook-events-queue:failed
```

### Check audit logs

```javascript
// MongoDB
db.auditlogs.find({
  action: { $regex: /^webhook\./ }
}).sort({ createdAt: -1 }).limit(10);
```

---

## Common Issues

### Issue: 401 Unauthorized

**Cause:** Invalid signature  
**Solution:** 
1. Check webhook secret in `.env`
2. Verify raw body is preserved
3. Check signature header format

### Issue: 202 Accepted (Duplicate)

**Cause:** Event already processed  
**Solution:** This is normal - idempotency working correctly

### Issue: Queue not processing

**Cause:** Worker not started  
**Solution:** 
1. Check worker is running
2. Check Redis connection
3. Check worker logs

---

## Monitoring Commands

### Check queue health

```bash
curl http://localhost:5000/api/v1/metrics/queues | jq '.["webhook-events-queue"]'
```

### Check Redis keys

```bash
redis-cli -p 6380 KEYS "webhook:*"
```

### Check recent audit logs

```javascript
db.auditlogs.find({
  action: 'webhook.received',
  createdAt: { $gte: new Date(Date.now() - 3600000) }
}).count();
```

---

## File Locations

```
apps/backend/src/
├── controllers/WebhookController.ts
├── services/WebhookSignatureService.ts
├── services/WebhookDeduplicationService.ts
├── queue/WebhookEventsQueue.ts
├── routes/v1/webhook.routes.ts
├── middleware/rawBodyParser.ts
├── middleware/webhookAuth.ts
└── types/webhook.types.ts
```

---

## Useful Snippets

### Generate test signature (Node.js)

```javascript
const crypto = require('crypto');

function generateSignature(secret, payload) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

const payload = JSON.stringify({ event: 'test' });
const signature = generateSignature('your-secret', payload);
console.log(`sha256=${signature}`);
```

### Test webhook locally

```bash
# Install ngrok for local testing
ngrok http 5000

# Use ngrok URL in platform webhook settings
https://abc123.ngrok.io/api/v1/webhooks/facebook
```

---

## Platform Setup URLs

- **Facebook:** https://developers.facebook.com/apps/
- **LinkedIn:** https://www.linkedin.com/developers/apps
- **Twitter:** https://developer.twitter.com/en/portal/dashboard
- **YouTube:** https://console.cloud.google.com/
- **TikTok:** https://developers.tiktok.com/

---

## Support

- **Architecture Plan:** `PHASE_2_ARCHITECTURE_PLAN.md`
- **Diagrams:** `PHASE_2_ARCHITECTURE_DIAGRAM.md`
- **Summary:** `PHASE_2_SUMMARY.md`
- **Phase 1B Report:** `PHASE_1B_VALIDATION_REPORT.md`

---

**Last Updated:** 2026-03-04
