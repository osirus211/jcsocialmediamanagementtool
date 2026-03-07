# Audit Log Model

## Overview

Lightweight audit logging system for tracking important actions in the application.

**File**: `apps/backend/src/models/AuditLog.ts`

## Features

✅ Write-only (optimized for fast writes)
✅ Indexed by workspaceId and createdAt
✅ No heavy relations
✅ Simple and fast
✅ Flexible metadata storage
✅ Optional TTL for auto-deletion
✅ Batch insert support

## Schema

```typescript
{
  userId: ObjectId (required, indexed)
  workspaceId: ObjectId (required, indexed)
  action: string (required, indexed)
  entityType: string (required, indexed)
  entityId: string (optional, indexed)
  metadata: object (optional)
  ipAddress: string (optional)
  userAgent: string (optional)
  createdAt: Date (required, indexed)
}
```

## Indexes

Optimized for common query patterns:

1. `{ workspaceId: 1, createdAt: -1 }` - Query by workspace and time
2. `{ workspaceId: 1, action: 1, createdAt: -1 }` - Query by workspace, action, and time
3. `{ workspaceId: 1, entityType: 1, createdAt: -1 }` - Query by workspace, entity type, and time
4. `{ workspaceId: 1, entityId: 1, createdAt: -1 }` - Query by workspace, entity, and time
5. `{ userId: 1, createdAt: -1 }` - Query by user and time

## Usage

### Basic Logging

```typescript
import { AuditLog, AuditActions, EntityTypes } from '@/models/AuditLog';

// Log a post deletion
await AuditLog.log({
  userId: req.user.id,
  workspaceId: req.workspace.id,
  action: AuditActions.POST_DELETED,
  entityType: EntityTypes.POST,
  entityId: postId,
  metadata: {
    postTitle: post.title,
    scheduledAt: post.scheduledAt,
  },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

### Batch Logging

```typescript
// Log multiple actions at once
await AuditLog.logBatch([
  {
    userId: req.user.id,
    workspaceId: req.workspace.id,
    action: AuditActions.POST_DELETED,
    entityType: EntityTypes.POST,
    entityId: post1.id,
  },
  {
    userId: req.user.id,
    workspaceId: req.workspace.id,
    action: AuditActions.POST_DELETED,
    entityType: EntityTypes.POST,
    entityId: post2.id,
  },
]);
```

### Query Logs (Simple)

```typescript
// Get recent logs for a workspace
const logs = await AuditLog.find({
  workspaceId: workspaceId,
})
  .sort({ createdAt: -1 })
  .limit(100);

// Get logs for a specific action
const deletionLogs = await AuditLog.find({
  workspaceId: workspaceId,
  action: AuditActions.POST_DELETED,
})
  .sort({ createdAt: -1 })
  .limit(50);

// Get logs for a specific entity
const postLogs = await AuditLog.find({
  workspaceId: workspaceId,
  entityType: EntityTypes.POST,
  entityId: postId,
})
  .sort({ createdAt: -1 });
```

## Action Types

Use the predefined action constants for consistency:

```typescript
import { AuditActions } from '@/models/AuditLog';

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

## Entity Types

Use the predefined entity type constants:

```typescript
import { EntityTypes } from '@/models/AuditLog';

EntityTypes.POST
EntityTypes.WORKSPACE
EntityTypes.MEMBER
EntityTypes.BILLING
EntityTypes.SUBSCRIPTION
EntityTypes.SOCIAL_ACCOUNT
EntityTypes.MEDIA
EntityTypes.USER
```

## Metadata Examples

### Post Deletion
```typescript
metadata: {
  postTitle: 'My Post',
  scheduledAt: '2024-01-15T10:00:00Z',
  platform: 'twitter',
}
```

### Member Role Change
```typescript
metadata: {
  oldRole: 'member',
  newRole: 'admin',
  changedBy: 'user123',
}
```

### Billing Update
```typescript
metadata: {
  oldPlan: 'free',
  newPlan: 'pro',
  amount: 29.99,
  currency: 'USD',
}
```

### Social Account Connection
```typescript
metadata: {
  provider: 'twitter',
  accountName: '@username',
  accountId: 'twitter123',
}
```

## TTL (Time-To-Live)

To automatically delete old audit logs, uncomment the TTL index in the model:

```typescript
// Delete logs older than 90 days (7776000 seconds)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
```

Adjust `expireAfterSeconds` as needed:
- 30 days: 2592000
- 60 days: 5184000
- 90 days: 7776000
- 180 days: 15552000
- 365 days: 31536000

## Performance Considerations

1. **Write-only design**: Optimized for fast writes, not complex queries
2. **Indexed fields**: All common query patterns are indexed
3. **No relations**: No population needed, keeps queries fast
4. **Batch inserts**: Use `logBatch()` for bulk operations
5. **TTL index**: Optional auto-deletion to prevent unbounded growth

## Best Practices

1. **Always log sensitive actions**:
   - Post deletions
   - Member removals
   - Billing changes
   - Workspace deletions

2. **Include relevant metadata**:
   - Old and new values for updates
   - Reason for action (if available)
   - Related entity IDs

3. **Capture request context**:
   - IP address
   - User agent
   - Request ID (in metadata)

4. **Use constants**:
   - Use `AuditActions` for action names
   - Use `EntityTypes` for entity types
   - Ensures consistency

5. **Don't log everything**:
   - Focus on important actions
   - Avoid logging read operations
   - Avoid logging high-frequency events

## Integration (Not Done Yet)

To integrate audit logging into your application:

1. **Create audit logging service** (optional):
   ```typescript
   // apps/backend/src/services/AuditLogService.ts
   export class AuditLogService {
     static async log(data) {
       return AuditLog.log(data);
     }
   }
   ```

2. **Add to controllers**:
   ```typescript
   // After successful action
   await AuditLog.log({
     userId: req.user.id,
     workspaceId: req.workspace.id,
     action: AuditActions.POST_DELETED,
     entityType: EntityTypes.POST,
     entityId: postId,
     ipAddress: req.ip,
     userAgent: req.headers['user-agent'],
   });
   ```

3. **Add to middleware** (optional):
   ```typescript
   // Automatic logging for certain routes
   export const auditMiddleware = (action: string, entityType: string) => {
     return async (req, res, next) => {
       res.on('finish', async () => {
         if (res.statusCode < 400) {
           await AuditLog.log({
             userId: req.user.id,
             workspaceId: req.workspace.id,
             action,
             entityType,
             entityId: req.params.id,
             ipAddress: req.ip,
             userAgent: req.headers['user-agent'],
           });
         }
       });
       next();
     };
   };
   ```

## Querying Examples

### Get recent activity for a workspace
```typescript
const recentActivity = await AuditLog.find({
  workspaceId: workspaceId,
})
  .sort({ createdAt: -1 })
  .limit(50)
  .lean();
```

### Get all actions by a user
```typescript
const userActivity = await AuditLog.find({
  userId: userId,
  workspaceId: workspaceId,
})
  .sort({ createdAt: -1 })
  .lean();
```

### Get all deletions in a time range
```typescript
const deletions = await AuditLog.find({
  workspaceId: workspaceId,
  action: { $regex: /\.deleted$/ },
  createdAt: {
    $gte: new Date('2024-01-01'),
    $lte: new Date('2024-01-31'),
  },
})
  .sort({ createdAt: -1 })
  .lean();
```

### Get audit trail for a specific entity
```typescript
const entityAudit = await AuditLog.find({
  workspaceId: workspaceId,
  entityType: EntityTypes.POST,
  entityId: postId,
})
  .sort({ createdAt: 1 }) // Chronological order
  .lean();
```

## Security Considerations

1. **Access control**: Only workspace owners/admins should view audit logs
2. **PII protection**: Be careful with metadata (don't log passwords, tokens, etc.)
3. **Retention policy**: Use TTL to comply with data retention policies
4. **Immutable**: Audit logs should never be updated or deleted manually

## Status

✅ Model created
✅ Indexes defined
✅ Static methods implemented
✅ Constants defined
✅ Documentation complete
⏸️ Integration pending (not done yet)
