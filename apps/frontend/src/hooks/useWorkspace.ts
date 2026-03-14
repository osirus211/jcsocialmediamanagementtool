import { useWorkspaceStore } from '@/store/workspace.store';

/**
 * Simple hook to access current workspace from store
 */
export function useWorkspace() {
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const isLoading = useWorkspaceStore((state) => state.isLoading);

  return {
    workspace: currentWorkspace,
    workspaceId: currentWorkspaceId,
    isLoading,
  };
}