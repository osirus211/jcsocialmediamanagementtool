import React, { useState, useEffect } from 'react';
import { PostComment, postCommentsService } from '@/services/post-comments.service';
import { toast } from '@/lib/notifications';
import { useNavigate } from 'react-router-dom';

export const MentionsPage: React.FC = () => {
  const [mentions, setMentions] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();

  const loadMentions = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    
    try {
      setLoading(true);
      const response = await postCommentsService.getMentions(50, currentOffset);
      
      if (reset) {
        setMentions(response.data);
      } else {
        setMentions(prev => [...prev, ...response.data]);
      }
      
      setHasMore(response.pagination.hasMore);
      setOffset(currentOffset + response.data.length);
    } catch (error: any) {
      toast.error('Failed to load mentions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentions(true);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const renderContentWithMentions = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <span key={index} className="text-blue-600 font-medium">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const handleMentionClick = (mention: PostComment) => {
    // Navigate to the post and highlight the comment
    navigate(`/posts/${mention.postId}?highlight=${mention._id}`);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadMentions(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mentions</h1>
        
        {/* Filter buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && mentions.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mentions list */}
      {!loading && mentions.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0v8a2 2 0 002 2h6a2 2 0 002-2V8M7 8v8a2 2 0 002 2h6a2 2 0 002-2V8" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No mentions yet</h3>
          <p className="text-gray-500">When someone mentions you in a comment, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mentions.map((mention) => (
            <div
              key={mention._id}
              onClick={() => handleMentionClick(mention)}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 cursor-pointer transition-colors"
            >
              <div className="flex items-start space-x-3">
                {/* Avatar */}
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  {mention.authorId.avatar ? (
                    <img
                      src={mention.authorId.avatar}
                      alt={`${mention.authorId.firstName} ${mention.authorId.lastName}`}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-600">
                      {mention.authorId.firstName.charAt(0)}{mention.authorId.lastName.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {mention.authorId.firstName} {mention.authorId.lastName}
                    </span>
                    <span className="text-gray-500">mentioned you in a comment</span>
                    <span className="text-sm text-gray-400">
                      {formatTimeAgo(mention.createdAt)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="text-gray-700 mb-2">
                    {renderContentWithMentions(mention.content)}
                  </div>

                  {/* Post info */}
                  <div className="text-sm text-gray-500">
                    on post: {(mention as any).postId?.title || 'Untitled Post'}
                  </div>
                </div>

                {/* Unread indicator */}
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
              </div>
            </div>
          ))}

          {/* Load more button */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};