# Monitoring Module

Centralized error tracking and monitoring using Sentry.

## Installation

**Step 1: Install Sentry SDK**

```bash
npm install @sentry/node
```

Or with yarn:

```bash
yarn add @sentry/node
```

**Step 2: Configure Environment Variables**

Add to your `.env` file:

```env
# Sentry Configuration
SENTRY_DSN=https://[key]@[organization].ingest.sentry.io/[project]
NODE_ENV=production
APP_VERSION=1.0.0
```

**Step 3: Get Your Sentry DSN**

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project (select Node.js)
3. Copy the DSN from project settings
4. Add to your `.env` file

## Quick Start

### 1. Initialize Sentry in Your Server

```typescript
import {
  initializeSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  attachSentryContext,
} from './monitoring/sentry';

// Initialize Sentry FIRST
initializeSentry();

// Add Sentry middleware
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Your middleware and routes
app.use(express.json());
app.use(requireAuth);
app.use(attachSentryContext);
app.use('/api', routes);

// Sentry error handler (AFTER routes)
app.use(sentryErrorHandler());

// Your error handlers
app.use(errorHandler);
```

### 2. Automatic Error Capture

Sentry automatically captures:
- Unhandled exceptions
- Unhandled promise rejections
- Express route errors (5xx only)

### 3. Manual Error Capture

```typescript
import { captureException } from './monitoring/sentry';

try {
  await riskyOperation();
} catch (error) {
  captureException(error, { operation: 'riskyOperation' });
  throw error;
}
```

## Features

### ✅ Automatic Capture
- Unhandled exceptions
- Unhandled promise rejections
- Express route errors

### ✅ Context Tracking
- User ID and email
- Workspace ID
- Post ID
- Request details

### ✅ Error Filtering
- Ignores 4xx client errors
- Ignores validation errors
- Only captures 5xx server errors

### ✅ Performance Monitoring
- Request duration tracking
- Database query performance
- External API call duration

### ✅ Environment-Based
- Disabled in development/test
- Enabled in staging/production
- Configurable sample rates

## Files

- `sentry.ts` - Main Sentry integration module
- `SENTRY_INTEGRATION.md` - Detailed integration guide
- `EXPRESS_INTEGRATION_EXAMPLE.ts` - Example Express setup
- `README.md` - This file

## Usage Examples

### Set User Context

```typescript
import { setSentryUser } from './monitoring/sentry';

setSentryUser(user.id, user.email);
```

### Set Workspace Context

```typescript
import { setSentryWorkspace } from './monitoring/sentry';

setSentryWorkspace(workspace.id);
```

### Add Breadcrumbs

```typescript
import { addBreadcrumb } from './monitoring/sentry';

addBreadcrumb('User logged in', 'auth', { userId: user.id });
```

### Capture Messages

```typescript
import { captureMessage } from './monitoring/sentry';

captureMessage('Payment processed', 'info');
```

## Error Filtering

### Ignored (Not Sent to Sentry)
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 422 Validation Error

### Captured (Sent to Sentry)
- 500 Internal Server Error
- 503 Service Unavailable
- Database errors
- External API errors
- Unhandled exceptions

## Environment Behavior

| Environment | Sentry Enabled | Trace Sample Rate |
|-------------|----------------|-------------------|
| development | ❌ No          | N/A               |
| test        | ❌ No          | N/A               |
| staging     | ✅ Yes         | 100%              |
| production  | ✅ Yes         | 10%               |

## Integration Checklist

- [ ] Install `@sentry/node` package
- [ ] Add `SENTRY_DSN` to environment variables
- [ ] Initialize Sentry in server.ts
- [ ] Add Sentry request handler (before routes)
- [ ] Add Sentry tracing handler (before routes)
- [ ] Add context attachment middleware (after auth)
- [ ] Add Sentry error handler (after routes)
- [ ] Add graceful shutdown with `flushSentry()`
- [ ] Test error capture
- [ ] Configure alerts in Sentry dashboard

## Testing

Test Sentry integration:

```bash
# Start server
npm run dev

# Trigger test error
curl http://localhost:3000/api/test/sentry

# Check Sentry dashboard for error
```

## Monitoring Dashboard

Access your Sentry dashboard:
- https://sentry.io/organizations/[org]/issues/

Monitor:
- Error frequency and trends
- Stack traces
- User impact
- Performance metrics
- Release tracking

## Support

- Documentation: https://docs.sentry.io/platforms/node/
- Community: https://discord.gg/sentry
- Status: https://status.sentry.io/

## Next Steps

1. Install Sentry SDK
2. Configure environment variables
3. Integrate with Express (see `EXPRESS_INTEGRATION_EXAMPLE.ts`)
4. Test error capture
5. Configure alerts
6. Monitor dashboard

## Notes

- Sentry is disabled in development to avoid noise
- Only 5xx errors are captured (4xx are ignored)
- User context is automatically attached after authentication
- Workspace and post context are attached from request
- Graceful shutdown ensures all events are flushed
