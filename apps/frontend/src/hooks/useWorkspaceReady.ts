import { useWorkspaceStore } from '@/store/workspace.store';

/**
 * Hook to check if workspace is ready for API calls
 * 
 * Returns true when:
 * - Workspaces have been loaded from the backend
 * - A current workspace is selected
 * 
 * Use this to gate API calls that require workspace context
 */
export const useWorkspaceReady = () => {
  const { currentWorkspace, workspacesLoaded } = useWorkspaceStore();
  
  return {
    isWorkspaceReady: workspacesLoaded && !!currentWorkspace,
    currentWorkspace,
    workspacesLoaded,
  };
};