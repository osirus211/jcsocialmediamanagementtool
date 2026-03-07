# Instagram OAuth Flow Documentation

## Overview

The Instagram OAuth flow uses a **server-side callback** architecture where the backend handles the complete OAuth process and redirects to the frontend with the result.

## Flow Diagram

```
User → Frontend → Backend → Facebook → Backend → Frontend
  1      2          3          4          5          6
```

## Detailed Steps

### 1. User Initiates Connection (Frontend)
- User completes pre-connection checklist
- User clicks "Proceed to Connect"
- Frontend calls `startConnection()` in the store

### 2. Frontend Requests OAuth URL (Frontend → Backend)
- **Endpoint**: `POST /api/v1/oauth/instagram/authorize`
- **Request**: Empty body (uses authenticated user/workspace from JWT)
- **Response**:
  ```json
  {
    "success": true,
    "authorizationUrl": "https://www.facebook.com/v19.0/dialog/oauth?...",
    "state": "256-bit-secure-state",
    "platform": "instagram"
  }
  ```
- Frontend stores state in sessionStorage
- Frontend redirects user to `authorizationUrl`

### 3. User Authorizes on Facebook (Facebook OAuth)
- User logs into Facebook (if not already logged in)
- User grants permissions to the app
- Facebook redirects to backend callback URL

### 4. Facebook Redirects to Backend Callback
- **Redirect URL**: `http://localhost:5000/api/v1/oauth/instagram/callback?code=...&state=...`
- Backend receives authorization code and state

### 5. Backend Processes Callback
The backend performs the following steps:

#### 5.1 Validate State
- Retrieves state from Redis
- Validates state matches
- Checks IP binding
- Consumes state (single-use)

#### 5.2 Exchange Code for Token
- Calls Facebook Graph API token endpoint
- Receives access token and refresh token
- Stores tokens securely (encrypted)

#### 5.3 Discover Instagram Business Accounts
- Calls Facebook Graph API to get user's Facebook Pages
- For each page, checks if it has a linked Instagram Business account
- Fetches Instagram account details (username, followers, etc.)

#### 5.4 Save Accounts to Database
- Creates `SocialAccount` documents for each discovered account
- Encrypts and stores access tokens
- Sets account status to ACTIVE

#### 5.5 Redirect to Frontend
- **Success**: `http://localhost:5173/social/accounts?success=true&platform=instagram&count=2`
- **Error**: `http://localhost:5173/social/accounts?error=INSTAGRAM_OAUTH_FAILED&message=...`

### 6. Frontend Handles Callback Result
The `InstagramConnectionFlow` component detects the callback parameters:

#### Success Callback
```typescript
// URL: /social/accounts?success=true&platform=instagram&count=2

// Component detects success
if (success === 'true' && platform === 'instagram') {
  // Update store to show success
  store.setConnectionState({
    step: 'complete',
    progress: 100,
    message: 'Successfully connected 2 Instagram accounts!',
  });
  
  // Trigger onComplete callback
  onComplete();
}
```

#### Error Callback
```typescript
// URL: /social/accounts?error=INSTAGRAM_OAUTH_FAILED&message=No+accounts+found

// Component detects error
if (error) {
  // Categorize error
  const categorizedError = categorizeError(new Error(message));
  
  // Update store with error
  store.setError(categorizedError);
  
  // DiagnosticPanel displays error with guidance
}
```

## Backend Configuration

### Environment Variables
```bash
# Instagram OAuth (uses Facebook App)
INSTAGRAM_CLIENT_ID=1201349047500191
INSTAGRAM_CLIENT_SECRET=67867ce028f802173aa9824cdeede653
INSTAGRAM_CALLBACK_URL=http://localhost:5000/api/v1/oauth/instagram/callback

# Frontend URL for redirects
FRONTEND_URL=http://localhost:5173
```

### Facebook App Configuration
The Instagram OAuth uses Facebook Login with the following scopes:
- `instagram_basic` - Read basic Instagram account info
- `instagram_content_publish` - Publish content to Instagram
- `pages_show_list` - List Facebook Pages
- `pages_read_engagement` - Read Page engagement data
- `public_profile` - Read public profile info

## Security Features

### State Parameter
- 256-bit cryptographically secure random string
- Stored in Redis with 5-minute expiration
- Bound to user's IP address
- Single-use (deleted after consumption)
- Prevents CSRF and replay attacks

### Token Storage
- Access tokens encrypted using AES-256-GCM
- Encryption key stored in environment variable
- Tokens never exposed to frontend
- Refresh tokens stored for token renewal

### IP Binding
- State parameter bound to user's IP hash
- Callback validates IP matches original request
- Prevents session hijacking

## Error Handling

### Error Categories
1. **no_accounts** - No Instagram Business accounts found
2. **no_pages** - No Facebook Pages found
3. **no_instagram_linked** - Instagram not linked to Facebook Page
4. **permission_denied** - User denied required permissions
5. **personal_account** - Instagram account is personal, not business
6. **token_exchange_failed** - Failed to exchange code for token
7. **network_error** - Network connection failed
8. **unknown** - Unexpected error

### Error Flow
```
Backend Error → Frontend Redirect → Error Categorization → DiagnosticPanel
```

## Console Logging

The backend logs detailed information for debugging:

```
=== INSTAGRAM CALLBACK ===
Token exchange: SUCCESS
User fetch: SUCCESS
DB insert: SUCCESS
Accounts connected: 2
=== DEBUG REPORT ===
{
  "callbackHit": true,
  "codePresent": true,
  "stateValid": true,
  "tokenExchangeSuccess": true,
  "userFetched": true,
  "dbInsertSuccess": true,
  "finalResponseStatus": 302
}
=== END INSTAGRAM CALLBACK ===
```

## Testing

### Unit Tests
- 80 tests covering all components and flows
- Mock service responses for isolated testing
- Test both success and error scenarios

### Integration Testing
To test the full OAuth flow:

1. Start backend: `cd apps/backend && npm run dev`
2. Start frontend: `cd apps/frontend && npm run dev`
3. Navigate to Instagram connection page
4. Complete checklist and click "Proceed"
5. Authorize on Facebook
6. Check console logs for callback details
7. Verify accounts appear in `/social/accounts`

## Troubleshooting

### No Accounts Found
- Ensure Instagram account is Business or Creator type
- Verify Instagram is linked to a Facebook Page
- Check that you have admin access to the Facebook Page

### Token Exchange Failed
- Verify `INSTAGRAM_CLIENT_SECRET` is correct
- Check that callback URL matches Facebook App settings
- Ensure Facebook App is not in development mode restrictions

### State Invalid
- Check Redis is running and accessible
- Verify state hasn't expired (5-minute window)
- Ensure IP address hasn't changed during OAuth flow

## Future Enhancements

### Phase 4 (Planned)
- Token expiration warnings
- Automatic token refresh
- Reconnection guidance for failed accounts
- Permission validation UI
- Help documentation integration
