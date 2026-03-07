# Instagram Business OAuth Connection Feature

This feature provides a guided, user-friendly flow for connecting Instagram Business accounts via Facebook OAuth.

## Features

- ✅ Pre-connection checklist to ensure users meet requirements
- ✅ Step-by-step setup instructions (mobile & web)
- ✅ Real-time connection progress tracking
- ✅ OAuth state validation and security
- ✅ Automatic account discovery
- ✅ Account selection with multi-select support
- ✅ Error categorization and user-friendly messages
- ✅ Diagnostic panel with actionable guidance
- ✅ Retry functionality with attempt tracking
- ⏳ Token expiration warnings (coming in Phase 4)
- ⏳ Reconnection support (coming in Phase 4)

## Phase 1, 2 & 3 Complete ✅

### Implemented Components

1. **PreConnectionChecklist** - Ensures users meet Instagram Business requirements
2. **SetupInstructionsModal** - Provides detailed setup guidance
3. **ConnectionFlowOrchestrator** - Displays connection progress
4. **InstagramConnectionFlow** - Main integration component
5. **AccountSelectionDialog** - Select which accounts to connect ✨ NEW
6. **DiagnosticPanel** - Error diagnostics with actionable steps ✨ NEW
7. **InstagramConnectionStore** - Zustand state management
8. **InstagramConnectionService** - API integration layer
9. **Error Categorization** - Smart error detection and messaging ✨ NEW

### Test Coverage

- 80 unit tests passing ✅
- 2 optional property tests (can be improved later)
- All TypeScript types validated ✅
- Components: PreConnectionChecklist (15), SetupInstructionsModal (21), AccountSelectionDialog (16), InstagramConnectionFlow (4)
- Store: InstagramConnectionStore (24)

## Usage

### Basic Integration

```tsx
import { InstagramConnectionFlow } from '@/features/instagram-connection';

function ConnectInstagramPage() {
  const handleComplete = () => {
    console.log('Instagram connection complete!');
    // Navigate to accounts page or show success message
  };

  return (
    <div>
      <h1>Connect Instagram Business Account</h1>
      <InstagramConnectionFlow onComplete={handleComplete} />
    </div>
  );
}
```

### Using Individual Components

```tsx
import {
  PreConnectionChecklist,
  ConnectionFlowOrchestrator,
  useInstagramConnectionStore,
} from '@/features/instagram-connection';

function CustomConnectionFlow() {
  const { connectionState, startConnection } = useInstagramConnectionStore();

  return (
    <div>
      <PreConnectionChecklist onProceed={startConnection} />
      <ConnectionFlowOrchestrator
        connectionState={connectionState}
        onComplete={() => console.log('Done!')}
        onError={(error) => console.error('Error:', error)}
      />
    </div>
  );
}
```

### Direct Store Access

```tsx
import { useInstagramConnectionStore } from '@/features/instagram-connection';

function MyComponent() {
  const {
    checklistCompleted,
    connectionState,
    discoveredAccounts,
    lastError,
    startConnection,
    handleOAuthCallback,
  } = useInstagramConnectionStore();

  // Use store state and actions directly
}
```

## OAuth Flow

1. User completes pre-connection checklist
2. User clicks "Proceed" → `startConnection()` is called
3. Store generates OAuth state and redirects to Facebook
4. User authorizes on Facebook
5. Facebook redirects back with `code` and `state` parameters
6. `InstagramConnectionFlow` detects callback and calls `handleOAuthCallback()`
7. Store validates state, exchanges code for token, discovers accounts
8. Connection complete! Accounts are displayed

## API Endpoints Used

- `POST /oauth/instagram/authorize` - Get OAuth authorization URL
- `GET /social/accounts?platform=instagram&recent=true` - Check connection status and get accounts

## Security Features

- ✅ Cryptographically secure OAuth state parameter (256-bit)
- ✅ State validation to prevent CSRF attacks
- ✅ State expiration (5 minutes)
- ✅ sessionStorage for temporary state storage
- ✅ Automatic URL cleanup after callback

## Next Steps (Phase 4+)

- [ ] TokenExpirationWarning - Warn users about expiring tokens
- [ ] Reconnection guidance - Help users reconnect failed accounts
- [ ] Permission validation - Ensure required permissions are granted
- [ ] Help documentation - Comprehensive troubleshooting guide
- [ ] Integration with existing UI - Wire into account management pages

## File Structure

```
src/features/instagram-connection/
├── components/
│   ├── PreConnectionChecklist.tsx
│   ├── SetupInstructionsModal.tsx
│   ├── ConnectionFlowOrchestrator.tsx
│   ├── InstagramConnectionFlow.tsx
│   └── __tests__/
├── store/
│   ├── instagram-connection.store.ts
│   └── __tests__/
├── services/
│   └── instagram-connection.service.ts
├── types/
│   ├── connection.types.ts
│   ├── store.types.ts
│   └── index.ts
├── test/
│   └── arbitraries.ts
├── index.ts
└── README.md (this file)
```

## Requirements Mapping

This implementation satisfies:
- Requirements 1.1-1.4: Pre-connection validation ✅
- Requirements 2.1-2.6: Setup instructions ✅
- Requirements 5.1-5.6: Connection flow orchestration ✅
- Requirements 10.1-10.5: Permission validation (partial) ✅

See `.kiro/specs/instagram-business-oauth-via-facebook/requirements.md` for full requirements.
