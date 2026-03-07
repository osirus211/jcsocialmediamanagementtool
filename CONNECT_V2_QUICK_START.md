# Connect Flow V2 - Quick Start Guide

**Status**: ✅ Foundation Created  
**Next Steps**: Implement core services and components  

---

## What's Been Created

### Backend

✅ **OAuthControllerV2** (`apps/backend/src/controllers/OAuthControllerV2.ts`)
- Skeleton controller with all endpoints
- Ready for implementation

✅ **OAuth V2 Routes** (`apps/backend/src/routes/v1/oauth-v2.routes.ts`)
- Registered at `/api/v1/oauth-v2`
- Feature flag support
- Isolated from V1

✅ **Route Registration** (`apps/backend/src/routes/v1/index.ts`)
- V2 routes mounted
- V1 routes unchanged

### Frontend

✅ **Connect Channel V2 Page** (`apps/frontend/src/pages/connect-v2/ConnectChannelV2.tsx`)
- Basic page structure
- Placeholder modal
- Ready for component integration

✅ **Route Registration** (`apps/frontend/src/app/router.tsx`)
- V2 page accessible at `/connect-v2`
- V1 routes unchanged

---

## How to Test V2 Foundation

### 1. Enable V2 Backend

**File**: `apps/backend/.env`

```env
# Add this line
OAUTH_V2_ENABLED=true
```

### 2. Restart Backend

```bash
cd apps/backend
npm run dev
```

### 3. Test V2 Endpoints

```bash
# Check if V2 is available
curl http://localhost:5000/api/v1/oauth-v2/platforms

# Expected response:
{
  "success": true,
  "platforms": ["twitter", "linkedin", "facebook", "instagram"],
  "version": "v2",
  "features": {
    "bankGradeSecurity": true,
    "envelopeEncryption": true,
    "distributedLocking": true,
    "transactionalSafety": true
  }
}
```

### 4. Test V2 Frontend

```bash
# Navigate to V2 page
http://localhost:5173/connect-v2
```

You should see:
- "Connect Channel" page with V2 badge
- "What's New in V2?" info box
- "Connect Your First Channel" button
- Placeholder modal when clicked

---

## Next Implementation Steps

### Phase 1: Backend Security Services (Week 1)

#### 1.1 Create Token Encryption Service

**File**: `apps/backend/src/services/oauth-v2/TokenEncryptionService.ts`

**Tasks**:
- [ ] Implement envelope encryption (DEK + KEK)
- [ ] Add AES-256-GCM encryption
- [ ] Add memory zeroing
- [ ] Add key rotation support
- [ ] Write unit tests

**Reference**: `OAUTH_BANK_GRADE_SECURITY_SPEC.md` Section 2.3

#### 1.2 Create KMS Client

**File**: `apps/backend/src/services/oauth-v2/KMSClient.ts`

**Tasks**:
- [ ] Implement mock KMS for development
- [ ] Add AWS KMS integration (production)
- [ ] Add encryption/decryption methods
- [ ] Write unit tests

**Reference**: `OAUTH_BANK_GRADE_SECURITY_SPEC.md` Section 2.3

#### 1.3 Create State Validation Service

**File**: `apps/backend/src/services/oauth-v2/StateValidationService.ts`

**Tasks**:
- [ ] Implement 256-bit state generation
- [ ] Add HMAC signature
- [ ] Add IP hash binding
- [ ] Add timestamp validation
- [ ] Add replay protection (Redis)
- [ ] Write unit tests

**Reference**: `OAUTH_BANK_GRADE_SECURITY_SPEC.md` Section 2.1

#### 1.4 Update OAuthControllerV2

**File**: `apps/backend/src/controllers/OAuthControllerV2.ts`

**Tasks**:
- [ ] Implement authorize() method
- [ ] Implement callback() method
- [ ] Add distributed locking
- [ ] Add MongoDB transactions
- [ ] Add duplicate prevention
- [ ] Add cross-tenant validation
- [ ] Write integration tests

**Reference**: `OAUTH_BANK_GRADE_SECURITY_SPEC.md` Section 5

### Phase 2: Frontend Components (Week 2)

#### 2.1 Install Dependencies

```bash
cd apps/frontend
npm install xstate @xstate/react
```

#### 2.2 Create State Machine

**File**: `apps/frontend/src/machines/connectChannelMachine.ts`

**Tasks**:
- [ ] Define all states
- [ ] Define transitions
- [ ] Add guards
- [ ] Add actions
- [ ] Write tests

**Reference**: `BUFFER_LEVEL_CONNECT_CHANNEL_SPEC.md` Section 2

#### 2.3 Create Components

**Directory**: `apps/frontend/src/components/connect-v2/`

**Files to Create**:
- [ ] `ConnectChannelModal.tsx`
- [ ] `PlatformSelector.tsx`
- [ ] `PlatformTile.tsx`
- [ ] `LoadingScreen.tsx`
- [ ] `Spinner.tsx`
- [ ] `AccountPicker.tsx`
- [ ] `AccountCard.tsx`
- [ ] `SuccessScreen.tsx`
- [ ] `ErrorScreen.tsx`

**Reference**: `BUFFER_LEVEL_CONNECT_CHANNEL_SPEC.md` Section 8

#### 2.4 Create Service

**File**: `apps/frontend/src/services/oauth-v2.service.ts`

**Tasks**:
- [ ] Implement API methods
- [ ] Add error handling
- [ ] Add request/response types
- [ ] Write service tests

#### 2.5 Create Hook

**File**: `apps/frontend/src/hooks/useConnectChannelV2.ts`

**Tasks**:
- [ ] Integrate with state machine
- [ ] Add React Query integration
- [ ] Add error handling
- [ ] Write hook tests

---

## Directory Structure to Create

```bash
# Backend
mkdir -p apps/backend/src/services/oauth-v2/providers
mkdir -p apps/backend/src/middleware/oauth-v2

# Frontend
mkdir -p apps/frontend/src/components/connect-v2
mkdir -p apps/frontend/src/machines
mkdir -p apps/frontend/src/hooks
```

---

## Testing Strategy

### Unit Tests

**Backend**:
```bash
cd apps/backend
npm test -- --testPathPattern=oauth-v2
```

**Frontend**:
```bash
cd apps/frontend
npm test -- --testPathPattern=connect-v2
```

### Integration Tests

```bash
# Backend
npm test -- --testPathPattern=OAuthControllerV2.integration

# Frontend
npm test -- --testPathPattern=ConnectChannelV2.integration
```

### E2E Tests

```bash
# Full flow test
npm run test:e2e -- --spec=connect-v2-flow.spec.ts
```

---

## Feature Flag Control

### Enable V2

**Backend** (`apps/backend/.env`):
```env
OAUTH_V2_ENABLED=true
```

**Frontend** (`apps/frontend/.env`):
```env
VITE_OAUTH_V2_ENABLED=true
```

### Disable V2

**Backend** (`apps/backend/.env`):
```env
OAUTH_V2_ENABLED=false
```

**Frontend** (`apps/frontend/.env`):
```env
VITE_OAUTH_V2_ENABLED=false
```

---

## Verification Checklist

### Backend Foundation
- [x] OAuthControllerV2 created
- [x] V2 routes registered
- [x] Feature flag support added
- [x] V1 routes unchanged
- [ ] Services implemented
- [ ] Tests written

### Frontend Foundation
- [x] ConnectChannelV2 page created
- [x] V2 route registered
- [x] V1 routes unchanged
- [ ] State machine implemented
- [ ] Components created
- [ ] Tests written

### Integration
- [ ] Backend + Frontend connected
- [ ] OAuth flow working
- [ ] Error handling working
- [ ] Performance targets met

---

## Common Issues & Solutions

### Issue: V2 endpoints return 404

**Solution**: Check that `OAUTH_V2_ENABLED=true` in `.env`

### Issue: Frontend can't reach V2 endpoints

**Solution**: Check CORS configuration in backend

### Issue: State machine not working

**Solution**: Ensure XState is installed: `npm install xstate @xstate/react`

---

## Resources

- **Specifications**: 
  - `BUFFER_LEVEL_CONNECT_CHANNEL_SPEC.md`
  - `OAUTH_BANK_GRADE_SECURITY_SPEC.md`
  - `CONNECT_FLOW_V2_IMPLEMENTATION_PLAN.md`

- **Analysis**:
  - `CONNECT_FLOW_DEBUG_ANALYSIS.md`

- **Current Implementation**:
  - Backend: `apps/backend/src/controllers/OAuthControllerV2.ts`
  - Frontend: `apps/frontend/src/pages/connect-v2/ConnectChannelV2.tsx`

---

## Next Steps

1. ✅ Review this quick start guide
2. ✅ Test V2 foundation (endpoints + page)
3. ⏳ Implement Phase 1: Backend Security Services
4. ⏳ Implement Phase 2: Frontend Components
5. ⏳ Integration testing
6. ⏳ Gradual rollout

---

**Status**: Ready for implementation  
**Estimated Time**: 6-8 weeks for full implementation  
**Risk**: LOW (isolated from V1)
