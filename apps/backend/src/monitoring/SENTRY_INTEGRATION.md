# Sentry Integration Guide

## Installation

Install the Sentry Node.js SDK:

```bash
npm install @sentry/node
```

Or with yarn:

```bash
yarn add @sentry/node
```

## Configuration

Add the following environment variables to your `.env` file:

```env
# Sentry Configuration
SENTRY_DSN=https://[key]@[organization].ingest.sentry.io/[project]
NODE_ENV=production
APP_VERSION=1.0.0
```

### Getting Your Sentry DSN

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project (Node.js)
3. Copy the DSN from project settings
4. Add to your environment variables

## Integration with Express

Update your `server.ts` or `app.ts` file:

```typescript
import express from 'express';
import {
  initializeSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  attachSentryContext,
  flushSentry,
} from './monitoring/sentry';

const app = express();

// 1. Initialize Sentry FIRST (before any other middleware)
initializeSentry();

// 2. Add Sentry request handler (BEFORE all routes)
app.use(sentryRequestHandler());

// 3. Add Sentry tracing handler (BEFORE all routes)
app.use(sentryTracingHandler());

// 4. Your middleware (body parser, cors, etc.)
app.use(express.json());
app.use(cors());

// 5. Authentication middleware
app.use(requireAuth);

// 6. Attach Sentry context (AFTER authentication)
app.use(attachSentryContext);

// 7. Your routes
app.use('/api', routes);

// 8. Sentry error handler (AFTER routes, BEFORE other error handlers)
app.use(sentryErrorHandler());

// 9. Your error handlers
app.use(errorHandler);

// 10. Graceful shutdown
process.on('SIGTERM', async () => {
  await flushSentry();
  process.exit(0);
});
```

## Usage Examples

### Automatic Error Capture

Sentry automatically captures:
- Unhandled exceptions
- Unhandled promise rejections
- Express route errors (5xx only)

```typescript
// This error will be automatically captured
app.get('/api/test', (req, res) => {
  throw new Error('Something went wrong!');
});
```

### Manual Error Capture

```typescript
import { captureException, captureMessage } from './monitoring/sentry';

try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    operation: 'riskyOperation',
    userId: req.user.id,
  });
  throw error;
}
```

### Adding Context

```typescript
import {
  setSentryUser,
  setSentryWorkspace,
  setSentryPost,
} from './monitoring/sentry';

// Set user context
setSentryUser(user.id, user.email);

// Set workspace context
setSentryWorkspace(workspace.id);

// Set post context
setSentryPost(post.id);
```

### Adding Breadcrumbs

```typescript
import { addBreadcrumb } from './monitoring/sentry';

// Add breadcrumb for debugging
addBreadcrumb('User logged in', 'auth', {
  userId: user.id,
  method: 'email',
});

addBreadcrumb('Post created', 'post', {
  postId: post.id,
  workspaceId: workspace.id,
});
```

### Capturing Messages

```typescript
import { captureMessage } from './monitoring/sentry';

// Capture informational message
captureMessage('Payment processed successfully', 'info');

// Capture warning
captureMessage('Rate limit approaching', 'warning');
```

## Error Filtering

### Ignored Errors

The following errors are automatically ignored (not sent to Sentry):

**4xx Client Errors:**
- BadRequestError (400)
- UnauthorizedError (401)
- ForbiddenError (403)
- NotFoundError (404)
- ValidationError (422)

**Why?** Client errors are expected and don't indicate server issues.

### Captured Errors

The following errors are captured:

**5xx Server Errors:**
- InternalServerError (500)
- ServiceUnavailableError (503)
- Database errors
- External API errors
- Unhandled exceptions

## Context Tracking

Sentry automatically tracks:

### Request Context
- HTTP method
- URL path
- Query parameters
- Headers (sanitized)
- IP address

### User Context
- User ID
- Email
- Attached via `attachSentryContext` middleware

### Workspace Context
- Workspace ID
- Attached via `attachSentryContext` middleware

### Post Context
- Post ID (from route params)
- Attached via `attachSentryContext` middleware

## Performance Monitoring

Sentry tracks:
- Request duration
- Database query performance
- External API call duration
- Transaction traces

Sample rates:
- Production: 10% of requests
- Staging: 100% of requests

## Environment-Based Behavior

### Development
- Sentry disabled
- Errors logged to console only

### Test
- Sentry disabled
- Errors logged to test output

### Staging
- Sentry enabled
- 100% trace sampling
- All 5xx errors captured

### Production
- Sentry enabled
- 10% trace sampling
- All 5xx errors captured

## Best Practices

### 1. Don't Capture Expected Errors

```typescript
// ❌ Bad - Don't capture validation errors
try {
  validateInput(data);
} catch (error) {
  captureException(error); // Don't do this
  throw error;
}

// ✅ Good - Only capture unexpected errors
try {
  await externalApiCall();
} catch (error) {
  captureException(error); // Do this
  throw error;
}
```

### 2. Add Context for Debugging

```typescript
// ❌ Bad - No context
captureException(error);

// ✅ Good - With context
captureException(error, {
  operation: 'processPayment',
  userId: user.id,
  amount: payment.amount,
  provider: 'stripe',
});
```

### 3. Use Breadcrumbs

```typescript
// Add breadcrumbs to trace user actions
addBreadcrumb('User clicked publish', 'ui', { postId });
addBreadcrumb('Validating post content', 'validation');
addBreadcrumb('Uploading media', 'upload', { fileCount: 3 });
// If error occurs, breadcrumbs show the sequence
```

### 4. Set User Context Early

```typescript
// Set user context after authentication
app.use(requireAuth);
app.use((req, res, next) => {
  if (req.user) {
    setSentryUser(req.user.id, req.user.email);
  }
  next();
});
```

## Monitoring Dashboard

Access your Sentry dashboard at:
- https://sentry.io/organizations/[org]/issues/

Features:
- Real-time error tracking
- Error frequency and trends
- Stack traces with source maps
- User impact analysis
- Performance monitoring
- Release tracking

## Alerts

Configure alerts in Sentry dashboard:
- Email notifications
- Slack integration
- PagerDuty integration
- Custom webhooks

Recommended alerts:
- New error types
- Error spike (>10 errors/minute)
- Performance degradation
- High error rate (>5%)

## Privacy Considerations

Sentry automatically sanitizes:
- Passwords
- API keys
- Authorization headers
- Credit card numbers
- Social security numbers

Additional sanitization:
```typescript
Sentry.init({
  beforeSend(event) {
    // Remove sensitive data
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.creditCard;
    }
    return event;
  },
});
```

## Troubleshooting

### Sentry Not Capturing Errors

**Check:**
1. SENTRY_DSN configured?
2. NODE_ENV is production or staging?
3. Error is 5xx (not 4xx)?
4. Error not in ignored list?

### Too Many Errors

**Solutions:**
1. Increase error filtering
2. Fix underlying issues
3. Adjust sample rate
4. Set up error grouping

### Missing Context

**Check:**
1. `attachSentryContext` middleware added?
2. Middleware order correct?
3. Authentication middleware before Sentry context?

## Testing

Test Sentry integration:

```typescript
// Add test endpoint (remove in production)
app.get('/api/test/sentry', (req, res) => {
  throw new Error('Test Sentry error');
});

// Trigger test error
curl http://localhost:3000/api/test/sentry

// Check Sentry dashboard for error
```

## Cost Optimization

Sentry pricing based on:
- Number of errors
- Number of transactions
- Data retention

Optimization tips:
1. Filter 4xx errors (already done)
2. Reduce trace sample rate in production
3. Group similar errors
4. Set up error quotas
5. Archive old issues

## Migration from Other Tools

### From Rollbar

```typescript
// Before (Rollbar)
rollbar.error(error, { userId, workspaceId });

// After (Sentry)
captureException(error, { userId, workspaceId });
```

### From Bugsnag

```typescript
// Before (Bugsnag)
Bugsnag.notify(error, { userId, workspaceId });

// After (Sentry)
captureException(error, { userId, workspaceId });
```

## Next Steps

1. Install Sentry SDK: `npm install @sentry/node`
2. Get DSN from sentry.io
3. Add environment variables
4. Integrate with Express (see above)
5. Test error capture
6. Configure alerts
7. Monitor dashboard
8. Optimize based on usage
