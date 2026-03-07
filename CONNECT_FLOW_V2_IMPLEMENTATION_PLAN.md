# Connect Flow V2 - Implementation Branch Plan

**Date**: 2026-02-27  
**Strategy**: Isolated V2 Implementation with Route Toggle  
**Principle**: Zero Impact on Legacy Flow  

---

## IMPLEMENTATION STRATEGY

### Core Principles

1. **Complete Isolation**: V2 code lives in separate files/directories
2. **Independent Testing**: V2 can be tested without affecting V1
3. **Route-Based Toggle**: V2 accessible via different route
4. **Zero Legacy Modification**: No changes to existing OAuth flow
5. **Gradual Migration**: Can run both flows simultaneously

### Directory Structure

```
apps/backend/src/
├── controllers/
│   ├── OAuthController.ts          # V1 - DO NOT MODIFY
│   └── OAuthControllerV2.ts        # V2 - NEW
├── services/
│   ├── oauth/                      # V1 - DO NOT MODIFY
│   └── oauth-v2/                   # V2 - NEW
│       ├── TokenEncryptionService.ts
│       ├── KMSClient.ts
│       ├── StateValidationService.ts
│       ├── OAuthManagerV2.ts
│       └── providers/
├── routes/
│   └── v1/
│       ├── oauth.routes.ts         # V1 - DO NOT MODIFY
│       └── oauth-v2.routes.ts      # V2 - NEW
└── middleware/
    └── oauth-v2/                   # V2 - NEW
        ├── stateValidation.ts
        └── distributedLock.ts

apps/frontend/src/
├── components/
│   ├── social/                     # V1 - DO NOT MODIFY
│   └── connect-v2/                 # V2 - NEW
│       ├── ConnectChannelModal.tsx
│       ├── PlatformSelector.tsx
│       ├── LoadingScreen.tsx
│       ├── AccountPicker.tsx
│       ├── SuccessScreen.tsx
│       └── ErrorScreen.tsx
├── pages/
│   ├── social/                     # V1 - DO NOT MODIFY
│   └── connect-v2/                 # V2 - NEW
│       └── ConnectChannelV2.tsx
├── services/
│   ├── social.service.ts           # V1 - DO NOT MODIFY
│   └── oauth-v2.service.ts         # V2 - NEW
├── machines/
│   └── connectChannelMachine.ts    # V2 - NEW (XState)
└── hooks/
    └── useConnectChannelV2.ts      # V2 - NEW
```

---

## PHASE 1: BACKEND FOUNDATION

### Step 1.1: Create V2 Services Directory

**Action**: Create isolated services for V2

**Files to Create**:

```
apps/backend/src/services/oauth-v2/
├── TokenEncryptionService.ts
├── KMSClient.ts
├── StateValidationService.ts
├── OAuthManagerV2.ts
└── providers/
    ├── TwitterOAuthProviderV2.ts
    ├── LinkedInOAuthProviderV2.ts
    ├── FacebookOAuthProviderV2.ts
    └── InstagramOAuthProviderV2.ts
```

### Step 1.2: Create OAuthControllerV2

**File**: `apps/backend/src/controllers/OAuthControllerV2.ts`

**Key Features**:
- Bank-grade state validation
- Distributed locking
- MongoDB transactions
- Envelope encryption
- Security audit logging

**Endpoints**:
- `POST /api/v1/oauth-v2/:platform/authorize` - Initiate OAuth
- `GET /api/v1/oauth-v2/:platform/callback` - Handle callback
- `POST /api/v1/oauth-v2/:platform/finalize` - Finalize multi-account
- `GET /api/v1/oauth-v2/platforms` - Get available platforms

### Step 1.3: Create V2 Routes

**File**: `apps/backend/src/routes/v1/oauth-v2.routes.ts`

**Mount Point**: `/api/v1/oauth-v2`

**Isolation**: Completely separate from `/api/v1/oauth`

### Step 1.4: Register V2 Routes

**File**: `apps/backend/src/routes/v1/index.ts`

**Change**:
```typescript
import oauthV2Routes from './oauth-v2.routes';

// Add to router
router.use('/oauth-v2', oauthV2Routes);
```

**Impact**: Zero - adds new route, doesn't modify existing

---

## PHASE 2: FRONTEND FOUNDATION

### Step 2.1: Create V2 Components Directory

**Action**: Create isolated component tree

**Files to Create**:
```
apps/frontend/src/components/connect-v2/
├── index.ts
├── ConnectChannelModal.tsx
├── PlatformSelector.tsx
├── PlatformTile.tsx
├── LoadingScreen.tsx
├── Spinner.tsx
├── ProgressBar.tsx
├── AccountPicker.tsx
├── AccountCard.tsx
├── SuccessScreen.tsx
├── SuccessAnimation.tsx
├── ErrorScreen.tsx
└── ErrorIcon.tsx
```

### Step 2.2: Create State Machine

**File**: `apps/frontend/src/machines/connectChannelMachine.ts`

**Technology**: XState

**States**: idle, selecting_platform, redirecting, oauth_processing, validating_token, selecting_sub_account, finalizing, success, failure

### Step 2.3: Create V2 Service

**File**: `apps/frontend/src/services/oauth-v2.service.ts`

**API Endpoints**:
- `POST /api/v1/oauth-v2/:platform/authorize`
- `GET /api/v1/oauth-v2/:platform/callback`
- `POST /api/v1/oauth-v2/:platform/finalize`

### Step 2.4: Create V2 Page

**File**: `apps/frontend/src/pages/connect-v2/ConnectChannelV2.tsx`

**Route**: `/connect-v2` (NEW - doesn't conflict with `/social/accounts`)

### Step 2.5: Register V2 Route

**File**: `apps/frontend/src/app/router.tsx`

**Change**:
```typescript
import { ConnectChannelV2Page } from '@/pages/connect-v2/ConnectChannelV2';

// Add to router children
{
  path: 'connect-v2',
  element: <ConnectChannelV2Page />,
}
```

**Impact**: Zero - adds new route, doesn't modify existing

---

## PHASE 3: IMPLEMENTATION CHECKLIST

### Backend Implementation

#### 3.1 Token Encryption Service
- [ ] Create `TokenEncryptionService.ts`
- [ ] Implement envelope encryption (DEK + KEK)
- [ ] Implement AES-256-GCM
- [ ] Add memory zeroing
- [ ] Add key rotation support
- [ ] Write unit tests

#### 3.2 KMS Client
- [ ] Create `KMSClient.ts`
- [ ] Implement mock KMS for development
- [ ] Add AWS KMS integration (production)
- [ ] Add encryption/decryption methods
- [ ] Write unit tests

#### 3.3 State Validation Service
- [ ] Create `StateValidationService.ts`
- [ ] Implement 256-bit state generation
- [ ] Add HMAC signature
- [ ] Add IP hash binding
- [ ] Add timestamp validation
- [ ] Add replay protection (Redis)
- [ ] Write unit tests

#### 3.4 OAuth Manager V2
- [ ] Create `OAuthManagerV2.ts`
- [ ] Implement provider registry
- [ ] Add PKCE generation (S256)
- [ ] Add state storage (Redis)
- [ ] Write unit tests

#### 3.5 OAuth Controller V2
- [ ] Create `OAuthControllerV2.ts`
- [ ] Implement authorize endpoint
- [ ] Implement callback endpoint
- [ ] Add distributed locking
- [ ] Add MongoDB transactions
- [ ] Add duplicate prevention
- [ ] Add cross-tenant validation
- [ ] Add security audit logging
- [ ] Write integration tests

#### 3.6 Routes
- [ ] Create `oauth-v2.routes.ts`
- [ ] Register all V2 endpoints
- [ ] Add authentication middleware
- [ ] Add rate limiting
- [ ] Mount in v1 index

### Frontend Implementation

#### 3.7 State Machine
- [ ] Install XState
- [ ] Create `connectChannelMachine.ts`
- [ ] Define all states
- [ ] Define transitions
- [ ] Add guards
- [ ] Add actions
- [ ] Write tests

#### 3.8 Core Components
- [ ] Create `ConnectChannelModal.tsx`
- [ ] Create `PlatformSelector.tsx`
- [ ] Create `PlatformTile.tsx`
- [ ] Create `LoadingScreen.tsx`
- [ ] Create `Spinner.tsx`
- [ ] Create `ProgressBar.tsx`
- [ ] Write component tests

#### 3.9 Account Selection
- [ ] Create `AccountPicker.tsx`
- [ ] Create `AccountCard.tsx`
- [ ] Add multi-select support
- [ ] Add permission indicators
- [ ] Write component tests

#### 3.10 Success/Error Screens
- [ ] Create `SuccessScreen.tsx`
- [ ] Create `SuccessAnimation.tsx`
- [ ] Create `ErrorScreen.tsx`
- [ ] Create `ErrorIcon.tsx`
- [ ] Add error translation
- [ ] Write component tests

#### 3.11 Service Layer
- [ ] Create `oauth-v2.service.ts`
- [ ] Implement all API methods
- [ ] Add error handling
- [ ] Add request/response types
- [ ] Write service tests

#### 3.12 Hooks
- [ ] Create `useConnectChannelV2.ts`
- [ ] Integrate with state machine
- [ ] Add React Query integration
- [ ] Add error handling
- [ ] Write hook tests

#### 3.13 Page
- [ ] Create `ConnectChannelV2.tsx`
- [ ] Integrate all components
- [ ] Add routing
- [ ] Add navigation
- [ ] Write E2E tests

---

## PHASE 4: TESTING STRATEGY

### Unit Tests

**Backend**:
- [ ] TokenEncryptionService tests
- [ ] KMSClient tests
- [ ] StateValidationService tests
- [ ] OAuthManagerV2 tests
- [ ] Each provider tests

**Frontend**:
- [ ] State machine tests
- [ ] Component tests (all)
- [ ] Service tests
- [ ] Hook tests

### Integration Tests

**Backend**:
- [ ] Full OAuth flow test
- [ ] Distributed lock test
- [ ] Transaction rollback test
- [ ] Duplicate prevention test
- [ ] Cross-tenant test

**Frontend**:
- [ ] Modal flow test
- [ ] Platform selection test
- [ ] Account picker test
- [ ] Error handling test

### E2E Tests

- [ ] Complete OAuth flow (Twitter)
- [ ] Complete OAuth flow (LinkedIn)
- [ ] Complete OAuth flow (Facebook)
- [ ] Complete OAuth flow (Instagram)
- [ ] Multi-account selection
- [ ] Error scenarios
- [ ] Timeout scenarios
- [ ] Concurrent requests

---

## PHASE 5: ROUTE TOGGLE MECHANISM

### Environment Variable

**File**: `apps/backend/.env`

```env
# OAuth V2 Feature Flag
OAUTH_V2_ENABLED=true
OAUTH_V2_PLATFORMS=twitter,linkedin,facebook,instagram
```

**File**: `apps/frontend/.env`

```env
# OAuth V2 Feature Flag
VITE_OAUTH_V2_ENABLED=true
```

### Backend Toggle

**File**: `apps/backend/src/config/index.ts`

```typescript
export const config = {
  // ... existing config
  oauthV2: {
    enabled: process.env.OAUTH_V2_ENABLED === 'true',
    platforms: process.env.OAUTH_V2_PLATFORMS?.split(',') || [],
  },
};
```

### Frontend Toggle

**File**: `apps/frontend/src/config/features.ts`

```typescript
export const features = {
  oauthV2Enabled: import.meta.env.VITE_OAUTH_V2_ENABLED === 'true',
};
```

### Conditional Rendering

**File**: `apps/frontend/src/pages/social/ConnectedAccounts.tsx`

```typescript
import { features } from '@/config/features';
import { ConnectButton } from '@/components/social/ConnectButton'; // V1
import { ConnectButtonV2 } from '@/components/connect-v2/ConnectButton'; // V2

// In component
{features.oauthV2Enabled ? (
  <ConnectButtonV2 />
) : (
  <ConnectButton />
)}
```

---

## PHASE 6: DEPLOYMENT STRATEGY

### Development Environment

1. Enable V2 via environment variable
2. Test V2 flow independently
3. Keep V1 accessible for comparison
4. Run both flows side-by-side

### Staging Environment

1. Deploy V2 code
2. Enable V2 for internal users only
3. Run A/B testing
4. Collect metrics
5. Fix issues

### Production Environment

#### Option A: Gradual Rollout
1. Deploy V2 code (disabled)
2. Enable for 5% of users
3. Monitor metrics
4. Increase to 25%
5. Increase to 50%
6. Increase to 100%

#### Option B: Route-Based
1. Deploy V2 code
2. V1 at `/social/accounts`
3. V2 at `/connect-v2`
4. Let users choose
5. Migrate gradually

#### Option C: Feature Flag
1. Deploy V2 code
2. Use feature flag service (LaunchDarkly, etc.)
3. Enable per workspace
4. Enable per user
5. Full rollout

---

## PHASE 7: MIGRATION PLAN

### Week 1-2: Backend Foundation
- [ ] Create all V2 services
- [ ] Create OAuthControllerV2
- [ ] Create V2 routes
- [ ] Write backend tests
- [ ] Deploy to dev

### Week 3-4: Frontend Foundation
- [ ] Create state machine
- [ ] Create all V2 components
- [ ] Create V2 service
- [ ] Write frontend tests
- [ ] Deploy to dev

### Week 5: Integration
- [ ] Connect frontend to backend
- [ ] E2E testing
- [ ] Fix integration issues
- [ ] Performance testing
- [ ] Deploy to staging

### Week 6: Testing & Polish
- [ ] Security audit
- [ ] Load testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Deploy to production (disabled)

### Week 7: Gradual Rollout
- [ ] Enable for internal users
- [ ] Enable for beta users (5%)
- [ ] Monitor metrics
- [ ] Fix issues
- [ ] Increase to 25%

### Week 8: Full Rollout
- [ ] Increase to 50%
- [ ] Increase to 100%
- [ ] Monitor for 1 week
- [ ] Deprecate V1 (optional)

---

## PHASE 8: ROLLBACK STRATEGY

### Immediate Rollback

**If V2 has critical issues**:

1. Set environment variable: `OAUTH_V2_ENABLED=false`
2. Restart services
3. V1 flow immediately active
4. Zero downtime

### Code Rollback

**If environment toggle fails**:

1. Revert V2 routes registration
2. Redeploy backend
3. Redeploy frontend
4. V1 flow active

### Database Rollback

**If schema changes needed**:

1. V2 uses same schema as V1 (backward compatible)
2. No migration needed
3. No rollback needed

---

## PHASE 9: SUCCESS METRICS

### Technical Metrics

- [ ] OAuth flow completion rate > 95%
- [ ] Average flow duration < 2 seconds
- [ ] Error rate < 1%
- [ ] Security incidents = 0
- [ ] API response time < 500ms (p95)
- [ ] Frontend bundle size increase < 100KB

### Business Metrics

- [ ] User adoption rate > 80%
- [ ] Account connection rate increase > 20%
- [ ] Support tickets decrease > 30%
- [ ] User satisfaction score > 4.5/5

### Security Metrics

- [ ] State validation success rate = 100%
- [ ] Token encryption success rate = 100%
- [ ] Duplicate prevention success rate = 100%
- [ ] Cross-tenant prevention success rate = 100%
- [ ] Security audit log coverage = 100%

---

## PHASE 10: DOCUMENTATION

### Developer Documentation

- [ ] V2 architecture overview
- [ ] API documentation
- [ ] Component documentation
- [ ] State machine documentation
- [ ] Testing guide
- [ ] Deployment guide

### User Documentation

- [ ] Connect channel guide
- [ ] Platform-specific guides
- [ ] Troubleshooting guide
- [ ] FAQ
- [ ] Video tutorials

### Operations Documentation

- [ ] Monitoring guide
- [ ] Alert configuration
- [ ] Incident response
- [ ] Rollback procedures
- [ ] Performance tuning

---

## CRITICAL RULES

### DO NOT

- ❌ Modify any V1 files
- ❌ Change existing routes
- ❌ Alter existing database schema
- ❌ Remove V1 code
- ❌ Force users to V2

### DO

- ✅ Create new files only
- ✅ Add new routes only
- ✅ Use backward-compatible schema
- ✅ Keep V1 functional
- ✅ Allow user choice

---

## QUICK START COMMANDS

### Backend Setup

```bash
# Create V2 directory structure
mkdir -p apps/backend/src/services/oauth-v2/providers
mkdir -p apps/backend/src/middleware/oauth-v2
mkdir -p apps/backend/src/controllers

# Create placeholder files
touch apps/backend/src/controllers/OAuthControllerV2.ts
touch apps/backend/src/routes/v1/oauth-v2.routes.ts
touch apps/backend/src/services/oauth-v2/TokenEncryptionService.ts
touch apps/backend/src/services/oauth-v2/KMSClient.ts
touch apps/backend/src/services/oauth-v2/StateValidationService.ts
touch apps/backend/src/services/oauth-v2/OAuthManagerV2.ts
```

### Frontend Setup

```bash
# Create V2 directory structure
mkdir -p apps/frontend/src/components/connect-v2
mkdir -p apps/frontend/src/pages/connect-v2
mkdir -p apps/frontend/src/machines
mkdir -p apps/frontend/src/services
mkdir -p apps/frontend/src/hooks

# Install dependencies
cd apps/frontend
npm install xstate @xstate/react

# Create placeholder files
touch apps/frontend/src/components/connect-v2/ConnectChannelModal.tsx
touch apps/frontend/src/machines/connectChannelMachine.ts
touch apps/frontend/src/services/oauth-v2.service.ts
touch apps/frontend/src/hooks/useConnectChannelV2.ts
touch apps/frontend/src/pages/connect-v2/ConnectChannelV2.tsx
```

---

## NEXT STEPS

1. Review this plan with team
2. Create feature branch: `feature/connect-flow-v2`
3. Start with Phase 1: Backend Foundation
4. Implement incrementally
5. Test continuously
6. Deploy gradually

---

**Plan Status**: READY FOR IMPLEMENTATION  
**Estimated Duration**: 8 weeks  
**Risk Level**: LOW (isolated implementation)  
**Rollback Complexity**: MINIMAL (environment toggle)
