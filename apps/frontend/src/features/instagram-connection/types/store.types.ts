/**
 * Instagram Connection Store - Type Definitions
 * 
 * State management types for Zustand store
 */

import type {
  ChecklistItem,
  ConnectionState,
  ConnectionError,
  DiagnosticData,
  DiscoveredInstagramAccount,
} from './connection.types';

/**
 * Instagram connection store state
 */
export interface InstagramConnectionState {
  // Pre-connection validation
  checklistCompleted: boolean;
  checklistItems: ChecklistItem[];
  
  // Connection flow
  connectionState: ConnectionState;
  oauthState: string | null;
  
  // Discovered accounts
  discoveredAccounts: DiscoveredInstagramAccount[];
  selectedAccountIds: string[];
  
  // Diagnostics
  lastError: ConnectionError | null;
  diagnosticData: DiagnosticData | null;
  
  // Actions
  setChecklistItem: (id: string, checked: boolean) => void;
  completeChecklist: () => void;
  resetChecklist: () => void;
  
  startConnection: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<void>;
  
  setConnectionState: (state: Partial<ConnectionState>) => void;
  
  selectAccounts: (ids: string[]) => void;
  saveSelectedAccounts: () => Promise<void>;
  
  setError: (error: ConnectionError) => void;
  clearError: () => void;
  
  retryConnection: () => Promise<void>;
}

/**
 * Error state
 */
export interface ErrorState {
  error: ConnectionError | null;
  retryCount: number;
  lastRetryAt: Date | null;
  recoveryInProgress: boolean;
  diagnosticReport: DiagnosticData | null;
}
