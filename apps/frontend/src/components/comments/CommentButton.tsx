import React, { useState, useEffect } from 'react';
import { postCommentsService } from '@/services/post-comments.service';

interface CommentButtonProps {
  postId: string;
  isActive: boolean;
  onClick: () => void;
}

export const CommentButton: React.FC<CommentButtonProps> = ({ postId, isActive, onClick }) => {
  const [commentCount, setCommentCount] = useState(0);
  const [hasUnresolved, setHasUnresolved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommentData();
  }, [postId]);

  const loadCommentData = async () => {
    try {
      const comments = await postCommentsService.getComments(postId);
      
      // Count total comments (including replies)
      const totalCount = comments.reduce((count, comment) => {
        return count + 1 + (comment.replies?.length || 0);
      }, 0);
      
      // Check for unresolved comments
      const hasUnresolvedComments = comments.some(comment => 
        !comment.isResolved || (comment.replies && comment.replies.some(reply => !reply.isResolved))
      );
      
      setCommentCount(totalCount);
      setHasUnresolved(hasUnresolvedComments);
    } catch (error) {
      console.error('Failed to load comment data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      
      {loading ? (
        <span>...</span>
      ) : (
        <span>{commentCount}</span>
      )}

      {/* Unresolved indicator */}
      {hasUnresolved && !loading && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
      )}
    </button>
  );
};