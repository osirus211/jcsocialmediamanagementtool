import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useSocialAccountStore } from '@/store/social.store';
import { Calendar, List, Grid, Plus, Sparkles, Search, X, ChevronDown } from 'lucide-react';
import { CalendarAutoFillModal } from './CalendarAutoFillModal';
import { TimezoneIndicator } from './TimezoneIndicator';
import { getPlatformIcon, getPlatformDisplayName } from '@/lib/platform-utils';
import { SocialPlatform } from '@/types/social.types';

type ViewMode = 'month' | 'week' | 'list';

interface WorkspaceMember {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

interface CalendarHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedMemberIds: string[];
  onFilterByMembers: (memberIds: string[]) => void;
  postCount: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Platform/Account filtering props
  activePlatforms: string[];
  activeAccountIds: string[];
  platformCounts: Record<string, number>;
  hasActiveFilters: boolean;
  onTogglePlatform: (platform: string) => void;
  onToggleAccountId: (accountId: string) => void;
  onClearAllFilters: () => void;
}

/**
 * Generate consistent color from user ID hash
 */
const generateMemberColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
};

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  viewMode,
  onViewModeChange,
  selectedMemberIds,
  onFilterByMembers,
  postCount,
  searchQuery = '',
  onSearchChange,
  activePlatforms,
  activeAccountIds,
  platformCounts,
  hasActiveFilters,
  onTogglePlatform,
  onToggleAccountId,
  onClearAllFilters,
}) => {
  const navigate = useNavigate();
  const { members } = useWorkspaceStore();
  const { accounts } = useSocialAccountStore();
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const handleMemberToggle = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      // Remove member from filter
      onFilterByMembers(selectedMemberIds.filter(id => id !== memberId));
    } else {
      // Add member to filter
      onFilterByMembers([...selectedMemberIds, memberId]);
    }
  };

  const handleAllMembersToggle = () => {
    if (selectedMemberIds.length === 0) {
      // Already showing all, do nothing
      return;
    }
    // Clear all filters to show all members
    onFilterByMembers([]);
  };

  const isAllSelected = selectedMemberIds.length === 0;

  // Get platforms that have connected accounts
  const availablePlatforms = React.useMemo(() => {
    const platformsWithAccounts = new Set(accounts.map(account => account.platform));
    return Array.from(platformsWithAccounts);
  }, [accounts]);

  // Group accounts by platform for dropdown
  const accountsByPlatform = React.useMemo(() => {
    const grouped: Record<string, typeof accounts> = {};
    accounts.forEach(account => {
      if (!grouped[account.platform]) {
        grouped[account.platform] = [];
      }
      grouped[account.platform].push(account);
    });
    return grouped;
  }, [accounts]);

  const handleAccountDropdownToggle = () => {
    setShowAccountDropdown(!showAccountDropdown);
  };

  const handleAccountToggle = (accountId: string) => {
    onToggleAccountId(accountId);
    // Keep dropdown open for multi-selection
  };

  const handleAllAccountsToggle = () => {
    if (activeAccountIds.length === 0) return; // Already showing all
    onToggleAccountId(''); // Clear all account filters
    setShowAccountDropdown(false); // Close dropdown
  };

  return (
    <>
      {/* Timezone Indicator */}
      <TimezoneIndicator />
      
      <div className="bg-white border-b border-gray-200 px-6 py-4">
      {/* Top row: View mode switcher, search, and New Post button */}
      <div className="flex items-center justify-between mb-4">
        {/* Left side: View mode switcher and search */}
        <div className="flex items-center space-x-4">
          {/* View mode switcher */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('month')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-label="Month view"
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              Month
            </button>
            <button
              onClick={() => onViewModeChange('week')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-label="Week view"
            >
              <Grid className="w-4 h-4 mr-1.5" />
              Week
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4 mr-1.5" />
              List
            </button>
          </div>

          {/* Search bar */}
          {onSearchChange && (
            <div className={`relative transition-all duration-200 ${
              isSearchFocused ? 'w-80' : 'w-64'
            }`}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAutoFillModal(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            ✨ Auto-fill
          </button>
          <button
            onClick={() => navigate('/posts/create')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </button>
        </div>
      </div>

      {/* Bottom row: Platform chips, Member filters, Account dropdown, and post count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          {/* Platform filter chips */}
          {availablePlatforms.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Platforms:</span>
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
                {availablePlatforms.map((platform) => {
                  const isSelected = activePlatforms.includes(platform);
                  const count = platformCounts[platform] || 0;
                  const platformIcon = getPlatformIcon(platform);
                  const platformName = getPlatformDisplayName(platform);

                  return (
                    <button
                      key={platform}
                      onClick={() => onTogglePlatform(platform)}
                      className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      data-testid={`platform-chip-${platform}`}
                      aria-label={`Filter by ${platformName}`}
                    >
                      {platformIcon && (
                        <img
                          src={platformIcon}
                          alt={platformName}
                          className="w-4 h-4 mr-1.5"
                        />
                      )}
                      {platformName} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Account filter dropdown */}
          {accounts.length > 0 && (
            <div className="relative">
              <button
                onClick={handleAccountDropdownToggle}
                className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                data-testid="account-dropdown-trigger"
                aria-label="Filter by accounts"
              >
                Accounts
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>

              {showAccountDropdown && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {/* All accounts option */}
                  <button
                    onClick={handleAllAccountsToggle}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      activeAccountIds.length === 0 ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                    data-testid="all-accounts-option"
                  >
                    All accounts
                  </button>

                  {/* Accounts grouped by platform */}
                  {Object.entries(accountsByPlatform).map(([platform, platformAccounts]) => (
                    <div key={platform} className="border-t border-gray-100">
                      <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {getPlatformDisplayName(platform)}
                      </div>
                      {platformAccounts.map((account) => {
                        const isSelected = activeAccountIds.includes(account._id);
                        return (
                          <button
                            key={account._id}
                            onClick={() => handleAccountToggle(account._id)}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center ${
                              isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                            }`}
                            data-testid={`account-option-${account._id}`}
                          >
                            {account.metadata?.avatarUrl ? (
                              <img
                                src={account.metadata.avatarUrl}
                                alt={account.accountName}
                                className="w-5 h-5 rounded-full mr-2"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-300 mr-2 flex items-center justify-center text-xs font-medium text-gray-600">
                                {account.accountName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-medium">{account.accountName}</div>
                            </div>
                            {getPlatformIcon(account.platform) && (
                              <img
                                src={getPlatformIcon(account.platform)!}
                                alt={account.platform}
                                className="w-4 h-4 ml-2"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {accounts.length === 0 && (
                    <div className="px-4 py-6 text-center text-gray-500">
                      <p>No accounts connected</p>
                      <button
                        onClick={() => navigate('/social/accounts')}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-1"
                      >
                        Connect an account
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Member filter pills */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Members:</span>
            
            {/* All Members pill */}
            <button
              onClick={handleAllMembersToggle}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isAllSelected
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Members
            </button>

            {/* Individual member pills */}
            {members.map((member) => {
              const user = member.userId;
              if (typeof user === 'string') return null;

              const isSelected = selectedMemberIds.includes(user._id);
              const memberColor = generateMemberColor(user._id);

              return (
                <button
                  key={member._id}
                  onClick={() => handleMemberToggle(user._id)}
                  className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'text-white border'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={isSelected ? { 
                    backgroundColor: memberColor,
                    borderColor: memberColor 
                  } : {}}
                >
                  {/* Avatar */}
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center mr-2 text-xs font-medium"
                    style={!isSelected ? { 
                      backgroundColor: memberColor,
                      color: 'white'
                    } : { 
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white'
                    }}
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.firstName}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      user.firstName.charAt(0).toUpperCase()
                    )}
                  </div>
                  {user.firstName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Post count badge */}
        <div className="text-sm text-gray-600">
          Showing <span className="font-medium">{postCount}</span> posts
        </div>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="mt-3 flex items-center space-x-2 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-medium text-gray-700">Active filters:</span>
          
          {/* Platform badges */}
          {activePlatforms.map((platform) => {
            const platformName = getPlatformDisplayName(platform);
            const platformIcon = getPlatformIcon(platform);
            
            return (
              <div
                key={`platform-${platform}`}
                className="flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                data-testid={`active-platform-badge-${platform}`}
              >
                {platformIcon && (
                  <img
                    src={platformIcon}
                    alt={platformName}
                    className="w-3 h-3 mr-1"
                  />
                )}
                {platformName}
                <button
                  onClick={() => onTogglePlatform(platform)}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${platformName} filter`}
                  data-testid={`remove-platform-${platform}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Account badges */}
          {activeAccountIds.map((accountId) => {
            const account = accounts.find(acc => acc._id === accountId);
            if (!account) return null;
            
            return (
              <div
                key={`account-${accountId}`}
                className="flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm"
                data-testid={`active-account-badge-${accountId}`}
              >
                {account.metadata?.avatarUrl ? (
                  <img
                    src={account.metadata.avatarUrl}
                    alt={account.accountName}
                    className="w-3 h-3 rounded-full mr-1"
                  />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-green-300 mr-1"></div>
                )}
                @{account.accountName}
                <button
                  onClick={() => onToggleAccountId(accountId)}
                  className="ml-1 hover:bg-green-200 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${account.accountName} filter`}
                  data-testid={`remove-account-${accountId}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Clear all button */}
          <button
            onClick={onClearAllFilters}
            className="px-3 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
            data-testid="clear-all-filters"
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Auto-fill Modal */}
      <CalendarAutoFillModal
        isOpen={showAutoFillModal}
        onClose={() => setShowAutoFillModal(false)}
        connectedAccounts={accounts.map(account => ({
          id: account._id,
          platform: account.platform,
          username: account.accountName,
        }))}
      />

      {/* Click outside handler for account dropdown */}
      {showAccountDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAccountDropdown(false)}
        />
      )}
    </div>
    </>
  );
};