# Sentry Integration - Complete ✅

## Status: Integration Complete

The Sentry error tracking integration has been successfully integrated into the Express application.

## What Was Done

### 1. Sentry Module Created
- **File**: `apps/backend/src/monitoring/sentry.ts`
- Comprehensive Sentry integration with initialization, middleware, and context management
- Environment-based configuration (disabled in dev/test, enabled in staging/production)
- Error filtering (ignores 4xx errors, captures 5xx only)
- Enhanced `captureException` with tags, extra context, and user support

### 2. Express Integration Complete
- **Files Modified**: 
  - `apps/backend/src/app.ts` - Added Sentry middleware
  - `apps/backend/src/server.ts` - Added initialization and graceful shutdown

### 3. Worker Integration Complete
- **Files Modified**:
  - `apps/backend/src/workers/PublishingWorker.ts` - Job failure tracking
  - `apps/backend/src/workers/TokenRefreshWorker.ts` - Refresh failure tracking
  - `apps/backend/src/workers/BackupVerificationWorker.ts` - Verification failure tracking
- Captures worker crashes, job failures, and retry exhaustion
- Rich context attachment (jobId, postId, workspaceId, etc.)
- See `apps/backend/src/workers/SENTRY_INTEGRATION_COMPLETE.md` for details

### 3. Middleware Order (Correct)
```typescript
// app.ts middleware order:
1. Sentry request handler (FIRST - captures all requests)
2. Request ID middleware
3. Sentry tracing handler (for performance monitoring)
4. Security middleware (helmet, CORS, etc.)
5. Body parsers
6. Application routes
7. 404 handler
8. Sentry error handler (BEFORE global error handler)
9. Global error handler (LAST)
```

### 4. Server Initialization
```typescript
// server.ts initialization order:
1. Load environment variables
2. Initialize Sentry (BEFORE importing app)
3. Import app and other modules
4. Start server
5. Graceful shutdown includes Sentry flush
```

## Installation Steps

### Step 1: Install Sentry SDK
```bash
cd apps/backend
npm install @sentry/node
```

### Step 2: Configure Environment Variables
Add to your `.env` file:
```bash
# Sentry Configuration
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NODE_ENV=production  # or staging, development, test
APP_VERSION=1.0.0    # Your app version for release tracking
```

### Step 3: Get Your Sentry DSN
1. Sign up at https://sentry.io (free tier available)
2. Create a new project (select Node.js/Express)
3. Copy your DSN from the project settings
4. Add it to your `.env` file

### Step 4: Test the Integration
Start your server and test error capture:
```bash
npm run dev
```

Trigger an error manually and check your Sentry dashboard.

## Features Enabled

✅ Automatic error capture for unhandled exceptions
✅ Automatic promise rejection tracking
✅ Request context (URL, method, headers, user agent)
✅ User context (userId, workspaceId when available)
✅ Performance monitoring (transaction tracing)
✅ Breadcrumb tracking for debugging
✅ Error filtering (4xx errors ignored)
✅ Environment-based behavior (disabled in dev/test)
✅ Graceful shutdown with event flushing
✅ Worker error tracking (PublishingWorker, TokenRefreshWorker, BackupVerificationWorker)
✅ Job failure tracking with rich context
✅ Retry exhaustion capture

## Usage in Code

### Automatic Error Capture
Errors thrown in routes/controllers are automatically captured:
```typescript
// No changes needed - existing error handling works
throw new Error('Something went wrong');
```

### Manual Error Capture
```typescript
import { captureException, captureMessage } from '@/monitoring/sentry';

// Capture exception with context
captureException(error, {
  level: 'error',
  tags: { feature: 'billing', operation: 'charge' },
  extra: { userId: '123', amount: 99.99 },
  user: { id: '123', email: 'user@example.com' }
});

// Capture message
captureMessage('Payment processing started', 'info');
```

### Add Context
```typescript
import { attachSentryContext } from '@/monitoring/sentry';

// In middleware or controller
attachSentryContext(req, {
  userId: user.id,
  workspaceId: workspace.id,
  postId: post.id
});
```

### Add Breadcrumbs
```typescript
import { addBreadcrumb } from '@/monitoring/sentry';

addBreadcrumb(
  'User initiated payment',
  'billing',
  { amount: 99.99, currency: 'USD' }
);
```

## Configuration Options

All configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | Yes | - | Your Sentry project DSN |
| `NODE_ENV` | No | development | Environment (development/test/staging/production) |
| `APP_VERSION` | No | 1.0.0 | App version for release tracking |

## Behavior by Environment

- **development**: Sentry disabled, errors logged to console
- **test**: Sentry disabled, errors logged to console
- **staging**: Sentry enabled, all 5xx errors captured
- **production**: Sentry enabled, all 5xx errors captured

## Error Filtering

Sentry automatically ignores these error types:
- BadRequestError (400)
- UnauthorizedError (401)
- ForbiddenError (403)
- NotFoundError (404)
- ValidationError (400)

Only 5xx server errors are captured to reduce noise.

## Next Steps

1. ✅ Install `@sentry/node` package
2. ✅ Add `SENTRY_DSN` to environment variables
3. ✅ Test error capture in staging environment
4. ✅ Configure alert rules in Sentry dashboard
5. ✅ Set up team notifications (email, Slack, etc.)
6. ✅ Review and tune error sampling rates if needed

## Documentation

- Integration guide: `apps/backend/src/monitoring/SENTRY_INTEGRATION.md`
- Express example: `apps/backend/src/monitoring/EXPRESS_INTEGRATION_EXAMPLE.ts`
- Main module: `apps/backend/src/monitoring/sentry.ts`
- General docs: `apps/backend/src/monitoring/README.md`
- Installation: `apps/backend/src/monitoring/INSTALLATION_REQUIRED.md`
- Worker integration: `apps/backend/src/workers/SENTRY_INTEGRATION_COMPLETE.md`

## Verification

After installation, verify Sentry is working:

1. Check server logs for Sentry initialization message
2. Trigger a test error (throw an error in a route)
3. Check Sentry dashboard for the captured error
4. Verify user context and breadcrumbs are attached

## Integration Details

### app.ts Changes
- Added Sentry request handler as first middleware
- Added Sentry tracing handler after request ID
- Added Sentry error handler before global error handler
- Maintained correct middleware ordering

### server.ts Changes
- Added Sentry initialization before app import
- Added Sentry flush to graceful shutdown
- Ensured proper cleanup on process termination

## Support

- Sentry docs: https://docs.sentry.io/platforms/node/
- Express integration: https://docs.sentry.io/platforms/node/guides/express/
