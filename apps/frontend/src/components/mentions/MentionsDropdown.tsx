import React, { useState, useEffect, useRef } from 'react';
import { PostComment, postCommentsService } from '@/services/post-comments.service';
import { useNavigate } from 'react-router-dom';

export const MentionsDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mentions, setMentions] = useState<PostComment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadRecentMentions = async () => {
    try {
      setLoading(true);
      const response = await postCommentsService.getMentions(5, 0);
      setMentions(response.data);
      setUnreadCount(response.data.length); // Simplified - in real app, track read status
    } catch (error) {
      console.error('Failed to load mentions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentMentions();
    
    // Poll for new mentions every 30 seconds
    const interval = setInterval(loadRecentMentions, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const handleMentionClick = (mention: PostComment) => {
    navigate(`/posts/${mention.postId}?highlight=${mention._id}`);
    setIsOpen(false);
  };

  const handleViewAll = () => {
    navigate('/mentions');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        title="Mentions"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0v8a2 2 0 002 2h6a2 2 0 002-2V8M7 8v8a2 2 0 002 2h6a2 2 0 002-2V8" />
        </svg>
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Mentions</h3>
              <button
                onClick={handleViewAll}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View all
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-gray-300 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : mentions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0v8a2 2 0 002 2h6a2 2 0 002-2V8M7 8v8a2 2 0 002 2h6a2 2 0 002-2V8" />
                </svg>
                <p className="text-sm">No mentions yet</p>
              </div>
            ) : (
              <div className="py-2">
                {mentions.map((mention) => (
                  <div
                    key={mention._id}
                    onClick={() => handleMentionClick(mention)}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        {mention.authorId.avatar ? (
                          <img
                            src={mention.authorId.avatar}
                            alt={`${mention.authorId.firstName} ${mention.authorId.lastName}`}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <span className="text-xs font-medium text-gray-600">
                            {mention.authorId.firstName.charAt(0)}{mention.authorId.lastName.charAt(0)}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">
                            {mention.authorId.firstName} {mention.authorId.lastName}
                          </span>
                          <span className="text-gray-500"> mentioned you</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {mention.content}
                        </p>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(mention.createdAt)}
                        </div>
                      </div>

                      {/* Unread indicator */}
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};