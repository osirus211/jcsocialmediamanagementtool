/**
 * Draft Comments Panel
 * 
 * Right sidebar panel for draft comments with threading and real-time updates
 */

import React, { useState, useEffect, useRef } from 'react';
import { draftCollaborationService } from '../../services/draft-collaboration.service';

interface DraftComment {
  _id: string;
  draftId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  mentions: string[];
  parentId?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  position?: {
    field: string;
    selectionStart: number;
    selectionEnd: number;
    selectedText?: string;
  };
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
  replies?: DraftComment[];
}

interface DraftCommentsPanelProps {
  draftId: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const DraftCommentsPanel: React.FC<DraftCommentsPanelProps> = ({
  draftId,
  isOpen,
  onClose,
  className = ''
}) => {
  const [comments, setComments] = useState<DraftComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load comments
  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/drafts/${draftId}/comments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setComments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [draftId, isOpen]);

  // Real-time comment updates
  useEffect(() => {
    const handleCommentAdded = () => {
      loadComments(); // Refresh comments when new ones are added
    };

    draftCollaborationService.on('comment-added', handleCommentAdded);

    return () => {
      draftCollaborationService.off('comment-added', handleCommentAdded);
    };
  }, []);

  // Add new comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/v1/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          content: newComment
        })
      });

      if (response.ok) {
        setNewComment('');
        loadComments();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  // Add reply
  const handleAddReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    try {
      const response = await fetch(`/api/v1/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          content: replyContent,
          parentId
        })
      });

      if (response.ok) {
        setReplyContent('');
        setReplyingTo(null);
        loadComments();
      }
    } catch (error) {
      console.error('Failed to add reply:', error);
    }
  };

  // Resolve/unresolve comment
  const handleToggleResolve = async (commentId: string, isResolved: boolean) => {
    try {
      const method = isResolved ? 'DELETE' : 'POST';
      const response = await fetch(`/api/v1/drafts/${draftId}/comments/${commentId}/resolve`, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        loadComments();
      }
    } catch (error) {
      console.error('Failed to toggle resolve:', error);
    }
  };

  // Filter comments
  const filteredComments = comments.filter(comment => {
    if (filter === 'resolved') return comment.isResolved;
    if (filter === 'unresolved') return !comment.isResolved;
    return true;
  });

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Render comment
  const renderComment = (comment: DraftComment, isReply = false) => (
    <div
      key={comment._id}
      className={`${isReply ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''} mb-4`}
    >
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border ${
        comment.isResolved ? 'border-green-200 dark:border-green-800' : 'border-gray-200 dark:border-gray-700'
      }`}>
        {/* Comment header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
              {comment.authorAvatar ? (
                <img
                  src={comment.authorAvatar}
                  alt={comment.authorName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                comment.authorName.charAt(0).toUpperCase()
              )}
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {comment.authorName}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(comment.createdAt)}
            </span>
            {comment.editedAt && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                (edited)
              </span>
            )}
          </div>
          
          {/* Resolve button */}
          <button
            onClick={() => handleToggleResolve(comment._id, comment.isResolved)}
            className={`text-xs px-2 py-1 rounded ${
              comment.isResolved
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {comment.isResolved ? 'Resolved' : 'Resolve'}
          </button>
        </div>

        {/* Comment content */}
        <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          {comment.content}
        </div>

        {/* Position info */}
        {comment.position && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <strong>On:</strong> {comment.position.selectedText || `${comment.position.field} (${comment.position.selectionStart}-${comment.position.selectionEnd})`}
          </div>
        )}

        {/* Reply button */}
        {!isReply && (
          <button
            onClick={() => setReplyingTo(comment._id)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Reply
          </button>
        )}

        {/* Reply form */}
        {replyingTo === comment._id && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              rows={2}
            />
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
                className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddReply(comment._id)}
                disabled={!replyContent.trim()}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Comments
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['all', 'unresolved', 'resolved'] as const).map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`flex-1 px-4 py-2 text-sm font-medium capitalize ${
              filter === filterType
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {filterType}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading comments...</p>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'all' ? 'No comments yet' : `No ${filter} comments`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredComments.map(comment => renderComment(comment))}
          </div>
        )}
      </div>

      {/* Add comment form */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
          rows={3}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Comment
          </button>
        </div>
      </div>
    </div>
  );
};