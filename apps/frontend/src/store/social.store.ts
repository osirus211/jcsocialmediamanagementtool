import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import {
  SocialAccount,
  ConnectAccountInput,
  SocialAccountsResponse,
  SocialAccountResponse,
} from '@/types/social.types';

interface SocialAccountState {
  accounts: SocialAccount[];
  isLoading: boolean;
  accountsLoaded: boolean;
}

interface SocialAccountActions {
  setAccounts: (accounts: SocialAccount[]) => void;
  setLoading: (loading: boolean) => void;
  setAccountsLoaded: (loaded: boolean) => void;

  fetchAccounts: () => Promise<void>;
  connectAccount: (input: ConnectAccountInput) => Promise<SocialAccount>;
  disconnectAccount: (accountId: string) => Promise<void>;
  syncAccount: (accountId: string) => Promise<SocialAccount>;
  clearAccounts: () => void;
}

interface SocialAccountStore extends SocialAccountState, SocialAccountActions {}

/**
 * Social account store
 * Manages connected social media accounts per workspace
 */
export const useSocialAccountStore = create<SocialAccountStore>((set, get) => ({
  // Initial state
  accounts: [],
  isLoading: false,
  accountsLoaded: false,

  // Setters
  setAccounts: (accounts) => set({ accounts }),
  setLoading: (loading) => set({ isLoading: loading }),
  setAccountsLoaded: (loaded) => set({ accountsLoaded: loaded }),

  /**
   * Fetch all social accounts for current workspace
   */
  fetchAccounts: async () => {
    try {
      set({ isLoading: true });

      const response = await apiClient.get<SocialAccountsResponse>('/social/accounts');

      set({
        accounts: response.accounts,
        accountsLoaded: true,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Fetch social accounts error:', error);
      set({ isLoading: false, accountsLoaded: true });
      throw error;
    }
  },

  /**
   * Connect new social account
   */
  connectAccount: async (input: ConnectAccountInput) => {
    try {
      set({ isLoading: true });

      const response = await apiClient.post<SocialAccountResponse>(
        '/social/accounts',
        input
      );

      const newAccount = response.account;

      // Add to accounts list
      set((state) => ({
        accounts: [newAccount, ...state.accounts],
        isLoading: false,
      }));

      return newAccount;
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Connect account error:', error);
      throw error;
    }
  },

  /**
   * Disconnect social account
   */
  disconnectAccount: async (accountId: string) => {
    try {
      set({ isLoading: true });

      await apiClient.delete(`/social/accounts/${accountId}`);

      // Remove from accounts list
      set((state) => ({
        accounts: state.accounts.filter((a) => a._id !== accountId),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Disconnect account error:', error);
      throw error;
    }
  },

  /**
   * Sync account info from platform
   */
  syncAccount: async (accountId: string) => {
    try {
      set({ isLoading: true });

      const response = await apiClient.post<SocialAccountResponse>(
        `/social/accounts/${accountId}/sync`,
        {}
      );

      const updatedAccount = response.account;

      // Update in accounts list
      set((state) => ({
        accounts: state.accounts.map((a) =>
          a._id === accountId ? updatedAccount : a
        ),
        isLoading: false,
      }));

      return updatedAccount;
    } catch (error: any) {
      set({ isLoading: false });
      
      // Check if it's a token expiration error
      if (error.response?.data?.error === 'TOKEN_EXPIRED' || error.response?.data?.requiresReconnect) {
        // Update account status to expired in the UI
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a._id === accountId ? { ...a, status: 'expired' } : a
          ),
        }));
      }
      
      console.error('Sync account error:', error);
      throw error;
    }
  },

  /**
   * Clear all accounts (on workspace switch)
   */
  clearAccounts: () => {
    set({
      accounts: [],
      isLoading: false,
      accountsLoaded: false,
    });
  },
}));
