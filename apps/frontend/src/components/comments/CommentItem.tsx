import React, { useState } from 'react';
import { PostComment } from '@/services/post-comments.service';
import { MentionInput } from './MentionInput';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { WorkspaceRole } from '@/types/workspace.types';

interface CommentItemProps {
  comment: PostComment;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
  onUnresolve: (commentId: string) => Promise<void>;
  onReply: (parentId: string, content: string) => Promise<void>;
  isNested?: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  onReply,
  isNested = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(false);

  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();

  const isAuthor = user?._id === comment.authorId._id;
  const isAdmin = currentWorkspace?.userRole === WorkspaceRole.ADMIN || currentWorkspace?.userRole === WorkspaceRole.OWNER;
  const canDelete = isAuthor || isAdmin;

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
        // This is a mention
        return (
          <span key={index} className="text-blue-600 font-medium">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    
    setLoading(true);
    try {
      await onEdit(comment._id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    setLoading(true);
    try {
      await onDelete(comment._id);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    setLoading(true);
    try {
      if (comment.isResolved) {
        await onUnresolve(comment._id);
      } else {
        await onResolve(comment._id);
      }
    } catch (error) {
      console.error('Failed to toggle resolve status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    
    setLoading(true);
    try {
      await onReply(comment._id, replyContent);
      setReplyContent('');
      setIsReplying(false);
    } catch (error) {
      console.error('Failed to reply:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${isNested ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''} ${comment.isDeleted ? 'opacity-50' : ''}`}>
      <div className={`bg-white rounded-lg p-4 ${comment.isResolved ? 'bg-green-50 border border-green-200' : 'border border-gray-200'}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              {comment.authorId.avatar ? (
                <img
                  src={comment.authorId.avatar}
                  alt={`${comment.authorId.firstName} ${comment.authorId.lastName}`}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <span className="text-sm font-medium text-gray-600">
                  {comment.authorId.firstName.charAt(0)}{comment.authorId.lastName.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {comment.authorId.firstName} {comment.authorId.lastName}
              </div>
              <div className="text-xs text-gray-500">
                {formatTimeAgo(comment.createdAt)}
                {comment.editedAt && ' (edited)'}
              </div>
            </div>
          </div>

          {/* Resolved badge */}
          {comment.isResolved && (
            <div className="flex items-center space-x-1 text-green-600 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Resolved</span>
            </div>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mb-3">
            <MentionInput
              value={editContent}
              onChange={setEditContent}
              placeholder="Edit your comment..."
              disabled={loading}
            />
            <div className="flex items-center space-x-2 mt-2">
              <button
                onClick={handleEdit}
                disabled={loading || !editContent.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                disabled={loading}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3 text-gray-900">
            {comment.isDeleted ? (
              <em className="text-gray-500">This comment has been deleted</em>
            ) : (
              renderContentWithMentions(comment.content)
            )}
          </div>
        )}

        {/* Actions */}
        {!comment.isDeleted && (
          <div className="flex items-center space-x-4 text-sm">
            <button
              onClick={handleResolve}
              disabled={loading}
              className={`hover:underline ${comment.isResolved ? 'text-green-600' : 'text-gray-500'}`}
            >
              {comment.isResolved ? 'Unresolve' : 'Resolve'}
            </button>
            
            {!isNested && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="text-gray-500 hover:underline"
              >
                Reply
              </button>
            )}
            
            {isAuthor && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-gray-500 hover:underline"
              >
                Edit
              </button>
            )}
            
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="text-red-500 hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {/* Reply input */}
        {isReplying && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <MentionInput
              value={replyContent}
              onChange={setReplyContent}
              placeholder="Write a reply..."
              disabled={loading}
            />
            <div className="flex items-center space-x-2 mt-2">
              <button
                onClick={handleReply}
                disabled={loading || !replyContent.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Reply
              </button>
              <button
                onClick={() => {
                  setIsReplying(false);
                  setReplyContent('');
                }}
                disabled={loading}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              onEdit={onEdit}
              onDelete={onDelete}
              onResolve={onResolve}
              onUnresolve={onUnresolve}
              onReply={onReply}
              isNested={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};