import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Calendar, List, Plus, Sparkles } from 'lucide-react';
import { CalendarAutoFillModal } from './CalendarAutoFillModal';

type ViewMode = 'month' | 'week';

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
}) => {
  const navigate = useNavigate();
  const { members } = useWorkspaceStore();
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);

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

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      {/* Top row: View mode switcher and New Post button */}
      <div className="flex items-center justify-between mb-4">
        {/* View mode switcher */}
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('month')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
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
          >
            <List className="w-4 h-4 mr-1.5" />
            Week
          </button>
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

      {/* Bottom row: Member filters and post count */}
      <div className="flex items-center justify-between">
        {/* Member filter pills */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Filter by:</span>
          
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

        {/* Post count badge */}
        <div className="text-sm text-gray-600">
          Showing <span className="font-medium">{postCount}</span> posts
        </div>
      </div>

      {/* Auto-fill Modal */}
      <CalendarAutoFillModal
        isOpen={showAutoFillModal}
        onClose={() => setShowAutoFillModal(false)}
        connectedAccounts={[]} // TODO: Pass actual connected accounts
      />
    </div>
  );
};