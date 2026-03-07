# Security Middleware Integration Guide

## Overview

This guide shows how to integrate all production security middleware into your Express application.

## Complete Integration Example

### 1. Main Application Setup

**File:** `src/app.ts`

```typescript
import express from 'express';
import { applyProductionSecurity } from './middleware/productionSecurity';
import { 
  globalApiRateLimiter,
  authRateLimiter,
  postSpamProtection,
  aiRequestLimiter 
} from './middleware/advancedRateLimiter';
import { sanitizeErrors } from './middleware/productionSecurity';
import { logger } from './utils/logger';

const app = express();

// ============================================
// 1. PRODUCTION SECURITY (FIRST)
// ============================================
// Apply Helmet, CORS, body limits, input sanitization
applyProductionSecurity(app);

// ============================================
// 2. BODY PARSERS
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// 3. GLOBAL API RATE LIMITER
// ============================================
// Apply to all API routes (except health checks)
app.use('/api', globalApiRateLimiter);

// ============================================
// 4. ROUTES
// ============================================
// Health check (no rate limiting)
app.get('/health', healthController);

// Auth routes (strict rate limiting)
app.post('/api/auth/login', authRateLimiter, loginController);
app.post('/api/auth/register', authRateLimiter, registerController);

// Post routes (spam protection)
app.post('/api/posts', authenticate, postSpamProtection, createPostController);

// AI routes (AI rate limiting)
app.post('/api/ai/generate', authenticate, aiRequestLimiter, generateController);

// Other API routes (global rate limiting applied)
app.use('/api', apiRoutes);

// ============================================
// 5. ERROR HANDLER (LAST)
// ============================================
app.use(sanitizeErrors);

export default app;
```

---

## 2. Route-Specific Examples

### Auth Routes

```typescript
import { Router } from 'express';
import { authRateLimiter } from '../middleware/advancedRateLimiter';
import { AuthController } from '../controllers/AuthController';

const router = Router();

// Login: 5 req/min per IP
router.post('/login', authRateLimiter, AuthController.login);

// Register: 3 req/min per IP
router.post('/register', authRateLimiter, AuthController.register);

// Refresh: 10 req/min per IP
router.post('/refresh', authRateLimiter, AuthController.refresh);

export default router;
```

### Post Routes

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { postSpamProtection } from '../middleware/advancedRateLimiter';
import { PostController } from '../controllers/PostController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create post: 20 posts/min per workspace
router.post('/', postSpamProtection, PostController.create);

// Other routes (global rate limiting only)
router.get('/', PostController.list);
router.get('/:id', PostController.get);
router.patch('/:id', PostController.update);
router.delete('/:id', PostController.delete);

export default router;
```

### AI Routes

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { aiRequestLimiter } from '../middleware/advancedRateLimiter';
import { AIController } from '../controllers/AIController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// AI generation: 30 req/min per workspace
router.post('/generate', aiRequestLimiter, AIController.generate);
router.post('/hashtags', aiRequestLimiter, AIController.hashtags);
router.post('/rewrite', aiRequestLimiter, AIController.rewrite);

export default router;
```

---

## 3. Middleware Order (Critical!)

The order of middleware is crucial for security:

```typescript
// ✅ CORRECT ORDER
app.use(helmet());                    // 1. Security headers
app.use(cors());                      // 2. CORS
app.use(removeSensitiveHeaders);      // 3. Hide tech stack
app.use(bodySizeLimit);               // 4. Payload protection
app.use(sanitizeInput);               // 5. Input cleaning
app.use(express.json());              // 6. Body parsing
app.use(globalApiRateLimiter);        // 7. Rate limiting
app.use('/api', routes);              // 8. Routes
app.use(sanitizeErrors);              // 9. Error handler (LAST)

// ❌ WRONG ORDER
app.use(express.json());              // Body parser before security
app.use(helmet());                    // Too late!
```

---

## 4. Environment Configuration

### Required Environment Variables

```bash
# CORS
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com

# Redis (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Security
BODY_SIZE_LIMIT=10mb
```

### Development vs Production

```typescript
// Development
if (process.env.NODE_ENV !== 'production') {
  // Enable detailed logging
  app.use(morgan('dev'));
  
  // Allow all CORS in development
  app.use(cors({ origin: '*' }));
}

// Production
if (process.env.NODE_ENV === 'production') {
  // Strict CORS
  app.use(configureCors());
  
  // Hide stack traces
  app.use(sanitizeErrors);
  
  // Enable all security headers
  app.use(configureHelmet());
}
```

---

## 5. Testing Security

### Test Rate Limiting

```bash
# Test global rate limit (100 req/min for free plan)
for i in {1..101}; do
  curl -H "Authorization: Bearer $TOKEN" \
       -H "X-Workspace-Id: $WORKSPACE_ID" \
       http://localhost:3000/api/posts
done

# Expected: First 100 succeed, 101st returns 429
```

### Test Auth Rate Limit

```bash
# Test login rate limit (5 req/min per IP)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email":"test@example.com","password":"wrong"}'
done

# Expected: First 5 succeed, 6th returns 429
```

### Test Post Spam Protection

```bash
# Test post spam protection (20 posts/min per workspace)
for i in {1..21}; do
  curl -X POST http://localhost:3000/api/posts \
       -H "Authorization: Bearer $TOKEN" \
       -H "X-Workspace-Id: $WORKSPACE_ID" \
       -H "Content-Type: application/json" \
       -d '{"content":"Test post '$i'"}'
done

# Expected: First 20 succeed, 21st returns 429
```

### Test Secret Masking

```typescript
// Log with secrets
logger.info('User authenticated', {
  userId: 'user_123',
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  refreshToken: 'abc123def456...',
  password: 'mypassword123'
});

// Expected log output:
// {
//   "userId": "user_123",
//   "accessToken": "eyJ...MASKED...JWT",
//   "refreshToken": "abc1...f456",
//   "password": "***MASKED***"
// }
```

---

## 6. Monitoring & Alerts

### Key Metrics to Monitor

```typescript
// Rate limit hits
logger.warn('Rate limit exceeded', {
  userId,
  workspaceId,
  endpoint: req.path,
  limit,
  current,
  plan
});

// Auth failures
logger.warn('Auth rate limit exceeded', {
  ip: req.ip,
  path: req.path,
  attempts: current
});

// Post spam
logger.warn('Post spam protection triggered', {
  workspaceId,
  postsCreated: current,
  limit
});
```

### Alert Thresholds

- **High rate limit hits:** >10% of requests return 429
- **Repeated auth failures:** >10 failures from same IP in 5 minutes
- **Post spam:** >50 posts/minute from any workspace
- **Redis errors:** Any Redis connection failures

---

## 7. Performance Considerations

### Redis Connection Pooling

```typescript
// Use connection pooling for better performance
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});
```

### Caching Rate Limit Results

```typescript
// Cache billing plan to reduce DB queries
const planCache = new Map<string, BillingPlan>();

async function getPlan(workspaceId: string): Promise<BillingPlan> {
  if (planCache.has(workspaceId)) {
    return planCache.get(workspaceId)!;
  }
  
  const billing = await Billing.findOne({ workspaceId });
  const plan = billing?.plan || BillingPlan.FREE;
  
  planCache.set(workspaceId, plan);
  setTimeout(() => planCache.delete(workspaceId), 60000); // 1 min TTL
  
  return plan;
}
```

---

## 8. Error Handling

### Rate Limit Errors

```typescript
// Client should handle 429 responses
try {
  const response = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postData)
  });
  
  if (response.status === 429) {
    const data = await response.json();
    const retryAfter = data.retryAfter || 60;
    
    // Show user-friendly message
    alert(`Too many requests. Please wait ${retryAfter} seconds.`);
    
    // Retry after delay
    setTimeout(() => retry(), retryAfter * 1000);
  }
} catch (error) {
  console.error('Request failed:', error);
}
```

### Security Errors

```typescript
// Handle CORS errors
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    logger.warn('CORS violation', {
      origin: req.headers.origin,
      ip: req.ip
    });
    
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Origin not allowed'
    });
    return;
  }
  
  next(err);
});
```

---

## 9. Security Checklist

Before deploying to production:

- [ ] Helmet configured with strict CSP
- [ ] CORS restricted to production domains
- [ ] Body size limit set to 10MB
- [ ] Stack traces hidden in production
- [ ] X-Powered-By header removed
- [ ] Input sanitization enabled
- [ ] Global rate limiting enabled
- [ ] Auth rate limiting enabled (5 req/min)
- [ ] Post spam protection enabled (20 posts/min)
- [ ] AI rate limiting enabled (30 req/min)
- [ ] Secret masking in logs verified
- [ ] Redis connection pooling configured
- [ ] Error handler catches all errors
- [ ] Monitoring and alerts configured
- [ ] HTTPS enforced via HSTS
- [ ] Environment variables secured

---

## 10. Troubleshooting

### Rate Limiting Not Working

```bash
# Check Redis connection
redis-cli ping
# Expected: PONG

# Check Redis keys
redis-cli keys "ratelimit:*"
# Expected: List of rate limit keys

# Check rate limit middleware order
# Ensure globalApiRateLimiter is before routes
```

### Secrets Still Appearing in Logs

```bash
# Check logger configuration
# Ensure maskSensitiveData format is applied

# Test masking
logger.info('Test', { accessToken: 'test123' });
# Expected: { accessToken: '***MASKED***' }
```

### CORS Errors

```bash
# Check ALLOWED_ORIGINS environment variable
echo $ALLOWED_ORIGINS
# Expected: https://app.example.com,https://www.example.com

# Check request origin
curl -H "Origin: https://app.example.com" http://localhost:3000/api/posts
# Expected: Access-Control-Allow-Origin header in response
```

---

## Summary

✅ **Security headers** via Helmet
✅ **CORS restrictions** to production domains
✅ **Body size limits** (10MB)
✅ **Stack trace hiding** in production
✅ **Global rate limiting** (100-300 req/min)
✅ **Auth rate limiting** (3-5 req/min)
✅ **Post spam protection** (20 posts/min)
✅ **AI rate limiting** (30 req/min)
✅ **Secret masking** in all logs
✅ **Input sanitization** for all requests
✅ **Error sanitization** in production

All middleware is production-ready, non-blocking, and fail-safe.
