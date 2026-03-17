import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, setWorkspaceIdForInterceptor } from '@/lib/api-client';
import {
  Workspace,
  WorkspaceMember,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  TransferOwnershipInput,
  WorkspacesResponse,
  WorkspaceResponse,
  MembersResponse,
} from '@/types/workspace.types';

// Global request tracking for deduplication and AbortController management
const activeRequests = new Map<string, RequestTracker>();

interface RequestTracker {
  promise: Promise<any>;
  abortController: AbortController;
  timestamp: number;
}

interface WorkspaceState {
  // State
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | null;
  recentWorkspaceIds: string[]; // Track recent workspace usage
  isLoading: boolean;
  workspacesLoaded: boolean;
  members: WorkspaceMember[];
  membersLoaded: boolean;
  pendingInvites: any[];
  pendingInvitesLoaded: boolean;
  
  // FE-3: Background refresh state
  lastFetchedAt: number | null; // Timestamp of last successful fetch
  isStale: boolean; // Whether data is considered stale (>5 minutes old)
  backgroundRefreshInterval: NodeJS.Timeout | null; // Background refresh timer
  
  // GAP 11: Rate limit state
  rateLimitedUntil: number | null; // Timestamp when rate limit expires
  retryAfterSeconds: number | null; // Seconds remaining for rate limit
}

interface WorkspaceActions {
  // Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setCurrentWorkspaceId: (workspaceId: string | null) => void;
  setRecentWorkspaceIds: (workspaceIds: string[]) => void;
  addToRecentWorkspaces: (workspaceId: string) => void;
  setLoading: (loading: boolean) => void;
  setWorkspacesLoaded: (loaded: boolean) => void;
  setMembers: (members: WorkspaceMember[]) => void;
  setMembersLoaded: (loaded: boolean) => void;
  setPendingInvites: (invites: any[]) => void;
  setPendingInvitesLoaded: (loaded: boolean) => void;

  // FE-3: Background refresh actions
  setLastFetchedAt: (timestamp: number | null) => void;
  setIsStale: (isStale: boolean) => void;
  startBackgroundRefresh: () => void;
  stopBackgroundRefresh: () => void;
  refreshIfStale: () => Promise<void>;
  
  // GAP 11: Rate limit actions
  setRateLimitedUntil: (timestamp: number | null) => void;
  setRetryAfterSeconds: (seconds: number | null) => void;
  handleRateLimitError: (error: any) => void;

  // Async actions
  fetchWorkspaces: (signal?: AbortSignal) => Promise<void>;
  fetchWorkspaceById: (workspaceId: string) => Promise<Workspace>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  updateWorkspace: (workspaceId: string, input: UpdateWorkspaceInput) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  
  // Member actions
  fetchMembers: (workspaceId: string) => Promise<void>;
  fetchPendingInvites: (workspaceId: string, params?: { status?: string; search?: string; role?: string }) => Promise<void>;
  inviteMember: (workspaceId: string, input: InviteMemberInput) => Promise<WorkspaceMember>;
  sendEmailInvitation: (workspaceId: string, input: InviteMemberInput) => Promise<any>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
  deactivateMember: (workspaceId: string, userId: string) => Promise<void>;
  reactivateMember: (workspaceId: string, userId: string) => Promise<void>;
  updateMemberRole: (workspaceId: string, userId: string, input: UpdateMemberRoleInput) => Promise<WorkspaceMember>;
  transferOwnership: (workspaceId: string, input: TransferOwnershipInput) => Promise<void>;
  leaveWorkspace: (workspaceId: string) => Promise<void>;

  // Invitation actions
  resendInvitation: (workspaceId: string, token: string) => Promise<void>;
  cancelInvitation: (workspaceId: string, token: string) => Promise<void>;
  bulkCancelInvitations: (workspaceId: string, tokens: string[]) => Promise<void>;

  // Utility actions
  clearWorkspaceData: () => void;
  restoreWorkspace: (signal?: AbortSignal) => Promise<void>;
}

interface WorkspaceStore extends WorkspaceState, WorkspaceActions {}

/**
 * Global workspace store
 * 
 * Security:
 * - Only persists workspaceId (not full workspace object)
 * - Validates membership on restore
 * - Clears data on workspace switch
 * - Syncs with backend tenant middleware
 */
export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      // Initial state
      workspaces: [],
      currentWorkspace: null,
      currentWorkspaceId: null,
      recentWorkspaceIds: [],
      isLoading: false,
      workspacesLoaded: false,
      members: [],
      membersLoaded: false,
      pendingInvites: [],
      pendingInvitesLoaded: false,
      
      // FE-3: Background refresh initial state
      lastFetchedAt: null,
      isStale: false,
      backgroundRefreshInterval: null,
      
      // GAP 11: Rate limit initial state
      rateLimitedUntil: null,
      retryAfterSeconds: null,

      // Setters
      setWorkspaces: (workspaces) => set({ workspaces }),
      
      setCurrentWorkspace: (workspace) => {
        set({
          currentWorkspace: workspace,
          currentWorkspaceId: workspace?._id || null,
        });
      },

      setCurrentWorkspaceId: (workspaceId) => set({ currentWorkspaceId: workspaceId }),

      setRecentWorkspaceIds: (workspaceIds) => set({ recentWorkspaceIds: workspaceIds }),

      addToRecentWorkspaces: (workspaceId) => {
        set((state) => {
          const filtered = state.recentWorkspaceIds.filter(id => id !== workspaceId);
          return {
            recentWorkspaceIds: [workspaceId, ...filtered].slice(0, 5) // Keep last 5
          };
        });
      },
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setWorkspacesLoaded: (loaded) => set({ workspacesLoaded: loaded }),

      setMembers: (members) => set({ members }),

      setMembersLoaded: (loaded) => set({ membersLoaded: loaded }),

      setPendingInvites: (invites) => set({ pendingInvites: invites }),

      setPendingInvitesLoaded: (loaded) => set({ pendingInvitesLoaded: loaded }),

      // FE-3: Background refresh setters
      setLastFetchedAt: (timestamp) => set({ lastFetchedAt: timestamp }),
      
      setIsStale: (isStale) => set({ isStale }),

      /**
       * Start background refresh interval (5 minutes)
       * Only refreshes if data is stale and no loading in progress
       */
      startBackgroundRefresh: () => {
        // Clear existing interval
        const { backgroundRefreshInterval } = get();
        if (backgroundRefreshInterval) {
          clearInterval(backgroundRefreshInterval);
        }

        // Set up new interval (5 minutes)
        const interval = setInterval(async () => {
          const { lastFetchedAt, isLoading, workspacesLoaded } = get();
          
          // Only refresh if data is stale and not currently loading
          if (!isLoading && workspacesLoaded && lastFetchedAt) {
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;
            
            if (now - lastFetchedAt > fiveMinutes) {
              try {
                // Silent background refresh - don't show loading state
                await get().fetchWorkspaces();
              } catch (error) {
                // Silent failure - keep existing data, no logging in production
              }
            }
          }
        }, 5 * 60 * 1000); // 5 minutes

        set({ backgroundRefreshInterval: interval });
      },

      /**
       * Stop background refresh interval
       */
      stopBackgroundRefresh: () => {
        const { backgroundRefreshInterval } = get();
        if (backgroundRefreshInterval) {
          clearInterval(backgroundRefreshInterval);
          set({ backgroundRefreshInterval: null });
        }
      },

      /**
       * Refresh workspaces if data is stale (>2 minutes on tab focus)
       */
      refreshIfStale: async () => {
        const { lastFetchedAt, isLoading, workspacesLoaded } = get();
        
        if (!isLoading && workspacesLoaded && lastFetchedAt) {
          const now = Date.now();
          const twoMinutes = 2 * 60 * 1000;
          
          if (now - lastFetchedAt > twoMinutes) {
            try {
              await get().fetchWorkspaces();
            } catch (error) {
              // Silent failure on tab focus refresh
            }
          }
        }
      },

      // GAP 11: Rate limit setters and handlers
      setRateLimitedUntil: (timestamp) => set({ rateLimitedUntil: timestamp }),
      
      setRetryAfterSeconds: (seconds) => set({ retryAfterSeconds: seconds }),

      /**
       * Handle 429 rate limit errors with countdown
       */
      handleRateLimitError: (error: any) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 
                           error.response.data?.retryAfter || 
                           60; // Default to 60 seconds
          
          const retryAfterMs = parseInt(retryAfter) * 1000;
          const rateLimitedUntil = Date.now() + retryAfterMs;
          
          set({ 
            rateLimitedUntil,
            retryAfterSeconds: parseInt(retryAfter)
          });

          // Start countdown
          const countdownInterval = setInterval(() => {
            const { rateLimitedUntil: currentLimit } = get();
            if (!currentLimit) {
              clearInterval(countdownInterval);
              return;
            }

            const remaining = Math.max(0, Math.ceil((currentLimit - Date.now()) / 1000));
            
            if (remaining <= 0) {
              set({ rateLimitedUntil: null, retryAfterSeconds: null });
              clearInterval(countdownInterval);
            } else {
              set({ retryAfterSeconds: remaining });
            }
          }, 1000);
        }
      },

      /**
       * Fetch all workspaces for current user
       * Implements request deduplication and AbortController management (FE-4)
       */
      fetchWorkspaces: async (signal?: AbortSignal) => {
        const requestKey = 'fetchWorkspaces';
        
        // Check if there's already a request in progress (FE-4: Request coalescing)
        const existingRequest = activeRequests.get(requestKey);
        if (existingRequest) {
          // Return the existing promise for concurrent requests
          return existingRequest.promise;
        }

        // Create new AbortController if none provided
        const abortController = signal ? new AbortController() : new AbortController();
        if (signal) {
          // Chain the provided signal to our controller
          signal.addEventListener('abort', () => abortController.abort());
        }

        const requestTracker: RequestTracker = {
          promise: (async () => {
            try {
              set({ isLoading: true });

              const response = await apiClient.get<WorkspacesResponse>('/workspaces', {
                signal: abortController.signal,
              });

              const now = Date.now();
              const fiveMinutes = 5 * 60 * 1000;

              set({
                workspaces: response.workspaces,
                workspacesLoaded: true,
                isLoading: false,
                lastFetchedAt: now, // FE-3: Track fetch timestamp
                isStale: false, // FE-3: Mark as fresh
              });

              // Update stale indicator based on age
              setTimeout(() => {
                const { lastFetchedAt: currentTimestamp } = get();
                if (currentTimestamp === now) { // Only update if this is still the latest fetch
                  set({ isStale: true });
                }
              }, fiveMinutes);

              // If no current workspace, set first one
              const { currentWorkspace } = get();
              if (!currentWorkspace && response.workspaces.length > 0) {
                const firstWorkspace = response.workspaces[0];
                // Use setter to trigger interceptor updates
                get().setCurrentWorkspace(firstWorkspace);
              }
            } catch (error: any) {
              // Don't log cancelled requests as errors
              if (error.name !== 'AbortError' && error.name !== 'CanceledError' && !abortController.signal.aborted && error.message !== 'canceled') {
                console.error('Fetch workspaces error:', error);
                // Handle rate limiting
                get().handleRateLimitError(error);
              }
              set({ isLoading: false, workspacesLoaded: true });
              throw error;
            } finally {
              // Clear the request from tracking
              activeRequests.delete(requestKey);
            }
          })(),
          abortController,
          timestamp: Date.now(),
        };

        // Track the request
        activeRequests.set(requestKey, requestTracker);
        
        return requestTracker.promise;
      },

      /**
       * Fetch workspace by ID
       */
      fetchWorkspaceById: async (workspaceId: string) => {
        try {
          const response = await apiClient.get<WorkspaceResponse>(
            `/workspaces/${workspaceId}`
          );
          return response.workspace;
        } catch (error: any) {
          console.error('Fetch workspace error:', error);
          throw error;
        }
      },

      /**
       * Create new workspace
       */
      createWorkspace: async (input: CreateWorkspaceInput) => {
        try {
          set({ isLoading: true });

          const response = await apiClient.post<{ workspace: Workspace }>(
            '/workspaces',
            input
          );

          const newWorkspace = response.workspace;

          // Add to workspaces list
          set((state) => ({
            workspaces: [newWorkspace, ...state.workspaces],
            isLoading: false,
          }));

          // Auto-switch to new workspace
          await get().switchWorkspace(newWorkspace._id);

          return newWorkspace;
        } catch (error: any) {
          set({ isLoading: false });
          console.error('Create workspace error:', error);
          throw error;
        }
      },

      /**
       * Update workspace
       */
      updateWorkspace: async (workspaceId: string, input: UpdateWorkspaceInput) => {
        try {
          set({ isLoading: true });

          const response = await apiClient.patch<{ workspace: Workspace }>(
            `/workspaces/${workspaceId}`,
            input
          );

          const updatedWorkspace = response.workspace;

          // Update in workspaces list
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w._id === workspaceId ? updatedWorkspace : w
            ),
            currentWorkspace:
              state.currentWorkspace?._id === workspaceId
                ? updatedWorkspace
                : state.currentWorkspace,
            isLoading: false,
          }));

          return updatedWorkspace;
        } catch (error: any) {
          set({ isLoading: false });
          console.error('Update workspace error:', error);
          throw error;
        }
      },

      /**
       * Delete workspace (soft delete)
       */
      deleteWorkspace: async (workspaceId: string) => {
        try {
          set({ isLoading: true });

          await apiClient.delete(`/workspaces/${workspaceId}`);

          // Remove from workspaces list
          set((state) => {
            const newWorkspaces = state.workspaces.filter((w) => w._id !== workspaceId);
            
            // If deleted workspace was current, switch to first available
            let newCurrentWorkspace = state.currentWorkspace;
            let newCurrentWorkspaceId = state.currentWorkspaceId;

            if (state.currentWorkspaceId === workspaceId) {
              newCurrentWorkspace = newWorkspaces[0] || null;
              newCurrentWorkspaceId = newCurrentWorkspace?._id || null;
            }

            return {
              workspaces: newWorkspaces,
              currentWorkspace: newCurrentWorkspace,
              currentWorkspaceId: newCurrentWorkspaceId,
              isLoading: false,
            };
          });
        } catch (error: any) {
          set({ isLoading: false });
          console.error('Delete workspace error:', error);
          throw error;
        }
      },

      /**
       * Switch to different workspace
       * Clears tenant-specific data and reloads
       * FE-4: Implements AbortController for cancelling previous requests
       */
      switchWorkspace: async (workspaceId: string) => {
        try {
          set({ isLoading: true });

          // FE-4: Cancel all in-flight requests from previous workspace
          for (const [key, tracker] of activeRequests.entries()) {
            if (key.includes('workspace') || key.includes('members') || key.includes('invites')) {
              tracker.abortController.abort();
              activeRequests.delete(key);
            }
          }

          // Find workspace in list
          const workspace = get().workspaces.find((w) => w._id === workspaceId);

          if (!workspace) {
            throw new Error('Workspace not found');
          }

          // Add to recent workspaces
          get().addToRecentWorkspaces(workspaceId);

          // Set as current workspace
          set({
            currentWorkspace: workspace,
            currentWorkspaceId: workspace._id,
            members: [], // Clear members from previous workspace
            membersLoaded: false,
            pendingInvites: [], // Clear pending invites from previous workspace
            pendingInvitesLoaded: false,
            isLoading: false,
          });

          // Clear tenant-specific data from other stores
          import('@/store/social.store').then(({ useSocialAccountStore }) => {
            useSocialAccountStore.getState().clearAccounts();
          });
          import('@/store/post.store').then(({ usePostStore }) => {
            usePostStore.getState().clearPosts();
          });
          import('@/store/analytics.store').then(({ useAnalyticsStore }) => {
            useAnalyticsStore.getState().clearAnalytics();
          });
        } catch (error: any) {
          set({ isLoading: false });
          console.error('Switch workspace error:', error);
          throw error;
        }
      },

      /**
       * Fetch workspace members
       */
      fetchMembers: async (workspaceId: string) => {
        try {
          const response = await apiClient.get<MembersResponse>(
            `/workspaces/${workspaceId}/members`
          );

          set({
            members: response.members,
            membersLoaded: true,
          });
        } catch (error: any) {
          console.error('Fetch members error:', error);
          set({ membersLoaded: true });
          throw error;
        }
      },

      /**
       * Fetch pending invites
       */
      fetchPendingInvites: async (workspaceId: string, params?: { status?: string; search?: string; role?: string }) => {
        try {
          const queryParams = new URLSearchParams();
          if (params?.status) queryParams.append('status', params.status);
          if (params?.search) queryParams.append('search', params.search);
          if (params?.role) queryParams.append('role', params.role);

          const url = `/workspaces/${workspaceId}/invitations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
          const response = await apiClient.get<{ invitations: any[] }>(url);

          set({
            pendingInvites: response.invitations,
            pendingInvitesLoaded: true,
          });
        } catch (error: any) {
          console.error('Fetch pending invites error:', error);
          set({ pendingInvitesLoaded: true });
          throw error;
        }
      },

      /**
       * Invite member to workspace
       */
      inviteMember: async (workspaceId: string, input: InviteMemberInput) => {
        try {
          const response = await apiClient.post<{ membership: WorkspaceMember }>(
            `/workspaces/${workspaceId}/members`,
            input
          );

          // Add to members list
          set((state) => ({
            members: [response.membership, ...state.members],
          }));

          // Increment member count in workspace
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w._id === workspaceId ? { ...w, membersCount: w.membersCount + 1 } : w
            ),
            currentWorkspace:
              state.currentWorkspace?._id === workspaceId
                ? { ...state.currentWorkspace, membersCount: state.currentWorkspace.membersCount + 1 }
                : state.currentWorkspace,
          }));

          return response.membership;
        } catch (error: any) {
          console.error('Invite member error:', error);
          throw error;
        }
      },

      /**
       * Send email invitation to a new user
       */
      sendEmailInvitation: async (workspaceId: string, input: InviteMemberInput) => {
        try {
          const response = await apiClient.post(
            `/workspaces/${workspaceId}/invitations`,
            input
          );

          // Add to pending invites list if loaded
          if (get().pendingInvitesLoaded) {
            set((state) => ({
              pendingInvites: [response.invitation, ...state.pendingInvites],
            }));
          }

          return response.invitation;
        } catch (error: any) {
          console.error('Send email invitation error:', error);
          throw error;
        }
      },

      /**
       * Remove member from workspace
       */
      removeMember: async (workspaceId: string, userId: string) => {
        try {
          await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`);

          // Remove from members list
          set((state) => ({
            members: state.members.filter((m) => {
              const memberUserId = typeof m.userId === 'string' ? m.userId : m.userId._id;
              return memberUserId !== userId;
            }),
          }));

          // Decrement member count in workspace
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w._id === workspaceId ? { ...w, membersCount: Math.max(0, w.membersCount - 1) } : w
            ),
            currentWorkspace:
              state.currentWorkspace?._id === workspaceId
                ? { ...state.currentWorkspace, membersCount: Math.max(0, state.currentWorkspace.membersCount - 1) }
                : state.currentWorkspace,
          }));
        } catch (error: any) {
          console.error('Remove member error:', error);
          throw error;
        }
      },

      /**
       * Deactivate member
       */
      deactivateMember: async (workspaceId: string, userId: string) => {
        try {
          await apiClient.patch(`/workspaces/${workspaceId}/members/${userId}/deactivate`);

          // Update member status in list
          set((state) => ({
            members: state.members.map((m) => {
              const memberUserId = typeof m.userId === 'string' ? m.userId : m.userId._id;
              return memberUserId === userId 
                ? { ...m, isActive: false, status: 'deactivated' as any, deactivatedAt: new Date().toISOString() }
                : m;
            }),
          }));

          // Decrement member count in workspace
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w._id === workspaceId ? { ...w, membersCount: Math.max(0, w.membersCount - 1) } : w
            ),
            currentWorkspace:
              state.currentWorkspace?._id === workspaceId
                ? { ...state.currentWorkspace, membersCount: Math.max(0, state.currentWorkspace.membersCount - 1) }
                : state.currentWorkspace,
          }));
        } catch (error: any) {
          console.error('Deactivate member error:', error);
          throw error;
        }
      },

      /**
       * Reactivate member
       */
      reactivateMember: async (workspaceId: string, userId: string) => {
        try {
          await apiClient.patch(`/workspaces/${workspaceId}/members/${userId}/reactivate`);

          // Update member status in list
          set((state) => ({
            members: state.members.map((m) => {
              const memberUserId = typeof m.userId === 'string' ? m.userId : m.userId._id;
              return memberUserId === userId 
                ? { ...m, isActive: true, status: 'active' as any, reactivatedAt: new Date().toISOString() }
                : m;
            }),
          }));

          // Increment member count in workspace
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w._id === workspaceId ? { ...w, membersCount: w.membersCount + 1 } : w
            ),
            currentWorkspace:
              state.currentWorkspace?._id === workspaceId
                ? { ...state.currentWorkspace, membersCount: state.currentWorkspace.membersCount + 1 }
                : state.currentWorkspace,
          }));
        } catch (error: any) {
          console.error('Reactivate member error:', error);
          throw error;
        }
      },

      /**
       * Update member role
       */
      updateMemberRole: async (
        workspaceId: string,
        userId: string,
        input: UpdateMemberRoleInput
      ) => {
        try {
          const response = await apiClient.patch<{ membership: WorkspaceMember }>(
            `/workspaces/${workspaceId}/members/${userId}`,
            input
          );

          // Update in members list
          set((state) => ({
            members: state.members.map((m) => {
              const memberUserId = typeof m.userId === 'string' ? m.userId : m.userId._id;
              return memberUserId === userId ? response.membership : m;
            }),
          }));

          return response.membership;
        } catch (error: any) {
          console.error('Update member role error:', error);
          throw error;
        }
      },

      /**
       * Transfer workspace ownership
       */
      transferOwnership: async (workspaceId: string, input: TransferOwnershipInput) => {
        try {
          await apiClient.post(`/workspaces/${workspaceId}/transfer-ownership`, input);

          // Refresh workspace and members
          await get().fetchWorkspaceById(workspaceId);
          await get().fetchMembers(workspaceId);
        } catch (error: any) {
          console.error('Transfer ownership error:', error);
          throw error;
        }
      },

      /**
       * Leave workspace
       */
      leaveWorkspace: async (workspaceId: string) => {
        try {
          await apiClient.post(`/workspaces/${workspaceId}/leave`, {});

          // Remove from workspaces list
          set((state) => {
            const newWorkspaces = state.workspaces.filter((w) => w._id !== workspaceId);
            
            // If left workspace was current, switch to first available
            let newCurrentWorkspace = state.currentWorkspace;
            let newCurrentWorkspaceId = state.currentWorkspaceId;

            if (state.currentWorkspaceId === workspaceId) {
              newCurrentWorkspace = newWorkspaces[0] || null;
              newCurrentWorkspaceId = newCurrentWorkspace?._id || null;
            }

            return {
              workspaces: newWorkspaces,
              currentWorkspace: newCurrentWorkspace,
              currentWorkspaceId: newCurrentWorkspaceId,
            };
          });
        } catch (error: any) {
          console.error('Leave workspace error:', error);
          throw error;
        }
      },

      /**
       * Resend invitation
       */
      resendInvitation: async (workspaceId: string, token: string) => {
        try {
          await apiClient.post(`/workspaces/${workspaceId}/invitations/${token}/resend`);
        } catch (error: any) {
          console.error('Resend invitation error:', error);
          throw error;
        }
      },

      /**
       * Cancel invitation
       */
      cancelInvitation: async (workspaceId: string, token: string) => {
        try {
          await apiClient.delete(`/workspaces/${workspaceId}/invitations/${token}`);
          
          // Remove from pending invites list
          set((state) => ({
            pendingInvites: state.pendingInvites.filter((invite) => invite.token !== token),
          }));
        } catch (error: any) {
          console.error('Cancel invitation error:', error);
          throw error;
        }
      },

      /**
       * Bulk cancel invitations
       */
      bulkCancelInvitations: async (workspaceId: string, tokens: string[]) => {
        try {
          await apiClient.delete(`/workspaces/${workspaceId}/invitations/bulk`, {
            data: { tokens },
          });
          
          // Remove from pending invites list
          set((state) => ({
            pendingInvites: state.pendingInvites.filter((invite) => !tokens.includes(invite.token)),
          }));
        } catch (error: any) {
          console.error('Bulk cancel invitations error:', error);
          throw error;
        }
      },

      /**
       * Clear all workspace data
       * FE-3: Also clears background refresh state
       */
      clearWorkspaceData: () => {
        // FE-3: Stop background refresh
        const { backgroundRefreshInterval } = get();
        if (backgroundRefreshInterval) {
          clearInterval(backgroundRefreshInterval);
        }

        // FE-4: Cancel all active requests
        for (const [key, tracker] of activeRequests.entries()) {
          tracker.abortController.abort();
          activeRequests.delete(key);
        }

        set({
          workspaces: [],
          currentWorkspace: null,
          currentWorkspaceId: null,
          recentWorkspaceIds: [],
          isLoading: false,
          workspacesLoaded: false,
          members: [],
          membersLoaded: false,
          pendingInvites: [],
          pendingInvitesLoaded: false,
          lastFetchedAt: null, // FE-3: Clear timestamp
          isStale: false, // FE-3: Clear stale state
          backgroundRefreshInterval: null, // FE-3: Clear interval reference
          rateLimitedUntil: null, // GAP 11: Clear rate limit
          retryAfterSeconds: null, // GAP 11: Clear retry countdown
        });
      },

      /**
       * Restore workspace on app load
       * Validates membership and falls back safely
       * Implements exponential backoff for retries
       */
      restoreWorkspace: async (signal?: AbortSignal) => {
        let attempts = 0;
        const MAX_ATTEMPTS = 3;
        const BASE_DELAY = 1000; // 1 second
        
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        const attemptRestore = async (): Promise<void> => {
          try {
            // Check if request was cancelled
            if (signal?.aborted) {
              throw new Error('Request was cancelled');
            }

            // Fetch workspaces first
            await get().fetchWorkspaces(signal);

            const { currentWorkspaceId, workspaces } = get();

            // If we have a stored workspace ID, validate it
            if (currentWorkspaceId) {
              const workspace = workspaces.find((w) => w._id === currentWorkspaceId);
              
              if (workspace) {
                // Valid workspace, set as current
                set({ currentWorkspace: workspace });
              } else {
                // Stored workspace not found, fallback to first
                const firstWorkspace = workspaces[0] || null;
                set({
                  currentWorkspace: firstWorkspace,
                  currentWorkspaceId: firstWorkspace?._id || null,
                });
              }
            }
          } catch (error: any) {
            // Don't retry if request was cancelled
            if (error.name === 'AbortError' || error.name === 'CanceledError' || signal?.aborted || error.message === 'canceled') {
              throw error;
            }

            console.error(`Restore workspace error (attempt ${attempts + 1}):`, error);
            
            // Only retry on network/timeout errors, not on 4xx responses
            const isRetryableError = !error.response || error.response.status >= 500;
            
            if (attempts < MAX_ATTEMPTS && isRetryableError) {
              attempts++;
              
              // Exponential backoff: 1s, 2s, 4s
              const delay = BASE_DELAY * Math.pow(2, attempts - 1);
              
              await sleep(delay);
              
              // Check if cancelled during delay
              if (signal?.aborted) {
                throw new Error('Request was cancelled');
              }
              
              return attemptRestore();
            }
            
            // All retries exhausted - clear invalid data and stop retrying
            set({
              currentWorkspace: null,
              currentWorkspaceId: null,
              workspacesLoaded: true, // Mark as loaded to prevent further attempts
            });
            
            throw error;
          }
        };
        
        return attemptRestore();
      },
    }),
    {
      name: 'workspace-storage',
      // Only persist workspace ID and recent workspaces (not full workspace object)
      partialize: (state) => ({
        currentWorkspaceId: state.currentWorkspaceId,
        recentWorkspaceIds: state.recentWorkspaceIds,
      }),
    }
  )
);

// Register store with interceptor
setWorkspaceIdForInterceptor(useWorkspaceStore.getState().currentWorkspaceId);
useWorkspaceStore.subscribe((state) => {
  setWorkspaceIdForInterceptor(state.currentWorkspaceId);
});
