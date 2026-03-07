# Audit Logger Utility

## Overview

Lightweight, fail-safe audit logging utility for tracking important actions.

**File**: `apps/backend/src/utils/auditLogger.ts`

## Features

✅ Non-blocking (fire-and-forget)
✅ Fail-safe (never throws errors)
✅ Minimal overhead
✅ Automatic IP and user agent extraction
✅ Type-safe
✅ Lazy-loaded model (avoids circular dependencies)
✅ Batch logging support
✅ Scoped logger support

## Usage

### Basic Logging

```typescript
import { logAudit, AuditActions, EntityTypes } from '@/utils/auditLogger';

// Log a post deletion
logAudit({
  userId: req.user.id,
  workspaceId: req.workspace.id,
  action: AuditActions.POST_DELETED,
  entityType: EntityTypes.POST,
  entityId: postId,
});
```

### With Request Context

```typescript
// Automatically extracts IP address and user agent
logAudit({
  userId: req.user.id,
  workspaceId: req.workspace.id,
  action: AuditActions.POST_DELETED,
  entityType: EntityTypes.POST,
  entityId: postId,
  metadata: {
    postTitle: post.title,
    scheduledAt: post.scheduledAt,
  },
  req, // Extracts IP and user agent
});
```

### With Metadata

```typescript
logAudit({
  userId: req.user.id,
  workspaceId: req.workspace.id,
  action: AuditActions.MEMBER_ROLE_CHANGED,
  entityType: EntityTypes.MEMBER,
  entityId: memberId,
  metadata: {
    oldRole: 'member',
    newRole: 'admin',
    changedBy: req.user.id,
  },
  req,
});
```

### Batch Logging

```typescript
import { logAuditBatch, AuditActions, EntityTypes } from '@/utils/auditLogger';

// Log multiple actions at once
logAuditBatch([
  {
    userId: req.user.id,
    workspaceId: req.workspace.id,
    action: AuditActions.POST_DELETED,
    entityType: EntityTypes.POST,
    entityId: post1.id,
    req,
  },
  {
    userId: req.user.id,
    workspaceId: req.workspace.id,
    action: AuditActions.POST_DELETED,
    entityType: EntityTypes.POST,
    entityId: post2.id,
    req,
  },
]);
```

### Scoped Logger

```typescript
import { createAuditLogger, AuditActions, EntityTypes } from '@/utils/auditLogger';

// Create a scoped logger with common context
const auditLogger = createAuditLogger({
  userId: req.user.id,
  workspaceId: req.workspace.id,
  req,
});

// Later in the same request
auditLogger.log({
  action: AuditActions.POST_DELETED,
  entityType: EntityTypes.POST,
  entityId: postId,
});

auditLogger.log({
  action: AuditActions.MEDIA_DELETED,
  entityType: EntityTypes.MEDIA,
  entityId: mediaId,
});
```

## API

### `logAudit(data)`

Log a single audit entry.

**Parameters**:
- `userId` (string | ObjectId, required) - User performing the action
- `workspaceId` (string | ObjectId, required) - Workspace context
- `action` (string, required) - Action being performed (use AuditActions constants)
- `entityType` (string, required) - Type of entity (use EntityTypes constants)
- `entityId` (string, optional) - ID of the entity
- `metadata` (object, optional) - Additional context
- `req` (Express Request, optional) - Automatically extracts IP and user agent
- `ipAddress` (string, optional) - Manual IP address (overrides req)
- `userAgent` (string, optional) - Manual user agent (overrides req)

**Returns**: void (fire-and-forget)

### `logAuditBatch(entries)`

Log multiple audit entries at once.

**Parameters**:
- `entries` (array, required) - Array of audit log data objects

**Returns**: void (fire-and-forget)

### `createAuditLogger(context)`

Create a scoped logger with pre-filled context.

**Parameters**:
- `context` (object, required):
  - `userId` (string | ObjectId, required)
  - `workspaceId` (string | ObjectId, required)
  - `req` (Express Request, optional)

**Returns**: Scoped logger with `log(data)` method

## Action Constants

Use predefined action constants for consistency:

```typescript
import { AuditActions } from '@/utils/auditLogger';

// Post actions
AuditActions.POST_CREATED
AuditActions.POST_UPDATED
AuditActions.POST_DELETED
AuditActions.POST_PUBLISHED
AuditActions.POST_SCHEDULED
AuditActions.POST_CANCELLED

// Workspace actions
AuditActions.WORKSPACE_CREATED
AuditActions.WORKSPACE_UPDATED
AuditActions.WORKSPACE_DELETED

// Member actions
AuditActions.MEMBER_ADDED
AuditActions.MEMBER_REMOVED
AuditActions.MEMBER_ROLE_CHANGED
AuditActions.MEMBER_INVITED

// Billing actions
AuditActions.BILLING_UPDATED
AuditActions.SUBSCRIPTION_CREATED
AuditActions.SUBSCRIPTION_CANCELLED
AuditActions.SUBSCRIPTION_UPGRADED
AuditActions.SUBSCRIPTION_DOWNGRADED

// Social account actions
AuditActions.SOCIAL_ACCOUNT_CONNECTED
AuditActions.SOCIAL_ACCOUNT_DISCONNECTED
AuditActions.SOCIAL_ACCOUNT_REFRESHED

// Media actions
AuditActions.MEDIA_UPLOADED
AuditActions.MEDIA_DELETED

// Auth actions
AuditActions.USER_LOGIN
AuditActions.USER_LOGOUT
AuditActions.USER_PASSWORD_CHANGED
AuditActions.USER_EMAIL_CHANGED
```

## Entity Type Constants

```typescript
import { EntityTypes } from '@/utils/auditLogger';

EntityTypes.POST
EntityTypes.WORKSPACE
EntityTypes.MEMBER
EntityTypes.BILLING
EntityTypes.SUBSCRIPTION
EntityTypes.SOCIAL_ACCOUNT
EntityTypes.MEDIA
EntityTypes.USER
```

## Behavior

### Non-Blocking

The logger uses `setImmediate()` to defer execution, ensuring it never blocks the main request flow:

```typescript
logAudit({ ... }); // Returns immediately
// Request continues without waiting
```

### Fail-Safe

The logger never throws errors. If logging fails, it logs the error and continues:

```typescript
try {
  await AuditLog.log({ ... });
} catch (error) {
  logger.error('Failed to create audit log (non-critical)', { error });
  // Never throws - request continues normally
}
```

### IP Address Extraction

Automatically extracts IP address from request, handling proxies and load balancers:

1. Check `X-Forwarded-For` header (proxies/load balancers)
2. Check `X-Real-IP` header (nginx)
3. Fallback to `req.ip`

### User Agent Extraction

Automatically extracts user agent from `User-Agent` header.

## Integration Examples

### Controller Integration

```typescript
// In PostController.deletePost()
export async function deletePost(req: Request, res: Response) {
  const { postId } = req.params;
  
  // Delete post
  await postService.deletePost(postId);
  
  // Log audit entry (non-blocking)
  logAudit({
    userId: req.user.id,
    workspaceId: req.workspace.id,
    action: AuditActions.POST_DELETED,
    entityType: EntityTypes.POST,
    entityId: postId,
    metadata: {
      postTitle: post.title,
      scheduledAt: post.scheduledAt,
    },
    req,
  });
  
  res.json({ success: true });
}
```

### Service Integration

```typescript
// In WorkspaceService.removeMember()
export async function removeMember(
  workspaceId: string,
  memberId: string,
  removedBy: string,
  req?: Request
) {
  // Remove member
  await WorkspaceMember.deleteOne({ _id: memberId });
  
  // Log audit entry
  logAudit({
    userId: removedBy,
    workspaceId,
    action: AuditActions.MEMBER_REMOVED,
    entityType: EntityTypes.MEMBER,
    entityId: memberId,
    metadata: {
      removedBy,
    },
    req,
  });
}
```

### Middleware Integration

```typescript
// Automatic audit logging middleware
export function auditMiddleware(action: string, entityType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        logAudit({
          userId: req.user.id,
          workspaceId: req.workspace.id,
          action,
          entityType,
          entityId: req.params.id,
          req,
        });
      }
    });
    next();
  };
}

// Usage
router.delete('/posts/:id', auditMiddleware(AuditActions.POST_DELETED, EntityTypes.POST), deletePost);
```

## Performance

- **Overhead**: Minimal (fire-and-forget)
- **Blocking**: None (uses setImmediate)
- **Memory**: Low (lazy-loaded model)
- **Database**: Single insert per log (batch for multiple)

## Best Practices

1. **Always use constants**:
   ```typescript
   // Good
   logAudit({ action: AuditActions.POST_DELETED, ... });
   
   // Bad
   logAudit({ action: 'post.deleted', ... });
   ```

2. **Include relevant metadata**:
   ```typescript
   logAudit({
     action: AuditActions.MEMBER_ROLE_CHANGED,
     metadata: {
       oldRole: 'member',
       newRole: 'admin',
       changedBy: req.user.id,
     },
   });
   ```

3. **Pass request object when available**:
   ```typescript
   logAudit({ ..., req }); // Automatically extracts IP and user agent
   ```

4. **Use batch logging for bulk operations**:
   ```typescript
   logAuditBatch(posts.map(post => ({ ... })));
   ```

5. **Use scoped logger for multiple logs in same request**:
   ```typescript
   const auditLogger = createAuditLogger({ userId, workspaceId, req });
   auditLogger.log({ action: AuditActions.POST_DELETED, ... });
   auditLogger.log({ action: AuditActions.MEDIA_DELETED, ... });
   ```

## Debugging

Enable debug logging in development:

```typescript
// Set NODE_ENV=development
logAudit({ ... });
// Logs: "Audit log created { action: 'post.deleted', entityType: 'post', entityId: '123' }"
```

## Error Handling

If audit logging fails, the error is logged but never thrown:

```typescript
// If database is down or model fails
logAudit({ ... });
// Logs: "Failed to create audit log (non-critical) { error: '...', action: '...', ... }"
// Request continues normally
```

## Status

✅ Utility created
✅ Non-blocking implementation
✅ Fail-safe error handling
✅ IP and user agent extraction
✅ Batch logging support
✅ Scoped logger support
✅ Type-safe
✅ Code compiles cleanly
⏸️ Integration pending (not done yet)
