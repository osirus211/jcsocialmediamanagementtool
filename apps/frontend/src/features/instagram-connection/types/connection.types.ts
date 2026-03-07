/**
 * Instagram Connection Feature - Type Definitions
 * 
 * Core TypeScript interfaces for Instagram Business account connection flow
 */

/**
 * Connection state machine states
 */
export type ConnectionStep = 
  | 'idle'
  | 'authorizing'
  | 'exchanging'
  | 'discovering'
  | 'saving'
  | 'complete'
  | 'error';

/**
 * Connection state
 */
export interface ConnectionState {
  step: ConnectionStep;
  progress: number;
  message: string;
  accounts?: DiscoveredInstagramAccount[];
  error?: ConnectionError;
}

/**
 * Discovered Instagram Business account
 */
export interface DiscoveredInstagramAccount {
  id: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  biography?: string;
  website?: string;
  pageId: string;
  pageName: string;
  alreadyConnected: boolean;
}

/**
 * Connection error types
 */
export type ConnectionErrorType =
  | 'no_accounts'
  | 'no_pages'
  | 'no_instagram_linked'
  | 'permission_denied'
  | 'personal_account'
  | 'token_exchange_failed'
  | 'network_error'
  | 'unknown';

/**
 * Connection error
 */
export interface ConnectionError {
  type: ConnectionErrorType;
  message: string;
  userMessage: string;
  technicalDetails?: any;
  recoverable: boolean;
  suggestedAction: string;
  helpUrl?: string;
  retryable: boolean;
  timestamp: Date;
}

/**
 * Diagnostic report
 */
export interface DiagnosticReport {
  id: string;
  workspaceId: string;
  userId: string;
  timestamp: Date;
  
  // OAuth flow data
  oauthInitiated: boolean;
  oauthCompleted: boolean;
  tokenExchangeSuccess: boolean;
  
  // Facebook data
  facebookUserId?: string;
  facebookPagesFound: number;
  facebookPages: Array<{
    id: string;
    name: string;
    hasAdminAccess: boolean;
    hasInstagramAccount: boolean;
  }>;
  
  // Instagram data
  instagramAccountsFound: number;
  instagramAccounts: Array<{
    id: string;
    username: string;
    pageId: string;
    pageName: string;
  }>;
  
  // Permissions
  permissionsRequested: string[];
  permissionsGranted: string[];
  permissionsMissing: string[];
  
  // Error data
  error?: ConnectionError;
  
  // User agent and environment
  userAgent: string;
  ipAddress: string;
}

/**
 * Diagnostic data (simplified for UI)
 */
export interface DiagnosticData {
  facebookPagesFound: number;
  facebookPagesWithAdmin: number;
  instagramAccountsFound: number;
  permissionsGranted: string[];
  permissionsMissing: string[];
  tokenExchangeSuccess: boolean;
  timestamp: Date;
}

/**
 * Checklist item
 */
export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  required: boolean;
}

/**
 * Token expiration status
 */
export type ExpirationSeverity = 'info' | 'warning' | 'critical' | 'expired';

export interface ExpirationStatus {
  daysUntilExpiration: number;
  severity: ExpirationSeverity;
  message: string;
  actionRequired: boolean;
}

/**
 * Instruction step
 */
export interface InstructionStep {
  id: string;
  title: string;
  description: string;
  mobileInstructions: string[];
  webInstructions: string[];
  screenshots?: string[];
  videoUrl?: string;
}
