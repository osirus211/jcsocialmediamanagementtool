import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Workspace, WorkspaceRole } from '@/types/workspace.types';

/**
 * Workspace List Page
 * 
 * Features:
 * - Lists all user's workspaces
 * - Create new workspace
 * - Switch to workspace
 * - View workspace details
 * - Delete workspace (owner only)
 * - Empty state
 */
export const WorkspaceListPage = () => {
  const navigate = useNavigate();
  const {
    workspaces,
    currentWorkspace,
    isLoading,
    fetchWorkspaces,
    switchWorkspace,
    deleteWorkspace,
  } = useWorkspaceStore();

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    try {
      await switchWorkspace(workspaceId);
      navigate('/');
    } catch (error) {
      console.error('Failed to switch workspace:', error);
    }
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (!confirm(`Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteWorkspace(workspace._id);
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      alert('Failed to delete workspace. Please try again.');
    }
  };

  const getWorkspaceInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isOwner = (workspace: Workspace) => {
    return workspace.userRole === WorkspaceRole.OWNER;
  };

  if (isLoading && workspaces.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Loading workspaces...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Workspaces
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your workspaces and switch between them
            </p>
          </div>

          <button
            onClick={() => navigate('/workspaces/create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Workspace
          </button>
        </div>

        {/* Empty State */}
        {workspaces.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No workspaces yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Get started by creating your first workspace
            </p>
            <button
              onClick={() => navigate('/workspaces/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Workspace
            </button>
          </div>
        )}

        {/* Workspace Grid */}
        {workspaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <div
                key={workspace._id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 transition-all ${
                  workspace._id === currentWorkspace?._id
                    ? 'border-blue-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="p-6">
                  {/* Workspace Header */}
                  <div className="flex items-start gap-4 mb-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {getWorkspaceInitials(workspace.name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {workspace.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        @{workspace.slug}
                      </p>
                    </div>

                    {/* Current Badge */}
                    {workspace._id === currentWorkspace?._id && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Workspace Stats */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      <span>{workspace.membersCount} members</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="capitalize">{workspace.plan}</span>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="mb-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 capitalize">
                      {workspace.userRole || 'member'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {workspace._id !== currentWorkspace?._id && (
                      <button
                        onClick={() => handleSwitchWorkspace(workspace._id)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Switch
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/workspaces/${workspace._id}/settings`)}
                      className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      Settings
                    </button>

                    {isOwner(workspace) && (
                      <button
                        onClick={() => handleDeleteWorkspace(workspace)}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
                        title="Delete workspace"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
