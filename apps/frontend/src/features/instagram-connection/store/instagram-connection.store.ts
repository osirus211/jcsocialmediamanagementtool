/**
 * Instagram Connection Store (Zustand)
 * 
 * State management for Instagram Business account connection flow
 * 
 * Requirements: All requirements (state management foundation)
 */

import { create } from 'zustand';
import type {
  InstagramConnectionState,
  ChecklistItem,
  ConnectionState,
  ConnectionError,
  DiagnosticData,
  DiscoveredInstagramAccount,
} from '../types';
import { categorizeError } from '../utils/error-categorization';

const INITIAL_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'business_account',
    label: 'Instagram Business or Creator Account',
    description: 'Your Instagram account must be converted to a Business or Creator account type.',
    checked: false,
    required: true,
  },
  {
    id: 'facebook_page',
    label: 'Linked to Facebook Page',
    description: 'Your Instagram Business account must be connected to a Facebook Page.',
    checked: false,
    required: true,
  },
  {
    id: 'admin_access',
    label: 'Admin Access to Facebook Page',
    description: 'You must have admin-level access to the Facebook Page.',
    checked: false,
    required: true,
  },
];

const INITIAL_CONNECTION_STATE: ConnectionState = {
  step: 'idle',
  progress: 0,
  message: '',
};

export const useInstagramConnectionStore = create<InstagramConnectionState>((set, get) => ({
  // Initial state
  checklistCompleted: false,
  checklistItems: INITIAL_CHECKLIST_ITEMS,
  connectionState: INITIAL_CONNECTION_STATE,
  oauthState: null,
  discoveredAccounts: [],
  selectedAccountIds: [],
  lastError: null,
  diagnosticData: null,

  // Checklist actions
  setChecklistItem: (id: string, checked: boolean) => {
    set(state => {
      const updatedItems = state.checklistItems.map(item =>
        item.id === id ? { ...item, checked } : item
      );

      const allRequiredChecked = updatedItems
        .filter(item => item.required)
        .every(item => item.checked);

      return {
        checklistItems: updatedItems,
        checklistCompleted: allRequiredChecked,
      };
    });
  },

  completeChecklist: () => {
    set({ checklistCompleted: true });
  },

  resetChecklist: () => {
    set({
      checklistItems: INITIAL_CHECKLIST_ITEMS,
      checklistCompleted: false,
    });
  },

  // Connection flow actions
  startConnection: async () => {
    try {
      set({
        connectionState: {
          step: 'authorizing',
          progress: 20,
          message: 'Redirecting to Facebook for authorization...',
        },
      });

      // Import service dynamically
      const { instagramConnectionService } = await import('../services/instagram-connection.service');

      // Get OAuth URL
      const response = await instagramConnectionService.initiateOAuth();

      // Store OAuth state in sessionStorage for validation
      sessionStorage.setItem('instagram-oauth-state', response.state);
      sessionStorage.setItem('instagram-oauth-timestamp', Date.now().toString());

      // Redirect to Facebook OAuth
      window.location.href = response.authorizationUrl;
    } catch (error: any) {
      const categorizedError = categorizeError(error);
      set({
        lastError: categorizedError,
        connectionState: {
          step: 'error',
          progress: 0,
          message: 'Failed to start connection',
          error: categorizedError,
        },
      });
    }
  },

  handleOAuthCallback: async (code: string, state: string) => {
    try {
      // Validate state parameter
      const storedState = sessionStorage.getItem('instagram-oauth-state');
      const timestamp = sessionStorage.getItem('instagram-oauth-timestamp');

      if (!storedState || storedState !== state) {
        throw new Error('Invalid OAuth state parameter');
      }

      // Check if state is expired (5 minutes)
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age > 5 * 60 * 1000) {
          throw new Error('OAuth state expired');
        }
      }

      // Clear stored state
      sessionStorage.removeItem('instagram-oauth-state');
      sessionStorage.removeItem('instagram-oauth-timestamp');

      set({
        connectionState: {
          step: 'exchanging',
          progress: 40,
          message: 'Exchanging authorization code for access token...',
        },
      });

      // The backend handles token exchange automatically via the callback URL
      // We just need to check the connection status
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay for backend processing

      set({
        connectionState: {
          step: 'discovering',
          progress: 60,
          message: 'Discovering Instagram Business accounts...',
        },
      });

      // Import service dynamically
      const { instagramConnectionService } = await import('../services/instagram-connection.service');

      // Check connection status and get discovered accounts
      const result = await instagramConnectionService.checkConnectionStatus();

      if (!result.success || !result.accounts || result.accounts.length === 0) {
        throw new Error(result.error || 'No Instagram Business accounts found');
      }

      set({
        discoveredAccounts: result.accounts,
        connectionState: {
          step: 'complete',
          progress: 100,
          message: `Successfully connected ${result.accounts.length} Instagram ${result.accounts.length === 1 ? 'account' : 'accounts'}!`,
          accounts: result.accounts,
        },
      });
    } catch (error: any) {
      const categorizedError = categorizeError(error);
      set({
        lastError: categorizedError,
        connectionState: {
          step: 'error',
          progress: 0,
          message: 'Connection failed',
          error: categorizedError,
        },
      });
    }
  },

  setConnectionState: (stateUpdate: Partial<ConnectionState>) => {
    set(state => ({
      connectionState: {
        ...state.connectionState,
        ...stateUpdate,
      },
    }));
  },

  // Account selection actions
  selectAccounts: (ids: string[]) => {
    set({ selectedAccountIds: ids });
  },

  saveSelectedAccounts: async () => {
    // TODO: Implement in Phase 3
    set({
      connectionState: {
        step: 'saving',
        progress: 80,
        message: 'Saving accounts...',
      },
    });
  },

  // Error handling actions
  setError: (error: ConnectionError) => {
    set({
      lastError: error,
      connectionState: {
        step: 'error',
        progress: 0,
        message: error.userMessage,
        error,
      },
    });
  },

  clearError: () => {
    set({
      lastError: null,
      diagnosticData: null,
    });
  },

  retryConnection: async () => {
    // Clear error state and restart connection
    set({
      lastError: null,
      diagnosticData: null,
      connectionState: INITIAL_CONNECTION_STATE,
    });

    // Restart connection flow
    await get().startConnection();
  },
}));
