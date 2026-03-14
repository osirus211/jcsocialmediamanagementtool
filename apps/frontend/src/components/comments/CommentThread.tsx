import React, { useState, useEffect } from 'react';
import { PostComment, postCommentsService } from '@/services/post-comments.service';
import { CommentItem } from './CommentItem';
import { MentionInput } from './MentionInput';
import { toast } from '@/lib/notifications';

interface CommentThreadProps {
  postId: string;
  isVisible: boolean;
}

export const CommentThread: React.FC<CommentThreadProps> = ({ postId, isVisible }) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-refresh interval
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      loadComments(true); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, [isVisible, postId]);

  // Load comments when visible
  useEffect(() => {
    if (isVisible) {
      loadComments();
    }
  }, [isVisible, postId]);

  const loadComments = async (silent = false) => {
    if (!silent) setLoading(true);
    
    try {
      const data = await postCommentsService.getComments(postId);
      setComments(data);
    } catch (error: any) {
      if (!silent) {
        toast.error('Failed to load comments');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentContent.trim()) return;

    setSubmitting(true);
    try {
      await postCommentsService.addComment(postId, {
        content: newCommentContent,
      });
      setNewCommentContent('');
      await loadComments();
      toast.success('Comment added');
    } catch (error: any) {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    try {
      await postCommentsService.editComment(postId, commentId, { content });
      await loadComments();
      toast.success('Comment updated');
    } catch (error: any) {
      toast.error('Failed to update comment');
      throw error;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await postCommentsService.deleteComment(postId, commentId);
      await loadComments();
      toast.success('Comment deleted');
    } catch (error: any) {
      toast.error('Failed to delete comment');
      throw error;
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await postCommentsService.resolveComment(postId, commentId);
      await loadComments();
      toast.success('Comment resolved');
    } catch (error: any) {
      toast.error('Failed to resolve comment');
      throw error;
    }
  };

  const handleUnresolveComment = async (commentId: string) => {
    try {
      await postCommentsService.unresolveComment(postId, commentId);
      await loadComments();
      toast.success('Comment unresolved');
    } catch (error: any) {
      toast.error('Failed to unresolve comment');
      throw error;
    }
  };

  const handleAddReaction = async (commentId: string, emoji: string) => {
    try {
      await postCommentsService.addReaction(postId, commentId, emoji);
      await loadComments();
    } catch (error: any) {
      toast.error('Failed to add reaction');
      throw error;
    }
  };

  const handleRemoveReaction = async (commentId: string, emoji: string) => {
    try {
      await postCommentsService.removeReaction(postId, commentId, emoji);
      await loadComments();
    } catch (error: any) {
      toast.error('Failed to remove reaction');
      throw error;
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    try {
      await postCommentsService.addComment(postId, {
        content,
        parentId,
      });
      await loadComments();
      toast.success('Reply added');
    } catch (error: any) {
      toast.error('Failed to add reply');
      throw error;
    }
  };

  if (!isVisible) return null;

  const totalComments = comments.reduce((count, comment) => {
    return count + 1 + (comment.replies?.length || 0);
  }, 0);

  const unresolvedComments = comments.filter(comment => 
    !comment.isResolved || (comment.replies && comment.replies.some(reply => !reply.isResolved))
  ).length;

  return (
    <div className="bg-gray-50 border-t border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Comments ({totalComments})
        </h3>
        {unresolvedComments > 0 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {unresolvedComments} unresolved
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
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

      {/* Comments list */}
      {!loading && (
        <>
          {comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium mb-1">No comments yet</p>
              <p className="text-sm">Be the first to leave a comment</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((comment) => (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onResolve={handleResolveComment}
                  onUnresolve={handleUnresolveComment}
                  onReply={handleReply}
                  onAddReaction={handleAddReaction}
                  onRemoveReaction={handleRemoveReaction}
                />
              ))}
            </div>
          )}

          {/* New comment input */}
          <div className="border-t border-gray-200 pt-4">
            <MentionInput
              value={newCommentContent}
              onChange={setNewCommentContent}
              onSubmit={handleAddComment}
              placeholder="Write a comment..."
              disabled={submitting}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-500">
                Press Ctrl+Enter to post
              </div>
              <button
                onClick={handleAddComment}
                disabled={submitting || !newCommentContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};