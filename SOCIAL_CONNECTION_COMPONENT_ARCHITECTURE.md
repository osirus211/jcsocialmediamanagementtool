# Social Account Connection - Component Architecture

## Frontend Component Structure

### Component Hierarchy

```
ConnectedAccountsPage
├── AccountList
│   ├── AccountCard (multiple)
│   │   ├── PlatformIcon
│   │   ├── AccountInfo
│   │   ├── StatusBadge
│   │   ├── TokenExpiryWarning (conditional)
│   │   └── AccountActions
│   │       ├── SyncButton
│   │       ├── ReconnectButton (conditional)
│   │       └── DisconnectButton
│   └── EmptyState (conditional)
├── ConnectAccountButton
└── ConnectModal (when open)
    ├── PlatformSelection (step 1)
    │   └── PlatformButton (multiple)
    ├── PermissionExplanation (step 2)
    │   ├── PermissionList
    │   └── PrivacyPolicyLink
    ├── OAuthProgress (step 3)
    │   ├── LoadingSpinner
    │   ├── ProgressMessage
    │   └── CancelButton
    ├── ConnectionSuccess (step 4)
    │   ├── SuccessAnimation
    │   ├── AccountPreview
    │   ├── RenameInput
    │   └── DoneButton
    └── ConnectionError (step 5)
        ├── ErrorIcon
        ├── ErrorMessage
        ├── SuggestedAction
        ├── RetryButton (conditional)
        └── HelpLink
```

### Component Specifications

#### 1. ConnectModal

**Purpose**: Orchestrates the entire connection flow

**Props**:
```typescript
interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: SocialAccount) => void;
  initialPlatform?: SocialPlatform;
}
```

**State**:
```typescript
interface ConnectModalState {
  step: 'platform' | 'permissions' | 'oauth' | 'success' | 'error';
  selectedPlatform: SocialPlatform | null;
  oauthWindow: Window | null;
  error: ConnectionError | null;
  connectedAccount: SocialAccount | null;
  isLoading: boolean;
}
```

**Key Methods**:
- `handlePlatformSelect(platform: SocialPlatform)`
- `handleContinueToOAuth()`
- `handleOAuthComplete(account: SocialAccount)`
- `handleOAuthError(error: ConnectionError)`
- `handleRetry()`
- `handleCancel()`

#### 2. PlatformSelection

**Purpose**: Display available platforms for connection

**Props**:
```typescript
interface PlatformSelectionProps {
  connectedPlatforms: SocialPlatform[];
  onSelect: (platform: SocialPlatform) => void;
  isLoading: boolean;
}
```

**Features**:
- Shows all 4 platforms (Twitter, LinkedIn, Facebook, Instagram)
- Disables already connected platforms
- Shows "Reconnect" option for expired accounts
- Platform icons and names
- Brief description for each

#### 3. PermissionExplanation

**Purpose**: Explain required permissions before OAuth

**Props**:
```typescript
interface PermissionExplanationProps {
  platform: SocialPlatform;
  permissions: Permission[];
  onContinue: () => void;
  onCancel: () => void;
}
```

**Data Structure**:
```typescript
interface Permission {
  scope: string;
  name: string;
  description: string;
  required: boolean;
  icon: string;
}
```

**Example Permissions**:
```typescript
const twitterPermissions: Permission[] = [
  {
    scope: 'tweet.read',
    name: 'Read your tweets',
    description: 'View your tweets and profile information',
    required: true,
    icon: '👁️',
  },
  {
    scope: 'tweet.write',
    name: 'Post tweets',
    description: 'Create and publish tweets on your behalf',
    required: true,
    icon: '✍️',
  },
  {
    scope: 'offline.access',
    name: 'Stay connected',
    description: 'Keep your account connected without re-authorization',
    required: true,
    icon: '🔄',
  },
];
```

#### 4. OAuthProgress

**Purpose**: Show loading state during OAuth flow

**Props**:
```typescript
interface OAuthProgressProps {
  platform: SocialPlatform;
  step: 'initiating' | 'authorizing' | 'validating' | 'creating';
  onCancel: () => void;
}
```

**Progress Messages**:
```typescript
const progressMessages = {
  initiating: 'Opening authorization window...',
  authorizing: 'Waiting for your authorization...',
  validating: 'Verifying your connection...',
  creating: 'Setting up your account...',
};
```

#### 5. ConnectionSuccess

**Purpose**: Show success state and allow account renaming

**Props**:
```typescript
interface ConnectionSuccessProps {
  account: SocialAccount;
  onRename: (newName: string) => Promise<void>;
  onDone: () => void;
}
```

**Features**:
- Success animation (checkmark)
- Account avatar
- Account name
- Rename input field
- "Done" button

#### 6. ConnectionError

**Purpose**: Display error with actionable guidance

**Props**:
```typescript
interface ConnectionErrorProps {
  error: ConnectionError;
  onRetry: () => void;
  onCancel: () => void;
  onGetHelp: () => void;
}
```

**Error Types**:
```typescript
interface ConnectionError {
  code: string;
  message: string;
  userMessage: string;
  suggestedAction: string;
  retryable: boolean;
  helpUrl?: string;
}
```

**Error Messages**:
```typescript
const errorMessages = {
  user_cancelled: {
    userMessage: 'Connection cancelled',
    suggestedAction: 'Click "Try Again" to reconnect',
    retryable: true,
  },
  permission_denied: {
    userMessage: 'We need these permissions to connect your account',
    suggestedAction: 'Please grant all required permissions',
    retryable: true,
  },
  invalid_scopes: {
    userMessage: 'Missing required permissions',
    suggestedAction: 'Reconnect and grant all permissions',
    retryable: true,
  },
  duplicate_account: {
    userMessage: 'This account is already connected',
    suggestedAction: 'Go to your connected accounts',
    retryable: false,
  },
  plan_limit: {
    userMessage: "You've reached your plan limit",
    suggestedAction: 'Upgrade your plan to connect more accounts',
    retryable: false,
  },
  network_error: {
    userMessage: 'Connection failed',
    suggestedAction: 'Check your internet and try again',
    retryable: true,
  },
  platform_error: {
    userMessage: 'Platform temporarily unavailable',
    suggestedAction: 'Try again in a few minutes',
    retryable: true,
  },
};
```

#### 7. AccountCard

**Purpose**: Display connected account with actions

**Props**:
```typescript
interface AccountCardProps {
  account: SocialAccount;
  onSync: (accountId: string) => Promise<void>;
  onReconnect: (accountId: string) => void;
  onDisconnect: (accountId: string) => Promise<void>;
}
```

**Features**:
- Platform icon
- Account name and username
- Avatar image
- Status badge (Active/Expired/Revoked)
- Last sync time
- Token expiry warning (if < 7 days)
- Action buttons (Sync, Reconnect, Disconnect)

#### 8. TokenExpiryWarning

**Purpose**: Warn user about expiring tokens

**Props**:
```typescript
interface TokenExpiryWarningProps {
  account: SocialAccount;
  expiresIn: number; // milliseconds
  onReconnect: () => void;
}
```

**Display Logic**:
```typescript
function getExpiryMessage(expiresIn: number): string {
  const days = Math.floor(expiresIn / (1000 * 60 * 60 * 24));
  const hours = Math.floor(expiresIn / (1000 * 60 * 60));
  
  if (days > 7) return null; // Don't show warning
  if (days > 1) return `Expires in ${days} days`;
  if (hours > 1) return `Expires in ${hours} hours`;
  return 'Expires soon';
}
```

---

## State Management

### Store Structure

```typescript
interface SocialAccountStore {
  // State
  accounts: SocialAccount[];
  isLoading: boolean;
  accountsLoaded: boolean;
  connectionInProgress: boolean;
  currentOAuthState: OAuthState | null;
  
  // Actions
  fetchAccounts: () => Promise<void>;
  connectAccount: (platform: SocialPlatform) => Promise<OAuthState>;
  completeConnection: (code: string, state: string) => Promise<SocialAccount>;
  disconnectAccount: (accountId: string) => Promise<void>;
  syncAccount: (accountId: string) => Promise<SocialAccount>;
  renameAccount: (accountId: string, name: string) => Promise<SocialAccount>;
  refreshToken: (accountId: string) => Promise<SocialAccount>;
  clearAccounts: () => void;
  
  // Selectors
  getAccountsByPlatform: (platform: SocialPlatform) => SocialAccount[];
  getActiveAccounts: () => SocialAccount[];
  getExpiredAccounts: () => SocialAccount[];
  isAccountConnected: (platform: SocialPlatform) => boolean;
}
```

### OAuth State

```typescript
interface OAuthState {
  platform: SocialPlatform;
  state: string;
  authUrl: string;
  expiresAt: Date;
  window: Window | null;
}
```

### Connection Flow State Machine

```typescript
type ConnectionState =
  | { type: 'idle' }
  | { type: 'platform_selection' }
  | { type: 'permission_explanation'; platform: SocialPlatform }
  | { type: 'oauth_initiating'; platform: SocialPlatform }
  | { type: 'oauth_in_progress'; platform: SocialPlatform; window: Window }
  | { type: 'validating_token'; platform: SocialPlatform }
  | { type: 'fetching_profile'; platform: SocialPlatform }
  | { type: 'creating_account'; platform: SocialPlatform }
  | { type: 'success'; account: SocialAccount }
  | { type: 'error'; error: ConnectionError; retryable: boolean };

type ConnectionEvent =
  | { type: 'SELECT_PLATFORM'; platform: SocialPlatform }
  | { type: 'CONTINUE_TO_OAUTH' }
  | { type: 'OAUTH_INITIATED'; authUrl: string; state: string }
  | { type: 'OAUTH_WINDOW_OPENED'; window: Window }
  | { type: 'OAUTH_CALLBACK_RECEIVED'; code: string; state: string }
  | { type: 'TOKEN_VALIDATED' }
  | { type: 'PROFILE_FETCHED' }
  | { type: 'ACCOUNT_CREATED'; account: SocialAccount }
  | { type: 'ERROR'; error: ConnectionError }
  | { type: 'RETRY' }
  | { type: 'CANCEL' };
```

---

## Custom Hooks

### useOAuthFlow

**Purpose**: Manage OAuth flow state and window

```typescript
function useOAuthFlow() {
  const [state, setState] = useState<ConnectionState>({ type: 'idle' });
  const [oauthWindow, setOAuthWindow] = useState<Window | null>(null);
  
  const initiateOAuth = async (platform: SocialPlatform) => {
    setState({ type: 'oauth_initiating', platform });
    
    // Get OAuth URL from backend
    const { authUrl, state: oauthState } = await api.getOAuthUrl(platform);
    
    // Open popup window
    const popup = openOAuthPopup(authUrl);
    setOAuthWindow(popup);
    
    setState({ type: 'oauth_in_progress', platform, window: popup });
    
    // Poll for callback completion
    pollForCallback(oauthState);
  };
  
  const pollForCallback = (oauthState: string) => {
    const interval = setInterval(async () => {
      try {
        const result = await api.checkOAuthStatus(oauthState);
        
        if (result.completed) {
          clearInterval(interval);
          handleOAuthComplete(result.account);
        }
      } catch (error) {
        clearInterval(interval);
        handleOAuthError(error);
      }
    }, 1000);
  };
  
  return {
    state,
    initiateOAuth,
    cancelOAuth,
    retryOAuth,
  };
}
```

### useAccountHealth

**Purpose**: Monitor account health and token expiry

```typescript
function useAccountHealth(accountId: string) {
  const [health, setHealth] = useState<AccountHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  useEffect(() => {
    const checkHealth = async () => {
      setIsChecking(true);
      const result = await api.checkAccountHealth(accountId);
      setHealth(result);
      setIsChecking(false);
    };
    
    checkHealth();
    
    // Check every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [accountId]);
  
  return { health, isChecking };
}
```

---

## Utility Functions

### OAuth Window Management

```typescript
function openOAuthPopup(url: string): Window | null {
  const width = 600;
  const height = 700;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;
  
  const popup = window.open(
    url,
    'oauth_popup',
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
  );
  
  if (!popup) {
    throw new Error('Popup blocked - please allow popups for this site');
  }
  
  return popup;
}

function closeOAuthPopup(popup: Window | null) {
  if (popup && !popup.closed) {
    popup.close();
  }
}

function isPopupBlocked(): boolean {
  const popup = window.open('', '_blank', 'width=1,height=1');
  
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    return true;
  }
  
  popup.close();
  return false;
}
```

### Error Categorization

```typescript
function categorizeError(error: any): ConnectionError {
  // User cancelled
  if (error.code === 'user_cancelled' || error.message?.includes('cancelled')) {
    return {
      code: 'user_cancelled',
      message: error.message,
      userMessage: 'Connection cancelled',
      suggestedAction: 'Click "Try Again" to reconnect',
      retryable: true,
    };
  }
  
  // Permission denied
  if (error.code === 'permission_denied' || error.message?.includes('denied')) {
    return {
      code: 'permission_denied',
      message: error.message,
      userMessage: 'We need these permissions to connect your account',
      suggestedAction: 'Please grant all required permissions',
      retryable: true,
    };
  }
  
  // Network error
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return {
      code: 'network_error',
      message: error.message,
      userMessage: 'Connection failed',
      suggestedAction: 'Check your internet and try again',
      retryable: true,
    };
  }
  
  // Default error
  return {
    code: 'unknown_error',
    message: error.message,
    userMessage: 'Something went wrong',
    suggestedAction: 'Please try again or contact support',
    retryable: true,
    helpUrl: '/help/connection-issues',
  };
}
```

---

This component architecture provides a complete, production-ready structure for implementing Buffer-level OAuth connection flow.

