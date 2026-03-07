import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Workspace } from '@/types/workspace.types';

/**
 * Workspace Switcher - Dropdown component for switching workspaces
 * 
 * Features:
 * - Shows current workspace with avatar
 * - Lists all workspaces
 * - Instant workspace switching
 * - Create new workspace button
 * - Loading states
 * - Slack/Notion-style UX
 */
export const WorkspaceSwitcher = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    workspaces,
    currentWorkspace,
    isLoading,
    switchWorkspace,
  } = useWorkspaceStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSwitchWorkspace = async (workspace: Workspace) => {
    if (workspace._id === currentWorkspace?._id) {
      setIsOpen(false);
      return;
    }

    try {
      await switchWorkspace(workspace._id);
      setIsOpen(false);
      // Optionally reload or navigate to refresh tenant data
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch workspace:', error);
    }
  };

  const handleCreateWorkspace = () => {
    setIsOpen(false);
    navigate('/workspaces/create');
  };

  const getWorkspaceInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!currentWorkspace) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Workspace Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        disabled={isLoading}
      >
        {/* Workspace Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
          {getWorkspaceInitials(currentWorkspace.name)}
        </div>

        {/* Workspace Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {currentWorkspace.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {currentWorkspace.plan} Plan
          </div>
        </div>

        {/* Dropdown Icon */}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-96 overflow-y-auto">
          {/* Workspace List */}
          <div className="px-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
              Your Workspaces
            </div>

            {workspaces.map((workspace) => (
              <button
                key={workspace._id}
                onClick={() => handleSwitchWorkspace(workspace)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  workspace._id === currentWorkspace._id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {/* Workspace Avatar */}
                <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                  {getWorkspaceInitials(workspace.name)}
                </div>

                {/* Workspace Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {workspace.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {workspace.membersCount} member{workspace.membersCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Current Indicator */}
                {workspace._id === currentWorkspace._id && (
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

          {/* Create Workspace Button */}
          <div className="px-2">
            <button
              onClick={handleCreateWorkspace}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-gray-400"
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
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Create Workspace
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
