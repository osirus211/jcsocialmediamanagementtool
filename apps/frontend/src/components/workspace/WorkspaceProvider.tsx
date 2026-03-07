import { useEffect, useState } from 'react';
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
    restoreWorkspace,
  } = useWorkspaceStore();

  const [isRestoring, setIsRestoring] = useState(true);
  const [restorationAttempted, setRestorationAttempted] = useState(false);

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

      // Prevent duplicate restoration
      if (restorationAttempted) {
        return;
      }

      try {
        setIsRestoring(true);
        setRestorationAttempted(true);

        // Restore workspace (fetches workspaces and validates stored ID)
        await restoreWorkspace();

        // Check if user has any workspaces
        const { workspaces: updatedWorkspaces, currentWorkspace: current } =
          useWorkspaceStore.getState();

        if (updatedWorkspaces.length === 0) {
          // No workspaces, redirect to create
          navigate('/workspaces/create');
        } else if (!current) {
          // Has workspaces but none selected, should not happen but handle it
          console.warn('Workspaces exist but none selected');
        }
      } catch (error) {
        console.error('Workspace restoration error:', error);
      } finally {
        setIsRestoring(false);
      }
    };

    initializeWorkspace();
  }, [authChecked, isAuthenticated, restorationAttempted, navigate, restoreWorkspace]);

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
