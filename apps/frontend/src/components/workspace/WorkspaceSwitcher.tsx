import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Workspace } from '@/types/workspace.types';

/**
 * Workspace Switcher - Dropdown component for switching workspaces
 * 
 * Features:
 * - Shows current workspace with avatar
 * - Lists all workspaces with search/filter
 * - Instant workspace switching
 * - Create new workspace button
 * - Loading states
 * - Keyboard shortcuts (Cmd/Ctrl+K)
 * - Mobile responsive design
 * - Recent workspaces ordering
 * - Slack/Notion-style UX
 * - Stale data indicator
 */
export const WorkspaceSwitcher = memo(() => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    workspaces,
    currentWorkspace,
    isLoading,
    isStale,
    switchWorkspace,
    recentWorkspaceIds = [],
  } = useWorkspaceStore();

  // Filter and sort workspaces
  const filteredWorkspaces = useMemo(() => {
    let filtered = workspaces.filter(workspace =>
      workspace.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort by recent usage, then alphabetically
    filtered.sort((a, b) => {
      const aRecentIndex = recentWorkspaceIds.indexOf(a._id);
      const bRecentIndex = recentWorkspaceIds.indexOf(b._id);
      
      // If both are recent, sort by recent order
      if (aRecentIndex !== -1 && bRecentIndex !== -1) {
        return aRecentIndex - bRecentIndex;
      }
      
      // Recent workspaces come first
      if (aRecentIndex !== -1) return -1;
      if (bRecentIndex !== -1) return 1;
      
      // Alphabetical for non-recent
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [workspaces, searchQuery, recentWorkspaceIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K to open workspace switcher
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
        return;
      }

      // Handle dropdown navigation when open
      if (isOpen) {
        switch (event.key) {
          case 'Escape':
            event.preventDefault();
            setIsOpen(false);
            setSearchQuery('');
            setSelectedIndex(0);
            break;
          case 'ArrowDown':
            event.preventDefault();
            setSelectedIndex(prev => 
              prev < filteredWorkspaces.length ? prev + 1 : prev
            );
            break;
          case 'ArrowUp':
            event.preventDefault();
            setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
            break;
          case 'Enter':
            event.preventDefault();
            if (selectedIndex === filteredWorkspaces.length) {
              // Create new workspace option
              handleCreateWorkspace();
            } else if (filteredWorkspaces[selectedIndex]) {
              handleSwitchWorkspace(filteredWorkspaces[selectedIndex]);
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredWorkspaces, selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(0);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleSwitchWorkspace = useCallback(async (workspace: Workspace) => {
    if (workspace._id === currentWorkspace?._id) {
      setIsOpen(false);
      setSearchQuery('');
      setSelectedIndex(0);
      return;
    }

    try {
      await switchWorkspace(workspace._id);
      setIsOpen(false);
      setSearchQuery('');
      setSelectedIndex(0);
      // Optionally reload or navigate to refresh tenant data
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch workspace:', error);
    }
  }, [currentWorkspace?._id, switchWorkspace]);

  const handleCreateWorkspace = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
    navigate('/workspaces/create');
  }, [navigate]);

  const handleOpenDropdown = useCallback(() => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const getWorkspaceInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'pro':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'team':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (!currentWorkspace) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Workspace Button */}
      <button
        onClick={handleOpenDropdown}
        className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
        disabled={isLoading}
        title="Switch workspace (⌘K)"
      >
        {/* Workspace Avatar */}
        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
          {getWorkspaceInitials(currentWorkspace.name)}
        </div>

        {/* Workspace Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
              {currentWorkspace.name}
            </span>
            {/* Stale Data Indicator */}
            {isStale && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-amber-600 dark:text-amber-400 hidden sm:inline">
                  Refreshing...
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeColor(currentWorkspace.plan)}`}>
              {currentWorkspace.plan}
            </span>
            <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">
              {currentWorkspace.membersCount} member{currentWorkspace.membersCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Dropdown Icon + Keyboard Hint */}
        <div className="flex items-center gap-2">
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono text-gray-500 dark:text-gray-400 group-hover:border-gray-300 dark:group-hover:border-gray-500">
            ⌘K
          </kbd>
          <svg
            className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform ${
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
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-[80vh] sm:max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="px-2 sm:px-3 pb-2">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search workspaces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Workspace List */}
          <div className="max-h-48 sm:max-h-64 overflow-y-auto">
            <div className="px-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 sm:px-3 py-2">
                {searchQuery ? `Found ${filteredWorkspaces.length} workspace${filteredWorkspaces.length !== 1 ? 's' : ''}` : 'Your Workspaces'}
              </div>

              {filteredWorkspaces.length === 0 ? (
                <div className="px-2 sm:px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No workspaces found' : 'No workspaces available'}
                </div>
              ) : (
                filteredWorkspaces.map((workspace, index) => {
                  const isRecent = recentWorkspaceIds.includes(workspace._id);
                  const isSelected = index === selectedIndex;
                  const isCurrent = workspace._id === currentWorkspace._id;
                  
                  return (
                    <button
                      key={workspace._id}
                      onClick={() => handleSwitchWorkspace(workspace)}
                      className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-md transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                          : isCurrent
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {/* Workspace Avatar */}
                      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                        {getWorkspaceInitials(workspace.name)}
                      </div>

                      {/* Workspace Info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {workspace.name}
                          </span>
                          {isRecent && (
                            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Recent
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeColor(workspace.plan)}`}>
                            {workspace.plan}
                          </span>
                          <span className="hidden sm:inline">
                            {workspace.membersCount} member{workspace.membersCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Current Indicator */}
                      {isCurrent && (
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400"
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
                  );
                })
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

          {/* Create Workspace Button */}
          <div className="px-2">
            <button
              onClick={handleCreateWorkspace}
              className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-md transition-colors text-left ${
                selectedIndex === filteredWorkspaces.length
                  ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
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
              <div className="ml-auto hidden sm:block">
                <kbd className="inline-flex items-center px-1.5 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono text-gray-500 dark:text-gray-400">
                  ↵
                </kbd>
              </div>
            </button>
          </div>

          {/* Keyboard Shortcuts Help - Hidden on mobile */}
          <div className="hidden sm:block px-3 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Navigate</span>
                <div className="flex gap-1">
                  <kbd className="px-1 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono">↑</kbd>
                  <kbd className="px-1 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono">↓</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Select</span>
                <kbd className="px-1 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono">↵</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Close</span>
                <kbd className="px-1 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

WorkspaceSwitcher.displayName = 'WorkspaceSwitcher';
