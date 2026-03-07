/**
 * Unit Tests for InstagramConnectionStore
 * 
 * Requirements: All requirements (state management)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useInstagramConnectionStore } from '../instagram-connection.store';
import type { ConnectionError } from '../../types';

// Mock the service
vi.mock('../../services/instagram-connection.service', () => ({
  instagramConnectionService: {
    initiateOAuth: vi.fn().mockResolvedValue({
      success: true,
      authorizationUrl: 'https://facebook.com/oauth',
      state: 'test-state',
      platform: 'instagram',
    }),
    checkConnectionStatus: vi.fn().mockResolvedValue({
      success: true,
      accounts: [
        {
          id: 'test-account-1',
          username: 'test_user',
          displayName: 'Test User',
          profileImageUrl: 'https://example.com/profile.jpg',
          followerCount: 1000,
          facebookPageName: 'Test Page',
          facebookPageId: 'page-123',
        },
      ],
    }),
    saveAccounts: vi.fn().mockResolvedValue({
      success: true,
      saved: [],
      failed: [],
    }),
  },
}));

// Mock window.location
delete (window as any).location;
(window as any).location = { href: '' };

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('InstagramConnectionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const store = useInstagramConnectionStore.getState();
    store.resetChecklist();
    store.clearError();
    store.selectAccounts([]);
    store.setConnectionState({
      step: 'idle',
      progress: 0,
      message: '',
    });
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Reset window.location
    (window as any).location.href = '';
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useInstagramConnectionStore.getState();

      expect(state.checklistCompleted).toBe(false);
      expect(state.checklistItems).toHaveLength(3);
      expect(state.connectionState.step).toBe('idle');
      expect(state.oauthState).toBeNull();
      expect(state.discoveredAccounts).toEqual([]);
      expect(state.selectedAccountIds).toEqual([]);
      expect(state.lastError).toBeNull();
      expect(state.diagnosticData).toBeNull();
    });

    it('should have all checklist items unchecked initially', () => {
      const state = useInstagramConnectionStore.getState();

      state.checklistItems.forEach(item => {
        expect(item.checked).toBe(false);
      });
    });

    it('should have all checklist items marked as required', () => {
      const state = useInstagramConnectionStore.getState();

      state.checklistItems.forEach(item => {
        expect(item.required).toBe(true);
      });
    });
  });

  describe('Checklist Actions', () => {
    it('should update checklist item when setChecklistItem is called', () => {
      const store = useInstagramConnectionStore.getState();

      store.setChecklistItem('business_account', true);

      const state = useInstagramConnectionStore.getState();
      const item = state.checklistItems.find(i => i.id === 'business_account');

      expect(item?.checked).toBe(true);
    });

    it('should toggle checklist item', () => {
      const store = useInstagramConnectionStore.getState();

      store.setChecklistItem('business_account', true);
      let state = useInstagramConnectionStore.getState();
      expect(state.checklistItems[0].checked).toBe(true);

      store.setChecklistItem('business_account', false);
      state = useInstagramConnectionStore.getState();
      expect(state.checklistItems[0].checked).toBe(false);
    });

    it('should not affect other items when updating one item', () => {
      const store = useInstagramConnectionStore.getState();

      store.setChecklistItem('business_account', true);

      const state = useInstagramConnectionStore.getState();
      expect(state.checklistItems[0].checked).toBe(true);
      expect(state.checklistItems[1].checked).toBe(false);
      expect(state.checklistItems[2].checked).toBe(false);
    });

    it('should set checklistCompleted to true when all required items are checked', () => {
      const store = useInstagramConnectionStore.getState();

      store.setChecklistItem('business_account', true);
      store.setChecklistItem('facebook_page', true);
      store.setChecklistItem('admin_access', true);

      const state = useInstagramConnectionStore.getState();
      expect(state.checklistCompleted).toBe(true);
    });

    it('should set checklistCompleted to false when not all required items are checked', () => {
      const store = useInstagramConnectionStore.getState();

      store.setChecklistItem('business_account', true);
      store.setChecklistItem('facebook_page', true);

      const state = useInstagramConnectionStore.getState();
      expect(state.checklistCompleted).toBe(false);
    });

    it('should update checklistCompleted when unchecking an item', () => {
      const store = useInstagramConnectionStore.getState();

      // Check all items
      store.setChecklistItem('business_account', true);
      store.setChecklistItem('facebook_page', true);
      store.setChecklistItem('admin_access', true);

      let state = useInstagramConnectionStore.getState();
      expect(state.checklistCompleted).toBe(true);

      // Uncheck one item
      store.setChecklistItem('admin_access', false);

      state = useInstagramConnectionStore.getState();
      expect(state.checklistCompleted).toBe(false);
    });

    it('should reset checklist to initial state', () => {
      const store = useInstagramConnectionStore.getState();

      // Check some items
      store.setChecklistItem('business_account', true);
      store.setChecklistItem('facebook_page', true);

      // Reset
      store.resetChecklist();

      const state = useInstagramConnectionStore.getState();
      expect(state.checklistCompleted).toBe(false);
      state.checklistItems.forEach(item => {
        expect(item.checked).toBe(false);
      });
    });

    it('should manually complete checklist', () => {
      const store = useInstagramConnectionStore.getState();

      store.completeChecklist();

      const state = useInstagramConnectionStore.getState();
      expect(state.checklistCompleted).toBe(true);
    });
  });

  describe('Connection State Actions', () => {
    it('should update connection state', () => {
      const store = useInstagramConnectionStore.getState();

      store.setConnectionState({
        step: 'authorizing',
        progress: 20,
        message: 'Authorizing...',
      });

      const state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('authorizing');
      expect(state.connectionState.progress).toBe(20);
      expect(state.connectionState.message).toBe('Authorizing...');
    });

    it('should partially update connection state', () => {
      const store = useInstagramConnectionStore.getState();

      store.setConnectionState({
        step: 'authorizing',
        progress: 20,
        message: 'Authorizing...',
      });

      store.setConnectionState({
        progress: 40,
      });

      const state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('authorizing');
      expect(state.connectionState.progress).toBe(40);
      expect(state.connectionState.message).toBe('Authorizing...');
    });

    it('should start connection flow', async () => {
      const store = useInstagramConnectionStore.getState();

      // Start connection (will redirect, so we can't check final state)
      const promise = store.startConnection();

      // Check intermediate state
      const state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('authorizing');
      expect(state.connectionState.progress).toBe(20);
      
      // Wait for promise to resolve (will try to redirect)
      await promise;
      
      // Check that OAuth state was stored
      expect(sessionStorage.getItem('instagram-oauth-state')).toBe('test-state');
      expect(sessionStorage.getItem('instagram-oauth-timestamp')).toBeTruthy();
    });

    it('should handle OAuth callback', async () => {
      const store = useInstagramConnectionStore.getState();

      // Set up sessionStorage as if OAuth was initiated
      sessionStorage.setItem('instagram-oauth-state', 'test-state');
      sessionStorage.setItem('instagram-oauth-timestamp', Date.now().toString());

      await store.handleOAuthCallback('test-code', 'test-state');

      const state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('complete');
      expect(state.discoveredAccounts).toHaveLength(1);
      expect(state.discoveredAccounts[0].username).toBe('test_user');
    });
  });

  describe('Account Selection Actions', () => {
    it('should select accounts', () => {
      const store = useInstagramConnectionStore.getState();

      store.selectAccounts(['account1', 'account2']);

      const state = useInstagramConnectionStore.getState();
      expect(state.selectedAccountIds).toEqual(['account1', 'account2']);
    });

    it('should replace selected accounts', () => {
      const store = useInstagramConnectionStore.getState();

      store.selectAccounts(['account1', 'account2']);
      store.selectAccounts(['account3']);

      const state = useInstagramConnectionStore.getState();
      expect(state.selectedAccountIds).toEqual(['account3']);
    });

    it('should clear selected accounts', () => {
      const store = useInstagramConnectionStore.getState();

      store.selectAccounts(['account1', 'account2']);
      store.selectAccounts([]);

      const state = useInstagramConnectionStore.getState();
      expect(state.selectedAccountIds).toEqual([]);
    });

    it('should save selected accounts', async () => {
      const store = useInstagramConnectionStore.getState();

      await store.saveSelectedAccounts();

      const state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('saving');
      expect(state.connectionState.progress).toBe(80);
    });
  });

  describe('Error Handling Actions', () => {
    it('should set error', () => {
      const store = useInstagramConnectionStore.getState();

      const error: ConnectionError = {
        type: 'no_accounts',
        message: 'No accounts found',
        userMessage: 'No Instagram Business accounts found',
        recoverable: true,
        suggestedAction: 'Check your setup',
        retryable: true,
        timestamp: new Date(),
      };

      store.setError(error);

      const state = useInstagramConnectionStore.getState();
      expect(state.lastError).toEqual(error);
      expect(state.connectionState.step).toBe('error');
      expect(state.connectionState.error).toEqual(error);
    });

    it('should clear error', () => {
      const store = useInstagramConnectionStore.getState();

      const error: ConnectionError = {
        type: 'no_accounts',
        message: 'No accounts found',
        userMessage: 'No Instagram Business accounts found',
        recoverable: true,
        suggestedAction: 'Check your setup',
        retryable: true,
        timestamp: new Date(),
      };

      store.setError(error);
      store.clearError();

      const state = useInstagramConnectionStore.getState();
      expect(state.lastError).toBeNull();
      expect(state.diagnosticData).toBeNull();
    });

    it('should retry connection after error', async () => {
      const store = useInstagramConnectionStore.getState();

      const error: ConnectionError = {
        type: 'network_error',
        message: 'Network error',
        userMessage: 'Network connection failed',
        recoverable: true,
        suggestedAction: 'Check your connection',
        retryable: true,
        timestamp: new Date(),
      };

      store.setError(error);

      let state = useInstagramConnectionStore.getState();
      expect(state.lastError).toEqual(error);

      // Retry connection (will redirect, so we can't check final state)
      const promise = store.retryConnection();

      state = useInstagramConnectionStore.getState();
      expect(state.lastError).toBeNull();
      expect(state.connectionState.step).toBe('authorizing');
      
      // Wait for promise to resolve
      await promise;
    });
  });

  describe('State Transitions', () => {
    it('should transition through connection states', async () => {
      const store = useInstagramConnectionStore.getState();

      // Idle
      let state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('idle');

      // Start connection (will redirect)
      const startPromise = store.startConnection();
      state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('authorizing');
      await startPromise;

      // Set up sessionStorage for callback
      sessionStorage.setItem('instagram-oauth-state', 'test-state');
      sessionStorage.setItem('instagram-oauth-timestamp', Date.now().toString());

      // Handle callback
      await store.handleOAuthCallback('code', 'test-state');
      state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('complete');
      expect(state.discoveredAccounts).toHaveLength(1);

      // Save accounts
      await store.saveSelectedAccounts();
      state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('saving');
    });

    it('should handle error state transition', () => {
      const store = useInstagramConnectionStore.getState();

      const error: ConnectionError = {
        type: 'token_exchange_failed',
        message: 'Token exchange failed',
        userMessage: 'Failed to exchange authorization code',
        recoverable: true,
        suggestedAction: 'Try again',
        retryable: true,
        timestamp: new Date(),
      };

      store.setError(error);

      const state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('error');
      expect(state.lastError).toEqual(error);
    });
  });
});
