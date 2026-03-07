import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ConnectedAccountsPage } from './ConnectedAccounts';
import { useSocialAccountStore } from '@/store/social.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { SocialAccount, SocialPlatform, AccountStatus } from '@/types/social.types';

// Mock the stores
vi.mock('@/store/social.store');
vi.mock('@/store/workspace.store');

/**
 * Bug Condition Exploration Test
 * 
 * **Property 1: Fault Condition** - OAuth Callback Detection and Account Refresh
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * **DO NOT attempt to fix the test or the code when it fails**
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * This test verifies that when OAuth callback query parameters are present in the URL
 * (success=true or error=), the component:
 * 1. Detects the query parameters
 * 2. Triggers fetchAccounts() for success case
 * 3. Displays success toast for success case
 * 4. Displays error message for error case
 * 5. Cleans up URL parameters using window.history.replaceState()
 * 
 * **EXPECTED ON UNFIXED CODE**: Test will FAIL because:
 * - Component does not use useSearchParams hook
 * - Component does not detect OAuth callback parameters
 * - fetchAccounts() is not called when success=true is detected
 * - No success toast is displayed
 * - No error message is displayed
 * - URL parameters are not cleaned up
 */
describe('ConnectedAccountsPage - OAuth Callback Bug Exploration', () => {
  const mockWorkspace = {
    _id: 'workspace-1',
    name: 'Test Workspace',
    ownerId: 'user-1',
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockFetchAccounts = vi.fn();
  const originalReplaceState = window.history.replaceState;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.history.replaceState
    window.history.replaceState = vi.fn();
    
    // Mock workspace store
    vi.mocked(useWorkspaceStore).mockReturnValue({
      currentWorkspace: mockWorkspace,
      workspaces: [mockWorkspace],
      isLoading: false,
      setCurrentWorkspace: vi.fn(),
      fetchWorkspaces: vi.fn(),
      createWorkspace: vi.fn(),
      updateWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
    } as any);
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
  });

  /**
   * Helper function to create a mock account
   */
  const createMockAccount = (overrides: Partial<SocialAccount> = {}): SocialAccount => ({
    _id: '507f1f77bcf86cd799439011',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.INSTAGRAM,
    accountName: 'test_account',
    accountId: 'instagram_123',
    scopes: ['basic'],
    status: AccountStatus.ACTIVE,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  /**
   * Test Case 1: OAuth Success Callback - Facebook
   * 
   * EXPECTED ON UNFIXED CODE: 
   * - fetchAccounts() is NOT called (bug exists)
   * - No success toast is displayed (bug exists)
   * - URL parameters remain in URL (bug exists)
   * 
   * EXPECTED AFTER FIX:
   * - fetchAccounts() is called automatically
   * - Success toast displays "Facebook account connected successfully!"
   * - URL parameters are cleaned up
   */
  it('should detect OAuth success callback for Facebook and trigger account refresh', async () => {
    const mockAccount = createMockAccount({
      platform: SocialPlatform.FACEBOOK,
      accountName: 'facebook_test',
      accountId: 'fb_123',
    });

    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [mockAccount],
      isLoading: false,
      accountsLoaded: true,
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    // Render with OAuth success callback parameters
    render(
      <MemoryRouter initialEntries={['/social/accounts?success=true&platform=facebook&account=fb_123']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    // After fix: fetchAccounts should be called
    await waitFor(() => {
      expect(mockFetchAccounts).toHaveBeenCalled();
    });

    // After fix: success toast should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Facebook account connected successfully/i)).toBeInTheDocument();
    });

    // After fix: URL should be cleaned up
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/social/accounts');
    });
  });

  /**
   * Test Case 2: OAuth Success Callback - Instagram
   * 
   * EXPECTED ON UNFIXED CODE: Same failures as Test Case 1
   * EXPECTED AFTER FIX: Same success criteria as Test Case 1
   */
  it('should detect OAuth success callback for Instagram and trigger account refresh', async () => {
    const mockAccount = createMockAccount({
      platform: SocialPlatform.INSTAGRAM,
      accountName: 'instagram_test',
      accountId: 'ig_123',
    });

    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [mockAccount],
      isLoading: false,
      accountsLoaded: true,
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/social/accounts?success=true&platform=instagram&account=ig_123']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetchAccounts).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Instagram account connected successfully/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/social/accounts');
    });
  });

  /**
   * Test Case 3: OAuth Success Callback - Twitter
   */
  it('should detect OAuth success callback for Twitter and trigger account refresh', async () => {
    const mockAccount = createMockAccount({
      platform: SocialPlatform.TWITTER,
      accountName: 'twitter_test',
      accountId: 'tw_123',
    });

    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [mockAccount],
      isLoading: false,
      accountsLoaded: true,
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/social/accounts?success=true&platform=twitter&account=tw_123']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetchAccounts).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Twitter account connected successfully/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/social/accounts');
    });
  });

  /**
   * Test Case 4: OAuth Success Callback - LinkedIn
   */
  it('should detect OAuth success callback for LinkedIn and trigger account refresh', async () => {
    const mockAccount = createMockAccount({
      platform: SocialPlatform.LINKEDIN,
      accountName: 'linkedin_test',
      accountId: 'li_123',
    });

    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [mockAccount],
      isLoading: false,
      accountsLoaded: true,
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/social/accounts?success=true&platform=linkedin&account=li_123']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetchAccounts).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/LinkedIn account connected successfully/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/social/accounts');
    });
  });

  /**
   * Test Case 5: OAuth Error Callback
   * 
   * EXPECTED ON UNFIXED CODE:
   * - No error message is displayed (bug exists)
   * - URL parameters remain in URL (bug exists)
   * 
   * EXPECTED AFTER FIX:
   * - Error message displays with the error details
   * - URL parameters are cleaned up
   */
  it('should detect OAuth error callback and display error message', async () => {
    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [],
      isLoading: false,
      accountsLoaded: true,
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/social/accounts?error=oauth_denied&message=User%20cancelled%20authorization']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    // After fix: error message should be displayed
    await waitFor(() => {
      expect(screen.getByText(/User cancelled authorization/i)).toBeInTheDocument();
    });

    // After fix: URL should be cleaned up
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/social/accounts');
    });

    // After fix: fetchAccounts should NOT be called for error case
    expect(mockFetchAccounts).not.toHaveBeenCalled();
  });

  /**
   * Test Case 6: OAuth Error Callback - Access Denied
   */
  it('should display error message for access denied error', async () => {
    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [],
      isLoading: false,
      accountsLoaded: true,
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/social/accounts?error=access_denied&message=Access%20was%20denied']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Access was denied/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/social/accounts');
    });
  });

  /**
   * Test Case 7: URL Cleanup Verification
   * 
   * Verify that URL parameters are removed after processing
   */
  it('should clean up URL parameters after processing OAuth callback', async () => {
    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [],
      isLoading: false,
      accountsLoaded: true,
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/social/accounts?success=true&platform=facebook&account=123']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    // After fix: window.history.replaceState should be called to clean URL
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/social/accounts'
      );
    });
  });

  /**
   * Test Case 8: Duplicate Refresh Prevention
   * 
   * Verify that success callback triggers refresh even if accountsLoaded is true
   * (This is different from normal page load behavior)
   */
  it('should trigger refresh on OAuth success even when accountsLoaded is true', async () => {
    vi.mocked(useSocialAccountStore).mockReturnValue({
      accounts: [],
      isLoading: false,
      accountsLoaded: true, // Already loaded
      fetchAccounts: mockFetchAccounts,
      setAccounts: vi.fn(),
      setLoading: vi.fn(),
      addAccount: vi.fn(),
      updateAccount: vi.fn(),
      removeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
      syncAccount: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/social/accounts?success=true&platform=instagram&account=123']}>
        <ConnectedAccountsPage />
      </MemoryRouter>
    );

    // After fix: fetchAccounts should be called despite accountsLoaded being true
    await waitFor(() => {
      expect(mockFetchAccounts).toHaveBeenCalled();
    });
  });
});

/**
 * Preservation Property Tests
 * 
 * **Property 2: Preservation** - Non-OAuth Page Load Behavior
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 * 
 * These tests verify that the fix does NOT change existing behavior for:
 * - Normal page loads without OAuth callback parameters
 * - Initial account fetch when accountsLoaded is false
 * - Workspace selection requirement
 * - Loading state display
 * - Empty state display
 * - Connect dialog flow
 * - Account rendering with generateAccountKey
 * 
 * IMPORTANT: These tests should PASS on UNFIXED code to establish baseline behavior.
 * After the fix, these tests should STILL PASS to confirm no regressions.
 */
describe('ConnectedAccountsPage - Preservation Property Tests', () => {
  const mockWorkspace = {
    _id: 'workspace-1',
    name: 'Test Workspace',
    ownerId: 'user-1',
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockFetchAccounts = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock workspace store
    vi.mocked(useWorkspaceStore).mockReturnValue({
      currentWorkspace: mockWorkspace,
      workspaces: [mockWorkspace],
      isLoading: false,
      setCurrentWorkspace: vi.fn(),
      fetchWorkspaces: vi.fn(),
      createWorkspace: vi.fn(),
      updateWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
    } as any);
  });

  const createMockAccount = (overrides: Partial<SocialAccount> = {}): SocialAccount => ({
    _id: '507f1f77bcf86cd799439011',
    workspaceId: 'workspace-1',
    platform: SocialPlatform.INSTAGRAM,
    accountName: 'test_account',
    accountId: 'instagram_123',
    scopes: ['basic'],
    status: AccountStatus.ACTIVE,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  /**
   * Property Test 1: Initial Fetch Behavior
   * 
   * Requirement 3.1: When the page loads without OAuth callback parameters,
   * the component SHALL fetch accounts only once when accountsLoaded is false
   */
  describe('Property: Initial Fetch Behavior (Req 3.1)', () => {
    it('should fetch accounts once on mount when accountsLoaded is false', async () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: false, // Not loaded yet
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      // Render WITHOUT OAuth callback parameters
      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify fetchAccounts is called once
      await waitFor(() => {
        expect(mockFetchAccounts).toHaveBeenCalledTimes(1);
      });
    });

    it('should NOT fetch accounts when accountsLoaded is true', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: true, // Already loaded
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify fetchAccounts is NOT called
      expect(mockFetchAccounts).not.toHaveBeenCalled();
    });
  });

  /**
   * Property Test 2: Workspace Selection Requirement
   * 
   * Requirement 3.2: When no workspace is selected,
   * the component SHALL display "Please select a workspace first" message
   */
  describe('Property: Workspace Selection Requirement (Req 3.2)', () => {
    it('should display workspace selection message when no workspace is selected', () => {
      // Mock no workspace selected
      vi.mocked(useWorkspaceStore).mockReturnValue({
        currentWorkspace: null,
        workspaces: [],
        isLoading: false,
        setCurrentWorkspace: vi.fn(),
        fetchWorkspaces: vi.fn(),
        createWorkspace: vi.fn(),
        updateWorkspace: vi.fn(),
        deleteWorkspace: vi.fn(),
      } as any);

      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: false,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify workspace selection message is displayed
      expect(screen.getByText('Please select a workspace first')).toBeInTheDocument();

      // Verify fetchAccounts is NOT called
      expect(mockFetchAccounts).not.toHaveBeenCalled();
    });
  });

  /**
   * Property Test 3: Loading State Display
   * 
   * Requirement 3.3: When accounts are loading for the first time,
   * the component SHALL display "Loading accounts..." message
   */
  describe('Property: Loading State Display (Req 3.3)', () => {
    it('should display loading message when isLoading is true and accountsLoaded is false', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: true,
        accountsLoaded: false,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify loading message is displayed
      expect(screen.getByText('Loading accounts...')).toBeInTheDocument();
    });

    it('should NOT display loading message when accountsLoaded is true', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: true,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify loading message is NOT displayed
      expect(screen.queryByText('Loading accounts...')).not.toBeInTheDocument();
    });
  });

  /**
   * Property Test 4: Empty State Display
   * 
   * Requirement 3.4: When no accounts exist,
   * the component SHALL display the empty state with "Connect Your First Account" button
   */
  describe('Property: Empty State Display (Req 3.4)', () => {
    it('should display empty state when no accounts exist', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: true,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify empty state message is displayed
      expect(screen.getByText('No accounts connected yet')).toBeInTheDocument();
      expect(screen.getByText('Connect Your First Account')).toBeInTheDocument();
    });
  });

  /**
   * Property Test 5: Connect Dialog Flow
   * 
   * Requirement 3.5: When the Connect Account dialog is used,
   * the component SHALL refresh accounts after successful connection via the dialog's onSuccess callback
   * 
   * Requirement 3.7: When the user clicks "Connect Account" button,
   * the component SHALL open the connect dialog modal
   */
  describe('Property: Connect Dialog Flow (Req 3.5, 3.7)', () => {
    it('should display Connect Account button', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: true,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify Connect Account button is present
      const connectButtons = screen.getAllByText('Connect Account');
      expect(connectButtons.length).toBeGreaterThan(0);
    });
  });

  /**
   * Property Test 6: Account Rendering
   * 
   * Requirement 3.6: When accounts are rendered,
   * the component SHALL use the generateAccountKey function with duplicate detection for React keys
   */
  describe('Property: Account Rendering (Req 3.6)', () => {
    it('should render accounts with proper keys', () => {
      const accounts = [
        createMockAccount({
          _id: '507f1f77bcf86cd799439011',
          accountName: 'account_1',
          platform: SocialPlatform.INSTAGRAM,
        }),
        createMockAccount({
          _id: '507f1f77bcf86cd799439012',
          accountName: 'account_2',
          platform: SocialPlatform.FACEBOOK,
        }),
        createMockAccount({
          _id: '507f1f77bcf86cd799439013',
          accountName: 'account_3',
          platform: SocialPlatform.TWITTER,
        }),
      ];

      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts,
        isLoading: false,
        accountsLoaded: true,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify all accounts are rendered
      expect(screen.getByText('account_1')).toBeInTheDocument();
      expect(screen.getByText('account_2')).toBeInTheDocument();
      expect(screen.getByText('account_3')).toBeInTheDocument();
    });

    it('should render page title and description', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: true,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify page title
      expect(screen.getByText('Connected Accounts')).toBeInTheDocument();

      // Verify page description
      expect(screen.getByText(/Manage your social media accounts for/)).toBeInTheDocument();
    });
  });

  /**
   * Property Test 7: No OAuth Parameters Behavior
   * 
   * Verify that normal page loads (without OAuth parameters) do NOT trigger
   * any OAuth-related behavior
   */
  describe('Property: No OAuth Parameters Behavior', () => {
    it('should not display success toast on normal page load', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: true,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify no success toast is displayed
      expect(screen.queryByText(/connected successfully/i)).not.toBeInTheDocument();
    });

    it('should not display error message on normal page load', () => {
      vi.mocked(useSocialAccountStore).mockReturnValue({
        accounts: [],
        isLoading: false,
        accountsLoaded: true,
        fetchAccounts: mockFetchAccounts,
        setAccounts: vi.fn(),
        setLoading: vi.fn(),
        addAccount: vi.fn(),
        updateAccount: vi.fn(),
        removeAccount: vi.fn(),
        disconnectAccount: vi.fn(),
        syncAccount: vi.fn(),
      } as any);

      render(
        <MemoryRouter initialEntries={['/social/accounts']}>
          <ConnectedAccountsPage />
        </MemoryRouter>
      );

      // Verify no error message is displayed
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/denied/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument();
    });
  });
});
