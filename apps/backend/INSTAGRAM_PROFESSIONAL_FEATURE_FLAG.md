# Instagram Professional Provider Feature Flag

## Overview

The `USE_INSTAGRAM_PROFESSIONAL` feature flag controls which Instagram OAuth provider is used for account connections.

## Configuration

Add to your `.env` file:

```env
USE_INSTAGRAM_PROFESSIONAL=false
```

## Behavior

### When `false` (default - production behavior)
- Uses existing dual-provider system:
  - `InstagramBusinessProvider` (via Facebook Login)
  - `InstagramBasicDisplayProvider` (via Instagram Login for personal accounts)
- Maintains backward compatibility
- No changes to production behavior

### When `true` (new unified provider)
- Uses new `InstagramProfessionalProvider`
- Direct Instagram API with Instagram Login
- Supports Instagram Professional accounts only
- Simplified OAuth flow (no Facebook Pages required)
- Uses new scopes:
  - `instagram_business_basic`
  - `instagram_business_content_publish`
  - `instagram_business_manage_comments`
  - `instagram_business_manage_messages`

## Testing

### Enable in Staging
```bash
# In apps/backend/.env
USE_INSTAGRAM_PROFESSIONAL=true
```

### Test OAuth Flow
1. Navigate to Connect Accounts
2. Select Instagram
3. Authorize with Instagram Professional account
4. Verify account connects successfully
5. Test publishing content

## Rollback

To rollback to old providers:
```bash
# In apps/backend/.env
USE_INSTAGRAM_PROFESSIONAL=false
```

Restart the backend service. No database changes needed.

## Implementation Details

- **File**: `apps/backend/src/services/oauth/InstagramOAuthService.ts`
- **Provider**: `apps/backend/src/services/oauth/InstagramProfessionalProvider.ts`
- **Phase**: Phase 1 - Parallel Support
- **Risk**: LOW (isolated implementation, no breaking changes)

## Next Steps

After successful testing in staging:
1. Enable in production with monitoring
2. Track OAuth success rates
3. Monitor for errors
4. Proceed to Phase 2 (OAuth Migration) when stable
