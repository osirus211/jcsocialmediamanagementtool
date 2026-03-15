import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useNavigate } from 'react-router-dom';

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

/**
 * Workspace Provider - Handles workspace restoration on app load
 * 
 * Flow:
 * 1. Wait for auth to be ready
 * 2. Fetch user's workspaces
 * 3. Restore stored workspaceId
 * 4. Validate membership with backend
 * 5. Fallback to first workspace if invalid
 * 6. Redirect to create if no workspaces
 * 
 * Security:
 * - Never trusts stored workspace blindly
 * - Validates membership on every restore
 * - Prevents race conditions
 * - No API calls before workspace restored
 */
export const WorkspaceProvider = ({ children }: WorkspaceProviderProps) => {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuthStore();
  const {
    workspaces,
    currentWorkspace,
    workspacesLoaded,
  } = useWorkspaceStore();

  const [isRestoring, setIsRestoring] = useState(true);
  const [restorationAttempted, setRestorationAttempted] = useState(false);
  
  // AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track if initialization is in progress to prevent duplicates
  const initializationInProgressRef = useRef(false);

  useEffect(() => {
    const initializeWorkspace = async () => {
      // Wait for auth to be checked
      if (!authChecked) {
        return;
      }

      // If not authenticated, don't restore workspace
      if (!isAuthenticated) {
        setIsRestoring(false);
        setRestorationAttempted(true);
        return;
      }

      // Prevent duplicate restoration - critical for StrictMode
      if (restorationAttempted || initializationInProgressRef.current) {
        return;
      }

      // Mark initialization as in progress
      initializationInProgressRef.current = true;

      try {
        setIsRestoring(true);
        setRestorationAttempted(true);

        // Create AbortController for this initialization attempt only
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        // Get the restoreWorkspace function from the store and call it
        const { restoreWorkspace } = useWorkspaceStore.getState();
        await restoreWorkspace(abortControllerRef.current.signal);

        // Check if user has any workspaces
        const { workspaces: updatedWorkspaces, currentWorkspace: current } =
          useWorkspaceStore.getState();

        if (updatedWorkspaces.length === 0) {
          // No workspaces, redirect to create
          navigate('/workspaces/create');
        } else if (!current) {
          // Has workspaces but none selected, should not happen but handle it
          console.warn('Workspaces exist but none selected');
          // Set first workspace as current
          const firstWorkspace = updatedWorkspaces[0];
          useWorkspaceStore.getState().setCurrentWorkspace(firstWorkspace);
        }
      } catch (error) {
        // Check if the error is due to cancellation
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request was cancelled' || error.message === 'canceled')) {
          console.log('Workspace restoration was cancelled');
          return;
        }
        
        console.error('Workspace restoration error:', error);
        
        // Check if we have workspaces loaded despite the error
        const { workspaces: fallbackWorkspaces, workspacesLoaded: loaded } = 
          useWorkspaceStore.getState();
          
        if (loaded && fallbackWorkspaces.length === 0) {
          // No workspaces available, redirect to create
          navigate('/workspaces/create');
        } else if (loaded && fallbackWorkspaces.length > 0) {
          // We have workspaces but restoration failed, use first one
          const firstWorkspace = fallbackWorkspaces[0];
          useWorkspaceStore.getState().setCurrentWorkspace(firstWorkspace);
        } else {
          // Complete failure, redirect to error or create page
          console.error('Complete workspace restoration failure');
          navigate('/workspaces/create');
        }
      } finally {
        setIsRestoring(false);
        initializationInProgressRef.current = false;
      }
    };

    initializeWorkspace();

    // Cleanup function to cancel in-flight requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      initializationInProgressRef.current = false;
    };
  }, [authChecked, isAuthenticated, navigate]); // Removed unstable dependencies

  // Show loading gate while restoring
  // Prevents UI flicker and ensures workspace is ready before rendering
  if (isAuthenticated && isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  // Render children once workspace is restored
  return <>{children}</>;
};
