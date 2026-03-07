import { Post, PostStatus } from '@/types/post.types';
import { SocialAccount } from '@/types/social.types';
import { StatusBadge } from './StatusBadge';
import { usePostStore } from '@/store/post.store';
import { useState } from 'react';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const { deletePost, retryPost } = usePostStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const account = typeof post.socialAccountId === 'object' 
    ? (post.socialAccountId as SocialAccount) 
    : null;

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;

    try {
      setIsDeleting(true);
      await deletePost(post._id);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = async () => {
    try {
      setIsRetrying(true);
      await retryPost(post._id);
      alert('Post queued for retry');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to retry post');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {account && (
            <div className="text-sm text-gray-600 mb-1">
              {account.accountName} • {account.platform}
            </div>
          )}
          <StatusBadge status={post.status} />
        </div>
      </div>

      <p className="text-gray-800 mb-3 whitespace-pre-wrap line-clamp-4">
        {post.content}
      </p>

      {post.metadata?.hashtags && post.metadata.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.metadata.hashtags.map((tag, i) => (
            <span key={i} className="text-xs text-blue-600">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        {post.scheduledAt && (
          <div>
            📅 Scheduled: {new Date(post.scheduledAt).toLocaleString()}
          </div>
        )}
        {post.publishedAt && (
          <div>
            ✅ Published: {new Date(post.publishedAt).toLocaleString()}
          </div>
        )}
        {post.errorMessage && (
          <div className="text-red-600">
            ❌ Error: {post.errorMessage}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {post.status === PostStatus.FAILED && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded disabled:opacity-50"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        {(post.status === PostStatus.DRAFT || post.status === PostStatus.SCHEDULED) && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
}
