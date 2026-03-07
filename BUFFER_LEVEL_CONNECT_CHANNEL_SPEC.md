# Buffer-Level Connect Channel Experience Specification

**Classification**: PRODUCT SPECIFICATION - UX/UI  
**Version**: 1.0  
**Date**: 2026-02-27  
**Integration**: Bank-Grade OAuth Security Architecture  

---

## Table of Contents

1. [Buffer UX Reverse Engineering](#1-buffer-ux-reverse-engineering)
2. [Complete State Machine](#2-complete-state-machine)
3. [Multi-Account Handling](#3-multi-account-handling)
4. [Security + UX Integration](#4-security--ux-integration)
5. [Account Health Indicators](#5-account-health-indicators)
6. [Edge Case Behavior](#6-edge-case-behavior)
7. [Performance Standards](#7-performance-standards)
8. [Component Architecture](#8-component-architecture)
9. [API Contract Definition](#9-api-contract-definition)
10. [Backend Validation Steps](#10-backend-validation-steps)
11. [Error Handling Matrix](#11-error-handling-matrix)
12. [Implementation Task Breakdown](#12-implementation-task-breakdown)
13. [Risk Assessment](#13-risk-assessment)
14. [Production Checklist](#14-production-checklist)

---

## 1. BUFFER UX REVERSE ENGINEERING

### 1.1 Entry Experience

**Visual Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Channels                                          [+ Connect]│
│                                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  No channels connected yet                            │   │
│  │                                                        │   │
│  │  Connect your social media accounts to start          │   │
│  │  scheduling and publishing content.                   │   │
│  │                                                        │   │
│  │              [Connect Your First Channel]             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Button Specifications**:
- Primary CTA: "Connect Your First Channel" or "+ Connect"
- Color: Brand primary (e.g., #168EEA)
- Size: Large (48px height) for empty state, Medium (40px) for header
- Hover: Darken 10%, smooth 200ms transition
- Click: Scale 0.98, 100ms transition
- Icon: Plus icon with 2px stroke


**Microcopy**:
- Empty state: "Connect your social media accounts to start scheduling and publishing content."
- Button: "Connect Your First Channel" (first time) or "Connect Channel" (subsequent)
- No technical jargon
- No mention of OAuth, tokens, or API

---

### 1.2 Platform Selection Modal

**Modal Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Connect a Channel                                      [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Choose a platform to connect                                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   [Twitter]  │  │  [LinkedIn]  │  │  [Facebook]  │     │
│  │              │  │              │  │              │     │
│  │   Twitter    │  │   LinkedIn   │  │   Facebook   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  [Instagram] │  │   [TikTok]   │                        │
│  │              │  │              │                        │
│  │  Instagram   │  │   TikTok     │                        │
│  └──────────────┘  └──────────────┘                        │
│                                                              │
│  We'll ask for permission to post on your behalf.           │
│  You can disconnect anytime.                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Platform Tile Specifications**:
- Size: 160px × 140px
- Border: 1px solid #E5E7EB (neutral-200)
- Border radius: 8px
- Padding: 24px
- Icon size: 48px × 48px
- Icon position: Centered top
- Label: 14px, centered, 8px below icon
- Hover state:
  - Border: 2px solid #168EEA (brand primary)
  - Background: #F0F9FF (brand-50)
  - Transform: translateY(-2px)
  - Shadow: 0 4px 12px rgba(0,0,0,0.08)
  - Transition: all 200ms ease
- Active state:
  - Background: #DBEAFE (brand-100)
  - Border: 2px solid #168EEA
- Disabled state:
  - Opacity: 0.5
  - Cursor: not-allowed
  - Badge: "Coming Soon"

**Platform Icons**:
- Twitter/X: Black X logo on white background
- LinkedIn: Blue IN logo
- Facebook: Blue f logo
- Instagram: Gradient camera logo
- TikTok: Black musical note logo

**Microcopy**:
- Title: "Connect a Channel"
- Subtitle: "Choose a platform to connect"
- Footer: "We'll ask for permission to post on your behalf. You can disconnect anytime."
- Reassurance: Privacy-focused, non-technical


---

### 1.3 OAuth Transition

**Loading Screen Design**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                        [Spinner]                             │
│                                                              │
│                  Connecting to Twitter...                    │
│                                                              │
│              This should only take a moment                  │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Transition Sequence**:
1. User clicks platform tile
2. Tile shows loading state (200ms)
3. Modal fades out (300ms)
4. Loading screen fades in (300ms)
5. Redirect to OAuth provider (immediate)

**Loading Messages** (rotate every 3 seconds):
- "Connecting to [Platform]..."
- "Securing your connection..."
- "Almost there..."

**Spinner Specifications**:
- Type: Circular indeterminate
- Size: 48px diameter
- Color: Brand primary (#168EEA)
- Stroke width: 4px
- Animation: 1.4s linear infinite rotation

**Timeout Behavior**:
- If redirect doesn't happen in 5 seconds:
  - Show error: "Connection is taking longer than expected"
  - Show retry button
  - Log timeout event

---

### 1.4 Post-OAuth Processing

**Processing Screen Design**:
```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                        [Spinner]                             │
│                                                              │
│                  Verifying your account...                   │
│                                                              │
│              Checking permissions and settings               │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Processing Steps** (invisible to user):
1. Validate OAuth state parameter
2. Exchange authorization code for tokens
3. Fetch user profile from platform
4. Validate required scopes
5. Check for duplicate accounts
6. Check cross-tenant conflicts
7. Encrypt and store tokens
8. Create account record in database

**Processing Messages** (show sequentially):
- "Verifying your account..." (0-2s)
- "Checking permissions and settings..." (2-4s)
- "Finalizing connection..." (4-6s)

**No Flicker Rule**:
- Minimum display time: 800ms (even if processing completes faster)
- Prevents jarring flash of loading screen
- Smooth transition to success state


---

### 1.5 Success State

**Success Modal Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Channel Connected!                                     [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [✓ Animation]                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Avatar]  @username                    [Twitter]  │    │
│  │            John Doe                                 │    │
│  │            15.2K followers                          │    │
│  │                                                     │    │
│  │  Label: ┌─────────────────────────────┐           │    │
│  │         │ John's Twitter              │           │    │
│  │         └─────────────────────────────┘           │    │
│  │                                          [Edit]    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  You can now schedule posts to this channel.                │
│                                                              │
│  [Start Scheduling]              [Connect Another Channel]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Success Animation**:
- Checkmark icon: Green (#10B981)
- Animation: Scale from 0 to 1 with bounce (500ms)
- Easing: cubic-bezier(0.68, -0.55, 0.265, 1.55)
- Sound: Optional success chime (if user has sound enabled)

**Account Card Specifications**:
- Avatar: 64px × 64px, rounded circle
- Username: 16px, font-weight 600
- Display name: 14px, color neutral-600
- Follower count: 12px, color neutral-500
- Platform badge: 24px × 24px, top-right corner
- Label input: Editable, 14px, max 50 characters
- Edit button: Ghost button, appears on hover

**CTAs**:
- Primary: "Start Scheduling" (brand primary, full width on mobile)
- Secondary: "Connect Another Channel" (ghost button)

**Microcopy**:
- Title: "Channel Connected!" (with exclamation for excitement)
- Body: "You can now schedule posts to this channel."
- Positive, action-oriented language

---

### 1.6 Failure State

**Failure Modal Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Connection Failed                                      [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [⚠ Warning Icon]                          │
│                                                              │
│  We couldn't connect your Twitter account                   │
│                                                              │
│  The connection was cancelled or the required               │
│  permissions weren't granted.                               │
│                                                              │
│  To connect this account, we need permission to:            │
│  • Read your profile information                            │
│  • Post tweets on your behalf                               │
│  • Access your followers list                               │
│                                                              │
│  [Try Again]                      [Choose Another Platform] │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Error Categories & Messages**:

1. **User Cancelled**:
   - Title: "Connection Cancelled"
   - Message: "You cancelled the connection process. No worries, you can try again anytime."
   - Icon: Info (blue)
   - CTA: "Try Again"

2. **Missing Permissions**:
   - Title: "Missing Permissions"
   - Message: "We couldn't connect your account because some required permissions weren't granted."
   - Details: List of required permissions
   - Icon: Warning (yellow)
   - CTA: "Try Again"

3. **Account Already Connected**:
   - Title: "Account Already Connected"
   - Message: "This account is already connected to your workspace."
   - Icon: Info (blue)
   - CTA: "Go to Channels"

4. **Account Connected Elsewhere**:
   - Title: "Account Unavailable"
   - Message: "This account is connected to another workspace. Please disconnect it there first."
   - Icon: Warning (yellow)
   - CTA: "Choose Another Account"

5. **Network Error**:
   - Title: "Connection Error"
   - Message: "We couldn't connect to [Platform]. Please check your internet connection and try again."
   - Icon: Warning (yellow)
   - CTA: "Try Again"

6. **Platform Error**:
   - Title: "Platform Error"
   - Message: "[Platform] is experiencing issues. Please try again in a few minutes."
   - Icon: Warning (yellow)
   - CTA: "Try Again Later"

7. **Unknown Error**:
   - Title: "Something Went Wrong"
   - Message: "We encountered an unexpected error. Our team has been notified."
   - Icon: Error (red)
   - CTA: "Try Again" + "Contact Support"

**No Stack Traces**:
- Never show technical error messages
- Never show error codes to users
- Log detailed errors server-side only
- Show user-friendly explanations only


---

## 2. COMPLETE STATE MACHINE

### 2.1 State Definitions

```typescript
enum ConnectionState {
  IDLE = 'idle',
  SELECTING_PLATFORM = 'selecting_platform',
  REDIRECTING = 'redirecting',
  OAUTH_PROCESSING = 'oauth_processing',
  VALIDATING_TOKEN = 'validating_token',
  SELECTING_SUB_ACCOUNT = 'selecting_sub_account',
  FINALIZING = 'finalizing',
  SUCCESS = 'success',
  FAILURE = 'failure',
  RECONNECT_REQUIRED = 'reconnect_required',
}

interface ConnectionStateContext {
  platform?: Platform;
  selectedAccountId?: string;
  availableAccounts?: PlatformAccount[];
  error?: ConnectionError;
  accountData?: ConnectedAccount;
  startTime?: number;
  retryCount?: number;
}
```

### 2.2 State Transition Table

| Current State | Event | Next State | UI Action | Backend Action |
|--------------|-------|------------|-----------|----------------|
| IDLE | user_clicks_connect | SELECTING_PLATFORM | Show modal | None |
| SELECTING_PLATFORM | user_selects_platform | REDIRECTING | Show loading | Generate state + PKCE |
| REDIRECTING | redirect_complete | OAUTH_PROCESSING | Show processing | None |
| OAUTH_PROCESSING | callback_received | VALIDATING_TOKEN | Show validating | Validate state, exchange code |
| VALIDATING_TOKEN | validation_success (single account) | FINALIZING | Show finalizing | Create account record |
| VALIDATING_TOKEN | validation_success (multiple accounts) | SELECTING_SUB_ACCOUNT | Show account picker | None |
| SELECTING_SUB_ACCOUNT | user_selects_account | FINALIZING | Show finalizing | Create account record |
| FINALIZING | save_complete | SUCCESS | Show success modal | None |
| VALIDATING_TOKEN | validation_failure | FAILURE | Show error modal | Log error |
| FINALIZING | save_failure | FAILURE | Show error modal | Log error |
| FAILURE | user_clicks_retry | SELECTING_PLATFORM | Show modal | None |
| SUCCESS | user_clicks_done | IDLE | Close modal | None |
| ANY | user_cancels | IDLE | Close modal | Cleanup state |
| ANY | timeout | FAILURE | Show timeout error | Log timeout |

### 2.3 State Details

#### IDLE
**UI Components**:
- Connect button visible
- No modal open

**Backend Calls**: None

**Timeout**: N/A

**Error Fallback**: N/A

**Allowed Transitions**:
- → SELECTING_PLATFORM (user clicks connect)

---

#### SELECTING_PLATFORM
**UI Components**:
- Modal open with platform tiles
- All platforms clickable
- Close button visible

**Backend Calls**: None (client-side only)

**Timeout**: N/A (user-driven)

**Error Fallback**: N/A

**Allowed Transitions**:
- → REDIRECTING (user selects platform)
- → IDLE (user closes modal)

---

#### REDIRECTING
**UI Components**:
- Loading screen with spinner
- Message: "Connecting to [Platform]..."
- No close button (prevent accidental cancel)

**Backend Calls**:
- POST /api/v1/oauth/:platform/authorize
  - Generates state parameter
  - Generates PKCE challenge
  - Stores in Redis
  - Returns authorization URL

**Timeout**: 5 seconds
- If no redirect: → FAILURE (timeout error)

**Error Fallback**:
- API error: → FAILURE (show network error)

**Allowed Transitions**:
- → OAUTH_PROCESSING (redirect completes)
- → FAILURE (timeout or error)

---

#### OAUTH_PROCESSING
**UI Components**:
- Loading screen with spinner
- Message: "Verifying your account..."
- No close button

**Backend Calls**: None (waiting for OAuth callback)

**Timeout**: 60 seconds
- User has 60s to complete OAuth on provider
- If no callback: → FAILURE (timeout error)

**Error Fallback**:
- User cancels on provider: → FAILURE (user cancelled)

**Allowed Transitions**:
- → VALIDATING_TOKEN (callback received)
- → FAILURE (timeout or user cancelled)

---

#### VALIDATING_TOKEN
**UI Components**:
- Loading screen with spinner
- Message: "Checking permissions and settings..."
- No close button

**Backend Calls**:
- GET /api/v1/oauth/:platform/callback?code=XXX&state=YYY
  - Validates state parameter
  - Exchanges code for tokens
  - Fetches user profile
  - Validates scopes
  - Checks for duplicates
  - Returns account data or account list

**Timeout**: 10 seconds
- If no response: → FAILURE (timeout error)

**Error Fallback**:
- State invalid: → FAILURE (security error)
- Scope missing: → FAILURE (permission error)
- Duplicate: → FAILURE (already connected)
- Cross-tenant: → FAILURE (connected elsewhere)
- Network error: → FAILURE (network error)

**Allowed Transitions**:
- → SELECTING_SUB_ACCOUNT (multiple accounts returned)
- → FINALIZING (single account, validation success)
- → FAILURE (validation error)

---

#### SELECTING_SUB_ACCOUNT
**UI Components**:
- Account picker modal
- List of available accounts with:
  - Avatar
  - Name
  - Account type (Page, Profile, Business)
  - Follower count
  - Radio button or checkbox
- Continue button (disabled until selection)
- Back button

**Backend Calls**: None (client-side selection)

**Timeout**: N/A (user-driven)

**Error Fallback**: N/A

**Allowed Transitions**:
- → FINALIZING (user selects account and clicks continue)
- → SELECTING_PLATFORM (user clicks back)
- → IDLE (user closes modal)

---

#### FINALIZING
**UI Components**:
- Loading screen with spinner
- Message: "Finalizing connection..."
- No close button

**Backend Calls**:
- POST /api/v1/oauth/:platform/finalize
  - Encrypts tokens
  - Creates account record in DB
  - Updates usage tracking
  - Returns connected account

**Timeout**: 10 seconds
- If no response: → FAILURE (timeout error)

**Error Fallback**:
- Encryption error: → FAILURE (system error)
- DB error: → FAILURE (system error)
- Race condition: → SUCCESS (idempotent, return existing)

**Allowed Transitions**:
- → SUCCESS (save complete)
- → FAILURE (save error)

---

#### SUCCESS
**UI Components**:
- Success modal with:
  - Checkmark animation
  - Account card
  - Editable label
  - CTAs (Start Scheduling, Connect Another)
- Close button visible

**Backend Calls**: None

**Timeout**: N/A (user-driven)

**Error Fallback**: N/A

**Allowed Transitions**:
- → IDLE (user closes modal or clicks done)
- → SELECTING_PLATFORM (user clicks "Connect Another")

---

#### FAILURE
**UI Components**:
- Error modal with:
  - Error icon
  - User-friendly message
  - Explanation (if applicable)
  - CTAs (Try Again, Contact Support, etc.)
- Close button visible

**Backend Calls**: None

**Timeout**: N/A (user-driven)

**Error Fallback**: N/A

**Allowed Transitions**:
- → SELECTING_PLATFORM (user clicks Try Again)
- → IDLE (user closes modal)

---

#### RECONNECT_REQUIRED
**UI Components**:
- Warning badge on account card
- Reconnect button
- Explanation tooltip

**Backend Calls**: None (until user clicks reconnect)

**Timeout**: N/A

**Error Fallback**: N/A

**Allowed Transitions**:
- → REDIRECTING (user clicks reconnect)


---

### 2.4 State Machine Diagram

```
                    ┌──────────────┐
                    │     IDLE     │
                    └──────┬───────┘
                           │ user_clicks_connect
                           ▼
                  ┌─────────────────────┐
                  │ SELECTING_PLATFORM  │◀─────┐
                  └──────┬──────────────┘      │
                         │ user_selects        │
                         ▼                     │
                  ┌─────────────┐              │
                  │ REDIRECTING │              │
                  └──────┬──────┘              │
                         │ redirect_complete   │
                         ▼                     │
                  ┌──────────────────┐         │
                  │ OAUTH_PROCESSING │         │
                  └──────┬───────────┘         │
                         │ callback_received   │
                         ▼                     │
                  ┌──────────────────┐         │
                  │ VALIDATING_TOKEN │         │
                  └──────┬───────────┘         │
                         │                     │
              ┌──────────┴──────────┐          │
              │                     │          │
    single    │                     │ multiple │
    account   ▼                     ▼          │
         ┌────────────┐    ┌─────────────────────────┐
         │ FINALIZING │    │ SELECTING_SUB_ACCOUNT   │
         └─────┬──────┘    └──────────┬──────────────┘
               │                      │ user_selects
               │ save_complete        │
               ▼                      ▼
         ┌──────────┐           ┌────────────┐
         │ SUCCESS  │           │ FINALIZING │
         └──────────┘           └─────┬──────┘
                                      │
                                      ▼
                                ┌──────────┐
                                │ SUCCESS  │
                                └──────────┘

         Any error from any state
                  │
                  ▼
            ┌──────────┐
            │ FAILURE  │──────user_clicks_retry──────┘
            └──────────┘
```

---

## 3. MULTI-ACCOUNT HANDLING

### 3.1 Platforms with Multiple Accounts

**Facebook**:
- Returns: User profile + Pages managed by user
- Selection required: Yes
- Account types:
  - Personal Profile (not supported for posting)
  - Pages (supported)
- Display: Page name, category, follower count

**LinkedIn**:
- Returns: Personal profile + Organization pages
- Selection required: Yes (if user manages organizations)
- Account types:
  - Personal Profile
  - Organization Pages
- Display: Name, headline/description, connection count

**Instagram**:
- Returns: Business/Creator accounts only
- Selection required: Yes (if multiple business accounts)
- Account types:
  - Business Account
  - Creator Account
- Display: Username, follower count, profile picture

**Twitter/X**:
- Returns: Single account only
- Selection required: No
- Account types:
  - Personal Account
- Display: Username, display name, follower count


---

### 3.2 Account Picker UI

**Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Select an Account                                      [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Choose which Facebook Page to connect                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ○ [Avatar] Tech Startup Inc.                       │    │
│  │            Business Page • 12.5K followers         │    │
│  │            ✓ All permissions granted               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ○ [Avatar] Marketing Agency                        │    │
│  │            Business Page • 8.2K followers          │    │
│  │            ✓ All permissions granted               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ○ [Avatar] Personal Blog                           │    │
│  │            Community Page • 1.1K followers         │    │
│  │            ⚠ Missing: Manage posts permission      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  [Back]                                      [Continue]     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Account Card Specifications**:
- Height: 80px
- Padding: 16px
- Border: 1px solid neutral-200
- Border radius: 8px
- Hover: Border color → brand primary
- Selected: Background → brand-50, Border → brand primary (2px)
- Radio button: 20px, left-aligned
- Avatar: 48px × 48px, 8px margin-right
- Name: 16px, font-weight 600
- Metadata: 14px, color neutral-600
- Permission status:
  - All granted: Green checkmark + "All permissions granted"
  - Missing: Yellow warning + "Missing: [permission name]"
  - Disabled: Gray + "Cannot connect this account"

**Multi-Select Support** (where applicable):
- Checkbox instead of radio button
- "Select All" option at top
- Maximum selection limit (e.g., 5 accounts)
- Counter: "3 of 5 accounts selected"

**Empty State**:
```
┌─────────────────────────────────────────────────────────────┐
│  No Accounts Available                                  [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [Empty State Icon]                        │
│                                                              │
│  No Facebook Pages found                                    │
│                                                              │
│  You need to manage at least one Facebook Page to           │
│  connect it to this workspace.                              │
│                                                              │
│  [Learn How to Create a Page]          [Choose Another]    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.3 Permission Status Indicators

**Permission Check Logic**:
```typescript
interface PermissionStatus {
  granted: string[];
  missing: string[];
  canConnect: boolean;
  reason?: string;
}

function checkPermissions(
  account: PlatformAccount,
  requiredScopes: string[]
): PermissionStatus {
  const granted = account.scopes.filter(s => requiredScopes.includes(s));
  const missing = requiredScopes.filter(s => !account.scopes.includes(s));
  
  return {
    granted,
    missing,
    canConnect: missing.length === 0,
    reason: missing.length > 0 
      ? `Missing: ${missing.join(', ')}`
      : undefined,
  };
}
```

**Visual Indicators**:
- ✓ Green checkmark: All permissions granted
- ⚠ Yellow warning: Some permissions missing (can still connect with reduced functionality)
- ✗ Red X: Critical permissions missing (cannot connect)
- ℹ Blue info: Additional information available

---

## 4. SECURITY + UX INTEGRATION

### 4.1 Invisible Security

**Principle**: Security must be completely transparent to the user. All security measures happen behind the scenes without user awareness or interaction.

**Security Checkpoints** (all invisible):

1. **State Parameter Validation**:
   - Happens: During OAuth callback
   - User sees: "Verifying your account..."
   - On failure: Show "Connection failed" (generic)
   - Never mention: "Invalid state parameter"

2. **PKCE Validation**:
   - Happens: During token exchange
   - User sees: "Verifying your account..."
   - On failure: Show "Connection failed" (generic)
   - Never mention: "PKCE validation failed"

3. **Scope Validation**:
   - Happens: After token exchange
   - User sees: "Checking permissions and settings..."
   - On failure: Show "Missing permissions" with list
   - User-friendly: "We need permission to post on your behalf"

4. **Duplicate Detection**:
   - Happens: Before account creation
   - User sees: "Finalizing connection..."
   - On duplicate: Show "Account already connected"
   - Action: Return existing account (idempotent)

5. **Cross-Tenant Check**:
   - Happens: Before account creation
   - User sees: "Finalizing connection..."
   - On conflict: Show "Account connected elsewhere"
   - Action: Prevent connection, suggest disconnect

6. **Token Encryption**:
   - Happens: Before database save
   - User sees: "Finalizing connection..."
   - On failure: Show "System error, please try again"
   - Never mention: "Encryption failed"

7. **Transaction Commit**:
   - Happens: Final step
   - User sees: "Finalizing connection..."
   - On failure: Show "System error, please try again"
   - Rollback: Automatic, invisible


---

### 4.2 Error Translation Layer

**Backend Error → User-Friendly Message**:

```typescript
interface ErrorTranslation {
  backendError: string;
  userMessage: string;
  userTitle: string;
  icon: 'info' | 'warning' | 'error';
  actions: string[];
}

const ERROR_TRANSLATIONS: Record<string, ErrorTranslation> = {
  'STATE_SIGNATURE_INVALID': {
    backendError: 'State signature invalid',
    userMessage: 'The connection request expired or was invalid. Please try again.',
    userTitle: 'Connection Failed',
    icon: 'warning',
    actions: ['Try Again'],
  },
  'STATE_EXPIRED': {
    backendError: 'State expired',
    userMessage: 'The connection request took too long. Please try again.',
    userTitle: 'Connection Expired',
    icon: 'info',
    actions: ['Try Again'],
  },
  'STATE_REPLAY_ATTACK': {
    backendError: 'State already used',
    userMessage: 'This connection request was already used. Please start a new connection.',
    userTitle: 'Connection Failed',
    icon: 'warning',
    actions: ['Try Again'],
  },
  'INSUFFICIENT_SCOPES': {
    backendError: 'Missing required scopes',
    userMessage: 'Some required permissions weren\'t granted. We need these to post on your behalf.',
    userTitle: 'Missing Permissions',
    icon: 'warning',
    actions: ['Try Again', 'Learn More'],
  },
  'DUPLICATE_ACCOUNT': {
    backendError: 'Account already exists',
    userMessage: 'This account is already connected to your workspace.',
    userTitle: 'Account Already Connected',
    icon: 'info',
    actions: ['Go to Channels'],
  },
  'CROSS_TENANT_CONFLICT': {
    backendError: 'Account connected to another workspace',
    userMessage: 'This account is connected to another workspace. Please disconnect it there first.',
    userTitle: 'Account Unavailable',
    icon: 'warning',
    actions: ['Choose Another Account', 'Learn More'],
  },
  'TOKEN_EXCHANGE_FAILED': {
    backendError: 'Token exchange failed',
    userMessage: 'We couldn\'t complete the connection. Please try again.',
    userTitle: 'Connection Failed',
    icon: 'error',
    actions: ['Try Again', 'Contact Support'],
  },
  'ENCRYPTION_FAILED': {
    backendError: 'Token encryption failed',
    userMessage: 'We encountered a system error. Our team has been notified.',
    userTitle: 'System Error',
    icon: 'error',
    actions: ['Try Again', 'Contact Support'],
  },
  'DATABASE_ERROR': {
    backendError: 'Database transaction failed',
    userMessage: 'We encountered a system error. Our team has been notified.',
    userTitle: 'System Error',
    icon: 'error',
    actions: ['Try Again', 'Contact Support'],
  },
  'NETWORK_ERROR': {
    backendError: 'Network request failed',
    userMessage: 'We couldn\'t connect to the platform. Please check your internet connection.',
    userTitle: 'Connection Error',
    icon: 'warning',
    actions: ['Try Again'],
  },
  'TIMEOUT': {
    backendError: 'Request timeout',
    userMessage: 'The connection is taking longer than expected. Please try again.',
    userTitle: 'Connection Timeout',
    icon: 'warning',
    actions: ['Try Again'],
  },
  'USER_CANCELLED': {
    backendError: 'User cancelled OAuth',
    userMessage: 'You cancelled the connection process. No worries, you can try again anytime.',
    userTitle: 'Connection Cancelled',
    icon: 'info',
    actions: ['Try Again', 'Close'],
  },
};
```

**Translation Function**:
```typescript
function translateError(error: BackendError): UserError {
  const translation = ERROR_TRANSLATIONS[error.code] || {
    userMessage: 'Something went wrong. Please try again.',
    userTitle: 'Unexpected Error',
    icon: 'error',
    actions: ['Try Again', 'Contact Support'],
  };
  
  // Log detailed error server-side
  logger.error('OAuth connection error', {
    code: error.code,
    message: error.message,
    stack: error.stack,
    userId: error.userId,
    workspaceId: error.workspaceId,
    platform: error.platform,
  });
  
  // Return user-friendly error
  return {
    title: translation.userTitle,
    message: translation.userMessage,
    icon: translation.icon,
    actions: translation.actions,
  };
}
```

---

### 4.3 Logging Strategy

**Client-Side Logging**:
```typescript
// Log state transitions
analytics.track('Connection State Changed', {
  from: previousState,
  to: currentState,
  platform: selectedPlatform,
  duration: Date.now() - stateStartTime,
});

// Log user actions
analytics.track('User Action', {
  action: 'clicked_platform_tile',
  platform: selectedPlatform,
  state: currentState,
});

// Log errors (sanitized)
analytics.track('Connection Error', {
  errorType: error.type, // Generic type only
  state: currentState,
  platform: selectedPlatform,
  // NO sensitive data
});
```

**Server-Side Logging**:
```typescript
// Log security events (detailed)
securityLogger.log({
  type: 'oauth_connection_attempt',
  userId,
  workspaceId,
  platform,
  ipAddress: hashIP(req.ip),
  userAgent: req.headers['user-agent'],
  state: 'initiated',
  timestamp: new Date(),
});

// Log validation failures (detailed)
securityLogger.log({
  type: 'state_validation_failed',
  reason: 'signature_mismatch',
  userId,
  workspaceId,
  platform,
  ipAddress: hashIP(req.ip),
  // NO tokens or sensitive data
});

// Log success (detailed)
securityLogger.log({
  type: 'oauth_connection_success',
  userId,
  workspaceId,
  platform,
  accountId: account._id,
  scopes: account.scopes,
  duration: Date.now() - startTime,
});
```

---

## 5. ACCOUNT HEALTH INDICATORS

### 5.1 Connected Account Card

**Design**:
```
┌────────────────────────────────────────────────────────┐
│  [Avatar]  @username                        [Twitter]  │
│            John's Twitter                              │
│            ✓ Connected • Last sync: 2 min ago         │
│                                                        │
│  [Schedule Post]  [View Analytics]  [•••]             │
└────────────────────────────────────────────────────────┘
```

**Status Indicators**:

1. **Connected (Healthy)**:
   - Icon: Green checkmark
   - Text: "Connected"
   - Color: Green (#10B981)
   - Last sync: "Last sync: X min/hours ago"

2. **Token Expiring Soon**:
   - Icon: Yellow warning
   - Text: "Token expires in 7 days"
   - Color: Yellow (#F59E0B)
   - Action: "Reconnect Now" button

3. **Token Expired**:
   - Icon: Red error
   - Text: "Reconnect Required"
   - Color: Red (#EF4444)
   - Action: "Reconnect" button (prominent)
   - Disable: Schedule Post button

4. **Permission Issue**:
   - Icon: Yellow warning
   - Text: "Missing Permissions"
   - Color: Yellow (#F59E0B)
   - Action: "Fix Permissions" button
   - Tooltip: List of missing permissions

5. **Platform Error**:
   - Icon: Yellow warning
   - Text: "Platform Issue"
   - Color: Yellow (#F59E0B)
   - Tooltip: "Twitter is experiencing issues. We'll retry automatically."

6. **Disconnected**:
   - Icon: Gray circle
   - Text: "Disconnected"
   - Color: Gray (#6B7280)
   - Action: "Reconnect" button


---

### 5.2 Health Check Logic

```typescript
interface AccountHealth {
  status: 'healthy' | 'warning' | 'error' | 'disconnected';
  message: string;
  action?: string;
  details?: string;
}

function checkAccountHealth(account: ISocialAccount): AccountHealth {
  // Check if disconnected
  if (account.status === 'revoked' || account.status === 'disconnected') {
    return {
      status: 'disconnected',
      message: 'Disconnected',
      action: 'Reconnect',
    };
  }
  
  // Check token expiration
  if (account.tokenExpiresAt) {
    const daysUntilExpiry = Math.floor(
      (account.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilExpiry < 0) {
      return {
        status: 'error',
        message: 'Reconnect Required',
        action: 'Reconnect',
        details: 'Your token has expired. Please reconnect to continue posting.',
      };
    }
    
    if (daysUntilExpiry <= 7) {
      return {
        status: 'warning',
        message: `Token expires in ${daysUntilExpiry} days`,
        action: 'Reconnect Now',
        details: 'Reconnect now to avoid interruption.',
      };
    }
  }
  
  // Check last sync time
  const lastSync = account.securityMetadata.lastUsedAt;
  if (lastSync) {
    const hoursSinceSync = Math.floor(
      (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)
    );
    
    if (hoursSinceSync > 24) {
      return {
        status: 'warning',
        message: 'Not synced recently',
        details: `Last sync: ${hoursSinceSync} hours ago`,
      };
    }
  }
  
  // Check for suspicious activity
  if (account.securityMetadata.suspiciousActivityDetected) {
    return {
      status: 'error',
      message: 'Security Issue Detected',
      action: 'Review',
      details: 'Unusual activity detected. Please review your account.',
    };
  }
  
  // All good
  const minutesSinceSync = lastSync
    ? Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60))
    : null;
  
  return {
    status: 'healthy',
    message: 'Connected',
    details: minutesSinceSync
      ? `Last sync: ${formatTimeSince(minutesSinceSync)}`
      : 'Ready to post',
  };
}

function formatTimeSince(minutes: number): string {
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
```

---

### 5.3 Disconnect Confirmation

**Modal Design**:
```
┌─────────────────────────────────────────────────────────────┐
│  Disconnect Channel?                                    [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Are you sure you want to disconnect @username?             │
│                                                              │
│  This will:                                                  │
│  • Cancel all scheduled posts for this channel              │
│  • Remove access to post on this account                    │
│  • Delete stored connection data                            │
│                                                              │
│  You can reconnect this channel anytime.                    │
│                                                              │
│  [Cancel]                              [Disconnect Channel] │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Confirmation Requirements**:
- Two-step process (click disconnect → confirm)
- Clear consequences listed
- Destructive action styling (red button)
- Cancel button prominent
- Reassurance: "You can reconnect anytime"

**Post-Disconnect Actions**:
1. Cancel scheduled posts for that channel
2. Update account status to 'disconnected'
3. Keep account record (soft delete)
4. Log disconnect event
5. Show success toast: "Channel disconnected"
6. Remove from channel list
7. Update usage tracking

---

## 6. EDGE CASE BEHAVIOR

### 6.1 Edge Case Matrix

| Scenario | UI Behavior | Backend Behavior | Log Behavior |
|----------|-------------|------------------|--------------|
| User cancels OAuth | Show "Connection Cancelled" modal with info icon | Clean up state from Redis | Log: oauth_cancelled |
| Token expired during connect | Show "Connection Expired" error | Clean up state, log timeout | Log: state_expired |
| Missing required scope | Show "Missing Permissions" with list | Reject connection, log scope issue | Log: insufficient_scopes |
| Network timeout | Show "Connection Timeout" error | Retry 3 times, then fail | Log: network_timeout |
| Redis state expired | Show "Connection Expired" error | Return 403, clean up | Log: state_not_found |
| Duplicate connect attempt | Return existing account (idempotent) | Find existing, return it | Log: duplicate_detected |
| Account connected to another tenant | Show "Account Unavailable" error | Reject connection | Log: cross_tenant_conflict |
| Platform API partial failure | Show "Platform Error" | Retry with exponential backoff | Log: platform_api_error |
| Slow API (>5 seconds) | Show extended loading message | Continue waiting up to 10s | Log: slow_api_response |
| User closes browser during OAuth | No UI (browser closed) | State expires after 10 min | Log: state_expired |
| Multiple tabs open | First tab succeeds, others fail | Distributed lock prevents race | Log: concurrent_attempt |
| Invalid authorization code | Show "Connection Failed" | Log error, return 400 | Log: invalid_auth_code |
| OAuth provider down | Show "Platform Error" | Return 502, suggest retry | Log: provider_unavailable |
| Database connection lost | Show "System Error" | Retry transaction 3 times | Log: database_error |
| Encryption service down | Show "System Error" | Fail fast, alert team | Log: encryption_service_down |
| Token refresh during connect | Continue normally | Use new token | Log: token_refreshed |
| Account deleted on platform | Show "Account Not Found" | Clean up, mark as deleted | Log: account_deleted |
| Permission revoked on platform | Show "Missing Permissions" | Detect during validation | Log: permission_revoked |
| Rate limit hit | Show "Too Many Attempts" | Return 429, suggest wait time | Log: rate_limit_exceeded |
| IP address change during flow | Continue if within timeout | Validate IP hash loosely | Log: ip_changed |
| Session expired during flow | Redirect to login | Return 401 | Log: session_expired |


---

### 6.2 Detailed Edge Case Handling

#### User Cancels OAuth

**Detection**:
- OAuth callback receives `error=access_denied`
- Or: No callback received within 60 seconds

**UI Behavior**:
```
┌─────────────────────────────────────────────────────────────┐
│  Connection Cancelled                                   [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [ℹ Info Icon]                             │
│                                                              │
│  You cancelled the connection process                       │
│                                                              │
│  No worries, you can try again anytime.                     │
│                                                              │
│  [Try Again]                                    [Close]     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Behavior**:
- Clean up state from Redis
- Clean up PKCE from Redis
- No database changes
- Return 200 with error info

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'oauth_cancelled',
  severity: 'info',
  userId,
  workspaceId,
  platform,
  reason: 'user_cancelled',
});
```

---

#### Token Expired During Connect

**Detection**:
- State validation fails with "State expired"
- Timestamp check: `Date.now() - state.timestamp > 600000`

**UI Behavior**:
```
┌─────────────────────────────────────────────────────────────┐
│  Connection Expired                                     [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [⚠ Warning Icon]                          │
│                                                              │
│  The connection request took too long                       │
│                                                              │
│  Please start a new connection.                             │
│                                                              │
│  [Try Again]                                    [Close]     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Behavior**:
- Return 403 Forbidden
- Clean up expired state
- Log security event

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'state_expired',
  severity: 'medium',
  userId,
  workspaceId,
  platform,
  stateAge: Date.now() - state.timestamp,
});
```

---

#### Missing Required Scope

**Detection**:
- Scope validation fails
- `requiredScopes.some(s => !receivedScopes.includes(s))`

**UI Behavior**:
```
┌─────────────────────────────────────────────────────────────┐
│  Missing Permissions                                    [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [⚠ Warning Icon]                          │
│                                                              │
│  We couldn't connect your Twitter account                   │
│                                                              │
│  The following permissions are required:                    │
│  • Post tweets on your behalf                               │
│  • Read your profile information                            │
│                                                              │
│  Please grant all permissions to continue.                  │
│                                                              │
│  [Try Again]                          [Learn More]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Behavior**:
- Return 400 Bad Request
- Include missing scopes in response
- Log scope validation failure

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'insufficient_scopes',
  severity: 'high',
  userId,
  workspaceId,
  platform,
  requiredScopes,
  receivedScopes,
  missingScopes,
});
```

---

#### Network Timeout

**Detection**:
- API request takes > 10 seconds
- No response from OAuth provider

**UI Behavior**:
```
┌─────────────────────────────────────────────────────────────┐
│  Connection Timeout                                     [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [⚠ Warning Icon]                          │
│                                                              │
│  The connection is taking longer than expected              │
│                                                              │
│  Please check your internet connection and try again.       │
│                                                              │
│  [Try Again]                                    [Close]     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Behavior**:
- Retry 3 times with exponential backoff
- If all retries fail, return 504 Gateway Timeout
- Clean up state

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'network_timeout',
  severity: 'medium',
  userId,
  workspaceId,
  platform,
  duration: timeoutDuration,
  retryCount: 3,
});
```

---

#### Duplicate Connect Attempt

**Detection**:
- Account with same `workspaceId + provider + providerUserId` exists
- Status is not 'revoked'

**UI Behavior**:
```
┌─────────────────────────────────────────────────────────────┐
│  Account Already Connected                              [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [ℹ Info Icon]                             │
│                                                              │
│  This account is already connected to your workspace        │
│                                                              │
│  You can find it in your Channels list.                     │
│                                                              │
│  [Go to Channels]                  [Connect Another]        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Behavior**:
- Return existing account (idempotent)
- Status 200 OK
- No database changes

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'duplicate_account_detected',
  severity: 'info',
  userId,
  workspaceId,
  platform,
  existingAccountId: account._id,
});
```

---

#### Account Connected to Another Tenant

**Detection**:
- Account with same `provider + providerUserId` exists
- Different `workspaceId`
- Status is 'active'

**UI Behavior**:
```
┌─────────────────────────────────────────────────────────────┐
│  Account Unavailable                                    [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [⚠ Warning Icon]                          │
│                                                              │
│  This account is connected to another workspace             │
│                                                              │
│  Please disconnect it there first, or choose a              │
│  different account.                                          │
│                                                              │
│  [Choose Another Account]              [Learn More]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Behavior**:
- Return 409 Conflict
- Include conflict details (sanitized)
- Reject connection

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'cross_tenant_conflict',
  severity: 'high',
  userId,
  workspaceId,
  platform,
  conflictingWorkspaceId: existingAccount.workspaceId,
  providerUserId: profile.id,
});
```

---

#### Platform API Partial Failure

**Detection**:
- Token exchange succeeds but profile fetch fails
- Or: Profile fetch returns incomplete data

**UI Behavior**:
```
┌─────────────────────────────────────────────────────────────┐
│  Platform Error                                         [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [⚠ Warning Icon]                          │
│                                                              │
│  Twitter is experiencing issues                             │
│                                                              │
│  Please try again in a few minutes.                         │
│                                                              │
│  [Try Again]                          [Try Another]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Behavior**:
- Retry with exponential backoff (3 attempts)
- If all fail, return 502 Bad Gateway
- Clean up tokens (don't store partial data)

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'platform_api_error',
  severity: 'high',
  userId,
  workspaceId,
  platform,
  endpoint: 'profile_fetch',
  statusCode: response.status,
  retryCount: 3,
});
```

---

#### Slow API (>5 seconds)

**Detection**:
- API request takes > 5 seconds but < 10 seconds

**UI Behavior**:
- Show extended loading message
- Update message every 2 seconds:
  - 0-2s: "Verifying your account..."
  - 2-4s: "This is taking longer than usual..."
  - 4-6s: "Almost there, please wait..."
  - 6-8s: "Still working on it..."
  - 8-10s: "Just a moment more..."
  - >10s: Timeout error

**Backend Behavior**:
- Continue waiting up to 10 seconds
- Log slow response
- No retry (already in progress)

**Log Behavior**:
```typescript
securityLogger.log({
  type: 'slow_api_response',
  severity: 'medium',
  userId,
  workspaceId,
  platform,
  duration: responseDuration,
  endpoint: 'token_exchange',
});
```

---

## 7. PERFORMANCE STANDARDS

### 7.1 Performance Targets

| Metric | Target | Maximum | Measurement |
|--------|--------|---------|-------------|
| OAuth initiation | < 200ms | 500ms | Time from click to redirect |
| OAuth callback processing | < 1s | 2s | Time from callback to success |
| State validation | < 50ms | 100ms | Redis lookup + validation |
| Token exchange | < 500ms | 2s | External API call |
| Profile fetch | < 500ms | 2s | External API call |
| Token encryption | < 50ms | 100ms | Encryption service |
| Database transaction | < 200ms | 500ms | MongoDB write |
| Total flow duration | < 2s | 5s | Callback to success screen |
| UI state transition | < 100ms | 200ms | React state update |
| Modal animation | 300ms | 300ms | Fade in/out |


---

### 7.2 Performance Optimization Strategies

**Frontend Optimizations**:

1. **Code Splitting**:
   ```typescript
   // Lazy load OAuth modal
   const ConnectChannelModal = lazy(() => import('./ConnectChannelModal'));
   
   // Preload on hover
   <button
     onMouseEnter={() => import('./ConnectChannelModal')}
     onClick={openModal}
   >
     Connect Channel
   </button>
   ```

2. **Optimistic UI Updates**:
   ```typescript
   // Show success immediately, sync in background
   const handleConnect = async () => {
     // Optimistic update
     setAccounts([...accounts, tempAccount]);
     
     try {
       const account = await api.finalizeConnection();
       // Replace temp with real
       setAccounts(accounts.map(a => 
         a.id === tempAccount.id ? account : a
       ));
     } catch (error) {
       // Rollback on error
       setAccounts(accounts.filter(a => a.id !== tempAccount.id));
       showError(error);
     }
   };
   ```

3. **Request Deduplication**:
   ```typescript
   // Prevent duplicate requests
   const connectMutation = useMutation({
     mutationKey: ['connect', platform],
     mutationFn: connectPlatform,
     // Dedupe requests within 5 seconds
     staleTime: 5000,
   });
   ```

4. **Prefetching**:
   ```typescript
   // Prefetch platform configs on modal open
   useEffect(() => {
     if (modalOpen) {
       queryClient.prefetchQuery(['platforms']);
     }
   }, [modalOpen]);
   ```

**Backend Optimizations**:

1. **Redis Connection Pooling**:
   ```typescript
   const redis = new Redis({
     host: process.env.REDIS_HOST,
     port: 6379,
     maxRetriesPerRequest: 3,
     enableReadyCheck: true,
     lazyConnect: false,
     // Connection pool
     connectionName: 'oauth-service',
     maxLoadingRetryTime: 5000,
   });
   ```

2. **Parallel API Calls**:
   ```typescript
   // Fetch profile and validate scopes in parallel
   const [profile, scopeValidation] = await Promise.all([
     fetchUserProfile(accessToken, platform),
     validateScopes(platform, scopes),
   ]);
   ```

3. **Database Indexes**:
   ```typescript
   // Ensure indexes exist for fast lookups
   db.socialaccounts.createIndex(
     { workspaceId: 1, provider: 1, providerUserId: 1 },
     { unique: true }
   );
   ```

4. **Caching**:
   ```typescript
   // Cache platform configs
   const platformConfig = await cache.get(
     `platform:${platform}`,
     () => fetchPlatformConfig(platform),
     { ttl: 3600 } // 1 hour
   );
   ```

---

### 7.3 Timeout Configuration

```typescript
const TIMEOUTS = {
  // Frontend timeouts
  REDIRECT_TIMEOUT: 5000,        // 5s - redirect to OAuth provider
  OAUTH_TIMEOUT: 60000,          // 60s - user completes OAuth
  CALLBACK_TIMEOUT: 10000,       // 10s - callback processing
  
  // Backend timeouts
  STATE_VALIDATION_TIMEOUT: 100,  // 100ms - Redis lookup
  TOKEN_EXCHANGE_TIMEOUT: 5000,   // 5s - OAuth provider API
  PROFILE_FETCH_TIMEOUT: 5000,    // 5s - Platform API
  ENCRYPTION_TIMEOUT: 1000,       // 1s - Encryption service
  DATABASE_TIMEOUT: 5000,         // 5s - MongoDB transaction
  
  // Retry timeouts
  RETRY_DELAY_BASE: 1000,         // 1s - base delay
  RETRY_DELAY_MAX: 5000,          // 5s - max delay
  RETRY_ATTEMPTS: 3,              // 3 attempts
};
```

**Timeout Handling**:
```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeout]);
}

// Usage
const profile = await withTimeout(
  fetchUserProfile(token, platform),
  TIMEOUTS.PROFILE_FETCH_TIMEOUT,
  'Profile fetch timeout'
);
```

---

### 7.4 Progress Indication

**Loading States**:
```typescript
interface LoadingState {
  isLoading: boolean;
  progress: number;      // 0-100
  message: string;
  estimatedTime?: number; // milliseconds
}

// Progress calculation
function calculateProgress(state: ConnectionState): number {
  const stateProgress = {
    IDLE: 0,
    SELECTING_PLATFORM: 10,
    REDIRECTING: 20,
    OAUTH_PROCESSING: 40,
    VALIDATING_TOKEN: 60,
    SELECTING_SUB_ACCOUNT: 70,
    FINALIZING: 80,
    SUCCESS: 100,
  };
  
  return stateProgress[state] || 0;
}
```

**Progress Bar Component**:
```typescript
<ProgressBar
  progress={progress}
  message={loadingMessage}
  showEstimate={progress < 80}
  estimatedTime={estimatedTime}
/>
```

---

## 8. COMPONENT ARCHITECTURE

### 8.1 Component Hierarchy

```
App
└── ChannelsPage
    ├── ChannelsList
    │   ├── ChannelCard (multiple)
    │   │   ├── ChannelAvatar
    │   │   ├── ChannelStatus
    │   │   ├── ChannelActions
    │   │   └── ChannelMenu
    │   └── EmptyState
    │       └── ConnectButton
    └── ConnectChannelFlow
        ├── ConnectButton (trigger)
        └── ConnectChannelModal
            ├── PlatformSelector
            │   └── PlatformTile (multiple)
            ├── LoadingScreen
            │   ├── Spinner
            │   └── LoadingMessage
            ├── AccountPicker
            │   └── AccountCard (multiple)
            ├── SuccessScreen
            │   ├── SuccessAnimation
            │   ├── ConnectedAccountCard
            │   └── SuccessActions
            └── ErrorScreen
                ├── ErrorIcon
                ├── ErrorMessage
                └── ErrorActions
```


---

### 8.2 Component Specifications

#### ConnectChannelModal

**Props**:
```typescript
interface ConnectChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: ConnectedAccount) => void;
  initialPlatform?: Platform;
}
```

**State**:
```typescript
interface ConnectChannelState {
  currentState: ConnectionState;
  selectedPlatform?: Platform;
  availableAccounts?: PlatformAccount[];
  selectedAccountId?: string;
  error?: ConnectionError;
  connectedAccount?: ConnectedAccount;
}
```

**State Management**:
```typescript
// Use XState for deterministic state machine
const connectMachine = createMachine({
  id: 'connect',
  initial: 'idle',
  states: {
    idle: {
      on: { OPEN_MODAL: 'selectingPlatform' }
    },
    selectingPlatform: {
      on: {
        SELECT_PLATFORM: 'redirecting',
        CLOSE: 'idle'
      }
    },
    redirecting: {
      invoke: {
        src: 'initiateOAuth',
        onDone: 'oauthProcessing',
        onError: 'failure'
      }
    },
    // ... other states
  }
});
```

---

#### PlatformSelector

**Props**:
```typescript
interface PlatformSelectorProps {
  onSelect: (platform: Platform) => void;
  availablePlatforms: Platform[];
  disabledPlatforms?: Platform[];
}
```

**Component**:
```typescript
export const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  onSelect,
  availablePlatforms,
  disabledPlatforms = [],
}) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {availablePlatforms.map(platform => (
        <PlatformTile
          key={platform}
          platform={platform}
          onClick={() => onSelect(platform)}
          disabled={disabledPlatforms.includes(platform)}
        />
      ))}
    </div>
  );
};
```

---

#### LoadingScreen

**Props**:
```typescript
interface LoadingScreenProps {
  message: string;
  progress?: number;
  showProgress?: boolean;
}
```

**Component**:
```typescript
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message,
  progress,
  showProgress = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Spinner size="lg" />
      <p className="mt-4 text-lg font-medium">{message}</p>
      {showProgress && progress !== undefined && (
        <ProgressBar progress={progress} className="mt-4 w-64" />
      )}
    </div>
  );
};
```

---

#### AccountPicker

**Props**:
```typescript
interface AccountPickerProps {
  accounts: PlatformAccount[];
  platform: Platform;
  onSelect: (accountId: string) => void;
  onBack: () => void;
  multiSelect?: boolean;
  maxSelection?: number;
}
```

**Component**:
```typescript
export const AccountPicker: React.FC<AccountPickerProps> = ({
  accounts,
  platform,
  onSelect,
  onBack,
  multiSelect = false,
  maxSelection,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const handleSelect = (accountId: string) => {
    if (multiSelect) {
      setSelectedIds(prev => 
        prev.includes(accountId)
          ? prev.filter(id => id !== accountId)
          : [...prev, accountId]
      );
    } else {
      onSelect(accountId);
    }
  };
  
  return (
    <div>
      <h2>Select an Account</h2>
      <p>Choose which {platform} account to connect</p>
      
      <div className="space-y-3 mt-4">
        {accounts.map(account => (
          <AccountCard
            key={account.id}
            account={account}
            selected={selectedIds.includes(account.id)}
            onSelect={() => handleSelect(account.id)}
            multiSelect={multiSelect}
          />
        ))}
      </div>
      
      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={() => onSelect(selectedIds[0])}
          disabled={selectedIds.length === 0}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
```

---

### 8.3 State Management Strategy

**Global State** (React Query + Zustand):
```typescript
// React Query for server state
const { data: accounts, refetch } = useQuery({
  queryKey: ['accounts', workspaceId],
  queryFn: () => api.getAccounts(workspaceId),
});

// Zustand for UI state
interface ConnectFlowStore {
  isModalOpen: boolean;
  currentState: ConnectionState;
  selectedPlatform?: Platform;
  error?: ConnectionError;
  
  openModal: () => void;
  closeModal: () => void;
  setState: (state: ConnectionState) => void;
  setError: (error: ConnectionError) => void;
  reset: () => void;
}

const useConnectFlowStore = create<ConnectFlowStore>((set) => ({
  isModalOpen: false,
  currentState: ConnectionState.IDLE,
  
  openModal: () => set({ isModalOpen: true, currentState: ConnectionState.SELECTING_PLATFORM }),
  closeModal: () => set({ isModalOpen: false }),
  setState: (state) => set({ currentState: state }),
  setError: (error) => set({ error, currentState: ConnectionState.FAILURE }),
  reset: () => set({ currentState: ConnectionState.IDLE, error: undefined }),
}));
```

**Local State** (useState for component-specific):
```typescript
// Component-specific state
const [selectedAccountId, setSelectedAccountId] = useState<string>();
const [isSubmitting, setIsSubmitting] = useState(false);
```

---

### 8.4 API Integration Layer

**API Client**:
```typescript
class OAuthAPI {
  async initiateOAuth(platform: Platform, workspaceId: string): Promise<OAuthInitiation> {
    const response = await api.post(`/oauth/${platform}/authorize`, {
      workspaceId,
    });
    return response.data;
  }
  
  async handleCallback(
    platform: Platform,
    code: string,
    state: string
  ): Promise<CallbackResult> {
    const response = await api.get(`/oauth/${platform}/callback`, {
      params: { code, state },
    });
    return response.data;
  }
  
  async finalizeConnection(
    platform: Platform,
    accountId: string
  ): Promise<ConnectedAccount> {
    const response = await api.post(`/oauth/${platform}/finalize`, {
      accountId,
    });
    return response.data;
  }
  
  async disconnectAccount(accountId: string): Promise<void> {
    await api.delete(`/accounts/${accountId}`);
  }
  
  async reconnectAccount(accountId: string): Promise<OAuthInitiation> {
    const response = await api.post(`/accounts/${accountId}/reconnect`);
    return response.data;
  }
}

export const oauthAPI = new OAuthAPI();
```

**React Query Hooks**:
```typescript
export function useConnectChannel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ platform, workspaceId }: ConnectParams) => {
      // Initiate OAuth
      const { authUrl, state } = await oauthAPI.initiateOAuth(platform, workspaceId);
      
      // Redirect to OAuth provider
      window.location.href = authUrl;
      
      // Return state for tracking
      return { state };
    },
    onSuccess: () => {
      // Invalidate accounts query
      queryClient.invalidateQueries(['accounts']);
    },
  });
}

export function useHandleCallback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ platform, code, state }: CallbackParams) => {
      return await oauthAPI.handleCallback(platform, code, state);
    },
    onSuccess: (data) => {
      if (data.account) {
        // Single account - add to cache
        queryClient.setQueryData(['accounts'], (old: any) => [...old, data.account]);
      }
      // Multiple accounts - handled by AccountPicker
    },
  });
}
```

---

## 9. API CONTRACT DEFINITION

### 9.1 Initiate OAuth

**Endpoint**: `POST /api/v1/oauth/:platform/authorize`

**Request**:
```typescript
{
  workspaceId: string;
}
```

**Response** (200 OK):
```typescript
{
  authUrl: string;        // OAuth provider authorization URL
  state: string;          // State parameter (for client tracking only)
  expiresAt: string;      // ISO 8601 timestamp
}
```

**Errors**:
- 400: Invalid platform
- 401: Unauthorized
- 403: Workspace access denied
- 429: Rate limit exceeded
- 500: Server error

---

### 9.2 Handle OAuth Callback

**Endpoint**: `GET /api/v1/oauth/:platform/callback`

**Query Parameters**:
```typescript
{
  code: string;           // Authorization code from OAuth provider
  state: string;          // State parameter
  error?: string;         // Error code if user cancelled
  error_description?: string;
}
```

**Response** (200 OK - Single Account):
```typescript
{
  success: true;
  account: {
    id: string;
    workspaceId: string;
    provider: Platform;
    providerUserId: string;
    accountName: string;
    username: string;
    avatarUrl: string;
    followerCount: number;
    status: 'active';
    scopes: string[];
    metadata: {
      displayName: string;
      bio?: string;
      verified?: boolean;
    };
    createdAt: string;
  };
}
```

**Response** (200 OK - Multiple Accounts):
```typescript
{
  success: true;
  requiresSelection: true;
  accounts: Array<{
    id: string;
    name: string;
    username?: string;
    avatarUrl: string;
    accountType: 'profile' | 'page' | 'business';
    followerCount: number;
    permissions: {
      granted: string[];
      missing: string[];
      canConnect: boolean;
    };
  }>;
  selectionToken: string;  // Token to use in finalize request
}
```

**Errors**:
- 400: Invalid code or state
- 403: State validation failed
- 409: Account already connected / Cross-tenant conflict
- 422: Missing required scopes
- 429: Rate limit exceeded
- 502: OAuth provider error
- 504: Timeout

---

### 9.3 Finalize Connection

**Endpoint**: `POST /api/v1/oauth/:platform/finalize`

**Request**:
```typescript
{
  selectionToken: string;  // From callback response
  accountId: string;       // Selected account ID
  label?: string;          // Custom label for account
}
```

**Response** (200 OK):
```typescript
{
  success: true;
  account: {
    // Same as single account response from callback
  };
}
```

**Errors**:
- 400: Invalid selection token or account ID
- 403: Token expired
- 409: Account already connected
- 500: Server error

---

### 9.4 Get Connected Accounts

**Endpoint**: `GET /api/v1/accounts`

**Query Parameters**:
```typescript
{
  workspaceId: string;
  platform?: Platform;     // Filter by platform
  status?: AccountStatus;  // Filter by status
}
```

**Response** (200 OK):
```typescript
{
  accounts: Array<{
    id: string;
    workspaceId: string;
    provider: Platform;
    accountName: string;
    username: string;
    avatarUrl: string;
    status: AccountStatus;
    health: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      lastSync?: string;
    };
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
}
```

---

### 9.5 Disconnect Account

**Endpoint**: `DELETE /api/v1/accounts/:accountId`

**Response** (200 OK):
```typescript
{
  success: true;
  message: 'Account disconnected successfully';
}
```

**Errors**:
- 404: Account not found
- 403: Access denied
- 500: Server error

---

### 9.6 Reconnect Account

**Endpoint**: `POST /api/v1/accounts/:accountId/reconnect`

**Response** (200 OK):
```typescript
{
  authUrl: string;
  state: string;
  expiresAt: string;
}
```

**Errors**:
- 404: Account not found
- 403: Access denied
- 429: Rate limit exceeded
- 500: Server error

---

## 10. BACKEND VALIDATION STEPS

### 10.1 OAuth Callback Validation Sequence

**Step-by-Step Process**:

```typescript
async function handleOAuthCallback(
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();
  const { code, state, error } = req.query;
  const { platform } = req.params;
  const userId = req.user.id;
  const workspaceId = req.user.workspaceId;
  const ipAddress = req.ip;
  
  try {
    // STEP 1: Check for user cancellation
    if (error === 'access_denied') {
      await logSecurityEvent({
        type: 'oauth_cancelled',
        userId,
        workspaceId,
        platform,
      });
      
      return res.status(200).json({
        success: false,
        error: {
          code: 'USER_CANCELLED',
          message: 'User cancelled the connection',
        },
      });
    }
    
    // STEP 2: Validate required parameters
    if (!code || !state) {
      throw new ValidationError('Missing required parameters');
    }
    
    // STEP 3: Acquire distributed lock
    const lockKey = `oauth:lock:${workspaceId}:${platform}:${code}`;
    const lock = await acquireDistributedLock(lockKey, 30000);
    
    if (!lock) {
      throw new ConcurrencyError('Connection already in progress');
    }
    
    try {
      // STEP 4: Validate state parameter
      const stateData = await validateState(
        state as string,
        userId,
        workspaceId,
        ipAddress
      );
      
      // STEP 5: Retrieve PKCE code verifier
      const codeVerifier = await retrievePKCE(state as string);
      
      // STEP 6: Exchange authorization code for tokens
      const tokens = await exchangeCodeForToken(
        code as string,
        codeVerifier,
        platform
      );
      
      // STEP 7: Fetch user profile from platform
      const profile = await fetchUserProfile(
        tokens.access_token,
        platform
      );
      
      // STEP 8: Validate scopes
      const scopeValidation = await validateScopes(
        platform,
        tokens.scope?.split(' ') || []
      );
      
      // STEP 9: Check for multiple accounts
      if (profile.accounts && profile.accounts.length > 1) {
        // Store selection token
        const selectionToken = await storeSelectionToken({
          userId,
          workspaceId,
          platform,
          tokens,
          accounts: profile.accounts,
        });
        
        return res.status(200).json({
          success: true,
          requiresSelection: true,
          accounts: profile.accounts,
          selectionToken,
        });
      }
      
      // STEP 10: Start database transaction
      const session = await mongoose.startSession();
      await session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', j: true },
      });
      
      try {
        // STEP 11: Check for duplicate account
        const existingAccount = await SocialAccount.findOne({
          workspaceId,
          provider: platform,
          providerUserId: profile.id,
          status: { $ne: 'revoked' },
        }).session(session);
        
        if (existingAccount) {
          await session.abortTransaction();
          
          return res.status(200).json({
            success: true,
            account: existingAccount,
            duplicate: true,
          });
        }
        
        // STEP 12: Check cross-tenant conflict
        const crossTenantAccount = await SocialAccount.findOne({
          workspaceId: { $ne: workspaceId },
          provider: platform,
          providerUserId: profile.id,
          status: 'active',
        }).session(session);
        
        if (crossTenantAccount) {
          await session.abortTransaction();
          
          throw new ConflictError('Account connected to another workspace');
        }
        
        // STEP 13: Encrypt tokens
        const encryptedAccessToken = await tokenEncryptionService.encryptToken(
          tokens.access_token
        );
        const encryptedRefreshToken = tokens.refresh_token
          ? await tokenEncryptionService.encryptToken(tokens.refresh_token)
          : undefined;
        
        // STEP 14: Create account record
        const account = new SocialAccount({
          workspaceId,
          provider: platform,
          providerUserId: profile.id,
          accountName: profile.displayName,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : undefined,
          scopes: tokens.scope?.split(' ') || [],
          scopeValidation: {
            validatedAt: new Date(),
            requiredScopes: scopeValidation.requiredScopes,
            optionalScopes: scopeValidation.optionalScopes,
          },
          status: 'active',
          securityMetadata: {
            connectedAt: new Date(),
            connectedBy: userId,
            connectedIP: hashIP(ipAddress),
            usageCount: 0,
            rotationCount: 0,
            suspiciousActivityDetected: false,
          },
          metadata: profile,
        });
        
        await account.save({ session });
        
        // STEP 15: Update usage tracking
        await usageService.incrementAccounts(workspaceId, { session });
        
        // STEP 16: Commit transaction
        await session.commitTransaction();
        
        // STEP 17: Log success
        await logSecurityEvent({
          type: 'oauth_connect_success',
          severity: 'info',
          userId,
          workspaceId,
          accountId: account._id,
          platform,
          duration: Date.now() - startTime,
        });
        
        // STEP 18: Return success
        return res.status(200).json({
          success: true,
          account: account.toJSON(),
        });
        
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
      
    } finally {
      // STEP 19: Release distributed lock
      await releaseDistributedLock(lock);
    }
    
  } catch (error) {
    // STEP 20: Handle errors
    await logSecurityEvent({
      type: 'oauth_connect_failure',
      severity: 'high',
      userId,
      workspaceId,
      platform,
      error: error.message,
      duration: Date.now() - startTime,
    });
    
    // Translate error to user-friendly message
    const userError = translateError(error);
    
    return res.status(error.statusCode || 500).json({
      success: false,
      error: userError,
    });
  }
}
```

---

### 10.2 Validation Checkpoints

| Step | Validation | On Failure | Rollback Required |
|------|------------|------------|-------------------|
| 1 | User cancellation check | Return user_cancelled | No |
| 2 | Required parameters | Return 400 | No |
| 3 | Distributed lock | Return 409 | No |
| 4 | State signature | Return 403 | Yes (clean Redis) |
| 5 | State expiration | Return 403 | Yes (clean Redis) |
| 6 | State user ID | Return 403 | Yes (clean Redis) |
| 7 | State workspace ID | Return 403 | Yes (clean Redis) |
| 8 | State IP hash | Return 403 | Yes (clean Redis) |
| 9 | State replay check | Return 403 | Yes (clean Redis) |
| 10 | PKCE retrieval | Return 403 | Yes (clean Redis) |
| 11 | Token exchange | Return 502 | Yes (clean Redis) |
| 12 | Profile fetch | Return 502 | Yes (clean Redis) |
| 13 | Scope validation | Return 422 | Yes (clean Redis) |
| 14 | Duplicate check | Return existing | No (idempotent) |
| 15 | Cross-tenant check | Return 409 | No |
| 16 | Token encryption | Return 500 | Yes (abort transaction) |
| 17 | Database save | Return 500 | Yes (abort transaction) |
| 18 | Usage update | Return 500 | Yes (abort transaction) |


---

## 11. ERROR HANDLING MATRIX

### 11.1 Complete Error Matrix

| Error Code | HTTP Status | User Title | User Message | Actions | Log Severity | Retry | Alert Team |
|------------|-------------|------------|--------------|---------|--------------|-------|------------|
| USER_CANCELLED | 200 | Connection Cancelled | You cancelled the connection process | Try Again, Close | info | Yes | No |
| MISSING_PARAMETERS | 400 | Invalid Request | Something went wrong. Please try again. | Try Again | medium | Yes | No |
| STATE_SIGNATURE_INVALID | 403 | Connection Failed | The connection request was invalid | Try Again | high | No | Yes |
| STATE_EXPIRED | 403 | Connection Expired | The connection took too long | Try Again | medium | Yes | No |
| STATE_REPLAY_ATTACK | 403 | Connection Failed | This connection was already used | Try Again | critical | No | Yes |
| PKCE_NOT_FOUND | 403 | Connection Failed | The connection request expired | Try Again | high | No | Yes |
| TOKEN_EXCHANGE_FAILED | 502 | Connection Failed | We couldn't complete the connection | Try Again, Contact Support | high | Yes | Yes |
| PROFILE_FETCH_FAILED | 502 | Platform Error | [Platform] is experiencing issues | Try Again Later | medium | Yes | No |
| INSUFFICIENT_SCOPES | 422 | Missing Permissions | Required permissions weren't granted | Try Again, Learn More | high | Yes | No |
| DUPLICATE_ACCOUNT | 200 | Already Connected | This account is already connected | Go to Channels | info | No | No |
| CROSS_TENANT_CONFLICT | 409 | Account Unavailable | Account connected to another workspace | Choose Another | high | No | No |
| ENCRYPTION_FAILED | 500 | System Error | We encountered a system error | Try Again, Contact Support | critical | Yes | Yes |
| DATABASE_ERROR | 500 | System Error | We encountered a system error | Try Again, Contact Support | critical | Yes | Yes |
| NETWORK_ERROR | 502 | Connection Error | Please check your internet connection | Try Again | medium | Yes | No |
| TIMEOUT | 504 | Connection Timeout | The connection took too long | Try Again | medium | Yes | No |
| RATE_LIMIT_EXCEEDED | 429 | Too Many Attempts | Please wait before trying again | Wait 1 minute | medium | No | No |
| CONCURRENT_REQUEST | 409 | Connection In Progress | A connection is already in progress | Wait | low | No | No |
| ACCOUNT_NOT_FOUND | 404 | Account Not Found | This account no longer exists | Choose Another | medium | No | No |
| WORKSPACE_ACCESS_DENIED | 403 | Access Denied | You don't have permission | Contact Admin | high | No | No |
| PLATFORM_NOT_SUPPORTED | 400 | Platform Not Supported | This platform isn't supported yet | Choose Another | low | No | No |
| INVALID_PLATFORM_RESPONSE | 502 | Platform Error | [Platform] returned invalid data | Try Again Later | high | Yes | Yes |
| SELECTION_TOKEN_EXPIRED | 403 | Selection Expired | Please start a new connection | Try Again | medium | Yes | No |
| INVALID_ACCOUNT_SELECTION | 400 | Invalid Selection | Please select a valid account | Go Back | low | No | No |

---

### 11.2 Error Response Format

**Standard Error Response**:
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;              // Machine-readable error code
    message: string;           // User-friendly message
    title: string;             // Error modal title
    details?: string;          // Additional details (optional)
    actions: string[];         // Available actions
    retryable: boolean;        // Can user retry?
    retryAfter?: number;       // Seconds to wait before retry
  };
  meta?: {
    requestId: string;         // For support tracking
    timestamp: string;         // ISO 8601
  };
}
```

**Example**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_SCOPES",
    "title": "Missing Permissions",
    "message": "We couldn't connect your Twitter account because some required permissions weren't granted.",
    "details": "Required permissions: Post tweets, Read profile",
    "actions": ["Try Again", "Learn More"],
    "retryable": true
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-02-27T10:30:00Z"
  }
}
```

---

## 12. IMPLEMENTATION TASK BREAKDOWN

### Week 1: Foundation & State Machine

**Day 1-2: State Machine Setup**
- [ ] Install XState and configure
- [ ] Define all connection states
- [ ] Define state transitions
- [ ] Implement state machine logic
- [ ] Add state machine tests
- [ ] Document state machine

**Day 3-4: Base Components**
- [ ] Create ConnectChannelModal component
- [ ] Create PlatformSelector component
- [ ] Create PlatformTile component
- [ ] Create LoadingScreen component
- [ ] Add component tests
- [ ] Add Storybook stories

**Day 5: API Client**
- [ ] Create OAuth API client
- [ ] Add TypeScript types
- [ ] Implement error handling
- [ ] Add request/response interceptors
- [ ] Add API client tests

---

### Week 2: OAuth Flow Implementation

**Day 1-2: OAuth Initiation**
- [ ] Implement POST /oauth/:platform/authorize endpoint
- [ ] Add state parameter generation
- [ ] Add PKCE generation
- [ ] Store state in Redis
- [ ] Store PKCE in Redis
- [ ] Add rate limiting
- [ ] Add endpoint tests

**Day 3-4: OAuth Callback**
- [ ] Implement GET /oauth/:platform/callback endpoint
- [ ] Add state validation
- [ ] Add PKCE validation
- [ ] Implement token exchange
- [ ] Implement profile fetch
- [ ] Add scope validation
- [ ] Add endpoint tests

**Day 5: Transaction Logic**
- [ ] Implement distributed locking
- [ ] Add MongoDB transaction wrapper
- [ ] Implement duplicate check
- [ ] Implement cross-tenant check
- [ ] Add rollback logic
- [ ] Add transaction tests

---

### Week 3: Multi-Account & Success Flow

**Day 1-2: Multi-Account Handling**
- [ ] Create AccountPicker component
- [ ] Create AccountCard component
- [ ] Implement selection token storage
- [ ] Implement POST /oauth/:platform/finalize endpoint
- [ ] Add multi-select support
- [ ] Add component tests

**Day 3-4: Success & Error States**
- [ ] Create SuccessScreen component
- [ ] Add success animation
- [ ] Create ErrorScreen component
- [ ] Implement error translation layer
- [ ] Add error recovery flows
- [ ] Add component tests

**Day 5: Account Management**
- [ ] Create ChannelCard component
- [ ] Add health indicators
- [ ] Implement disconnect flow
- [ ] Implement reconnect flow
- [ ] Add confirmation modals
- [ ] Add component tests

---

### Week 4: Polish & Testing

**Day 1-2: Performance Optimization**
- [ ] Add code splitting
- [ ] Implement request deduplication
- [ ] Add caching layer
- [ ] Optimize database queries
- [ ] Add performance monitoring
- [ ] Run performance tests

**Day 3: Edge Cases**
- [ ] Test all edge cases from matrix
- [ ] Add timeout handling
- [ ] Add retry logic
- [ ] Test concurrent requests
- [ ] Test network failures
- [ ] Document edge cases

**Day 4: Integration Testing**
- [ ] Write E2E tests for happy path
- [ ] Write E2E tests for error paths
- [ ] Test with real OAuth providers (sandbox)
- [ ] Test multi-account flow
- [ ] Test reconnect flow
- [ ] Run full test suite

**Day 5: Documentation & Launch**
- [ ] Write user documentation
- [ ] Write developer documentation
- [ ] Create demo video
- [ ] Prepare launch checklist
- [ ] Final QA review
- [ ] Deploy to production

---

## 13. RISK ASSESSMENT

### 13.1 Technical Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| OAuth provider API changes | Medium | High | Version API calls, monitor provider changelogs | Backend Lead |
| State machine complexity | Low | Medium | Use XState, extensive testing | Frontend Lead |
| Race conditions in DB | Low | High | Distributed locks, transactions | Backend Lead |
| Token encryption failure | Low | Critical | Fallback encryption, monitoring | Security Lead |
| Performance degradation | Medium | Medium | Load testing, caching, optimization | DevOps Lead |
| Third-party API downtime | High | High | Retry logic, graceful degradation | Backend Lead |
| Browser compatibility | Low | Medium | Cross-browser testing, polyfills | Frontend Lead |
| Mobile responsiveness | Low | Low | Responsive design, mobile testing | Frontend Lead |

---

### 13.2 Security Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| CSRF attack | Low | Critical | State parameter validation, HMAC | Security Lead |
| Token theft | Low | Critical | Envelope encryption, KMS | Security Lead |
| Replay attack | Low | High | Single-use state, Redis tracking | Security Lead |
| Cross-tenant access | Low | Critical | Strict validation, unique constraints | Backend Lead |
| Scope downgrade | Medium | High | Strict scope validation | Backend Lead |
| Man-in-the-middle | Low | Critical | TLS 1.3, certificate pinning | DevOps Lead |
| Session hijacking | Low | High | IP binding, session validation | Security Lead |
| Rate limit bypass | Medium | Medium | Distributed rate limiting | Backend Lead |

---

### 13.3 UX Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Confusing error messages | Medium | Medium | User testing, clear copy | Product Lead |
| Slow loading times | Medium | High | Performance optimization, progress indicators | Frontend Lead |
| User abandonment | High | High | Smooth flow, clear CTAs, reassurance | Product Lead |
| Platform permission confusion | High | Medium | Clear explanations, help docs | Product Lead |
| Multi-account confusion | Medium | Medium | Clear UI, account previews | Product Lead |
| Mobile UX issues | Low | Medium | Mobile-first design, testing | Frontend Lead |
| Accessibility issues | Medium | Medium | WCAG compliance, screen reader testing | Frontend Lead |

---

### 13.4 Business Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| OAuth provider policy changes | Medium | High | Monitor policies, legal review | Legal Lead |
| Rate limit restrictions | High | Medium | Optimize API usage, caching | Backend Lead |
| Cost of API calls | Medium | Medium | Efficient API usage, monitoring | Product Lead |
| User adoption | Medium | High | User education, onboarding | Product Lead |
| Support burden | High | Medium | Clear docs, self-service tools | Support Lead |
| Compliance issues | Low | Critical | Legal review, audit trail | Legal Lead |

---

## 14. PRODUCTION CHECKLIST

### 14.1 Pre-Launch Checklist

**Security**:
- [ ] All OAuth endpoints use HTTPS only
- [ ] State parameter validation implemented
- [ ] PKCE implemented for all platforms
- [ ] Token encryption enabled
- [ ] KMS integration configured
- [ ] Rate limiting enabled
- [ ] CSRF protection enabled
- [ ] Security audit completed
- [ ] Penetration testing completed
- [ ] Vulnerability scan passed

**Performance**:
- [ ] Load testing completed (1000 concurrent users)
- [ ] Database indexes optimized
- [ ] Redis connection pooling configured
- [ ] API response times < 2s (p95)
- [ ] Frontend bundle size < 500KB
- [ ] Code splitting implemented
- [ ] Caching strategy implemented
- [ ] CDN configured for static assets

**Functionality**:
- [ ] All platforms tested (Twitter, LinkedIn, Facebook, Instagram)
- [ ] Multi-account flow tested
- [ ] Reconnect flow tested
- [ ] Disconnect flow tested
- [ ] Error handling tested for all scenarios
- [ ] Edge cases tested
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility verified (Chrome, Firefox, Safari, Edge)
- [ ] Accessibility audit passed (WCAG 2.1 AA)

**Monitoring**:
- [ ] Error tracking configured (Sentry)
- [ ] Performance monitoring configured (New Relic/DataDog)
- [ ] Analytics tracking configured
- [ ] Security event logging configured
- [ ] Alerts configured for critical errors
- [ ] Dashboard created for key metrics
- [ ] On-call rotation established

**Documentation**:
- [ ] User documentation written
- [ ] Developer documentation written
- [ ] API documentation published
- [ ] Troubleshooting guide created
- [ ] FAQ created
- [ ] Video tutorials recorded
- [ ] Support team trained

**Legal & Compliance**:
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] OAuth provider terms reviewed
- [ ] Data retention policy defined
- [ ] GDPR compliance verified
- [ ] SOC 2 controls documented

---

### 14.2 Launch Day Checklist

**Pre-Launch (T-24h)**:
- [ ] Final code review completed
- [ ] All tests passing
- [ ] Staging environment tested
- [ ] Database backups verified
- [ ] Rollback plan documented
- [ ] Team briefed on launch plan
- [ ] Support team on standby

**Launch (T-0)**:
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Run smoke tests
- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Check security logs
- [ ] Verify OAuth flows working

**Post-Launch (T+1h)**:
- [ ] Monitor user adoption
- [ ] Check error rates
- [ ] Review user feedback
- [ ] Address critical issues
- [ ] Update status page

**Post-Launch (T+24h)**:
- [ ] Review metrics dashboard
- [ ] Analyze user behavior
- [ ] Identify improvement areas
- [ ] Plan iteration 1
- [ ] Document lessons learned

---

### 14.3 Success Metrics

**Adoption Metrics**:
- Target: 80% of users connect at least one channel within 7 days
- Target: Average 2.5 channels per user
- Target: < 5% abandonment rate during OAuth flow

**Performance Metrics**:
- Target: < 2s average OAuth callback processing time
- Target: < 100ms state validation time
- Target: < 500ms database transaction time
- Target: > 99.9% uptime

**Quality Metrics**:
- Target: < 1% error rate
- Target: < 0.1% security incidents
- Target: > 4.5/5 user satisfaction score
- Target: < 5% support ticket rate

**Business Metrics**:
- Target: 50% increase in active users
- Target: 30% increase in posts scheduled
- Target: 20% decrease in churn rate
- Target: Positive ROI within 3 months

---

## APPENDIX A: Platform-Specific Requirements

### Twitter/X
- OAuth 2.0 with PKCE required
- Scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
- Token expiry: 2 hours (access token), no expiry (refresh token)
- Rate limits: 15 requests per 15 minutes
- Special notes: Must use OAuth 2.0 (OAuth 1.0a deprecated)

### LinkedIn
- OAuth 2.0
- Scopes: `w_member_social`, `r_liteprofile`, `r_organization_social` (optional)
- Token expiry: 60 days (access token), 1 year (refresh token)
- Rate limits: Varies by endpoint
- Special notes: Organization pages require additional permissions

### Facebook
- OAuth 2.0
- Scopes: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`
- Token expiry: 60 days (short-lived), no expiry (long-lived)
- Rate limits: 200 calls per hour per user
- Special notes: Must select Page, personal profile not supported

### Instagram
- OAuth 2.0 (via Facebook)
- Scopes: `instagram_basic`, `instagram_content_publish`
- Token expiry: 60 days (short-lived), no expiry (long-lived)
- Rate limits: 200 calls per hour per user
- Special notes: Business or Creator account required

---

## APPENDIX B: Glossary

**PKCE**: Proof Key for Code Exchange - OAuth security extension  
**State Parameter**: CSRF protection token in OAuth flow  
**Envelope Encryption**: Two-layer encryption (DEK + KEK)  
**Distributed Lock**: Prevents concurrent access across multiple servers  
**Idempotent**: Operation that produces same result when called multiple times  
**Cross-Tenant**: Accessing data from different workspace  
**Scope**: Permission granted by user to application  
**Token Rotation**: Replacing old token with new one  
**Rate Limiting**: Restricting number of requests per time period  

---

**END OF SPECIFICATION**

**Document Status**: COMPLETE  
**Last Updated**: 2026-02-27  
**Next Review**: 2026-03-13  
**Owner**: Product Team  
**Approvers**: CTO, Head of Product, Head of Design, Security Lead
