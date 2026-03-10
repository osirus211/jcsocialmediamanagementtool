import { Post, PostStatus } from '@/types/post.types';
import { SocialAccount } from '@/types/social.types';
import { StatusBadge } from './StatusBadge';
import { SubmitForApprovalButton } from '@/components/approvals/SubmitForApprovalButton';
import { usePostStore } from '@/store/post.store';
import { useState, useEffect } from 'react';
import { Repeat2, RotateCcw } from 'lucide-react';
import { EvergreenBadge } from '@/components/evergreen/EvergreenBadge';
import { EvergreenRuleModal } from '@/components/evergreen/EvergreenRuleModal';
import { RepurposeModal } from '@/components/repurpose/RepurposeModal';
import { evergreenService, EvergreenRule } from '@/services/evergreen.service';
import { logger } from '@/lib/logger';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const { deletePost, retryPost } = usePostStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [evergreenRule, setEvergreenRule] = useState<EvergreenRule | null>(null);
  const [showEvergreenModal, setShowEvergreenModal] = useState(false);
  const [showRepurposeModal, setShowRepurposeModal] = useState(false);

  const account = typeof post.socialAccountId === 'object' 
    ? (post.socialAccountId as SocialAccount) 
    : null;

  const isPublished = post.status === PostStatus.PUBLISHED;

  // Load evergreen rule if post is published
  useEffect(() => {
    if (isPublished) {
      loadEvergreenRule();
    }
  }, [post._id, isPublished]);

  const loadEvergreenRule = async () => {
    try {
      const response = await evergreenService.listRules({ limit: 1 });
      const rule = response.rules.find((r) => r.postId === post._id);
      if (rule) {
        setEvergreenRule(rule);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load evergreen rule';
      logger.error('Failed to load evergreen rule', { error: errorMessage });
    }
  };

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

  const handleMakeEvergreen = () => {
    setShowEvergreenModal(true);
  };

  const handleEvergreenModalClose = () => {
    setShowEvergreenModal(false);
  };

  const handleEvergreenModalSuccess = () => {
    loadEvergreenRule();
  };

  const handleRepurpose = () => {
    setShowRepurposeModal(true);
  };

  const handleRepurposeModalClose = () => {
    setShowRepurposeModal(false);
  };

  return (
    <>
      <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {account && (
              <div className="text-sm text-gray-600 mb-1">
                {account.accountName} • {account.platform}
              </div>
            )}
            <div className="flex items-center gap-2">
              <StatusBadge status={post.status} />
              {evergreenRule && (
                <EvergreenBadge
                  repostInterval={evergreenRule.repostInterval}
                  onClick={handleMakeEvergreen}
                />
              )}
            </div>
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

        <div className="mt-4 flex gap-2 flex-wrap">
          {/* Submit for Approval Button */}
          {(post.status === PostStatus.DRAFT || 
            post.status === PostStatus.PENDING_APPROVAL || 
            post.status === PostStatus.APPROVED || 
            post.status === PostStatus.REJECTED) && (
            <SubmitForApprovalButton
              postId={post._id}
              status={post.status}
              rejectionReason={post.rejectionReason}
            />
          )}
          
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
          {isPublished && !evergreenRule && (
            <button
              onClick={handleMakeEvergreen}
              className="px-3 py-1.5 text-sm bg-green-50 text-green-600 hover:bg-green-100 rounded flex items-center gap-1.5"
            >
              <Repeat2 className="h-4 w-4" />
              <span>Make Evergreen</span>
            </button>
          )}
          {isPublished && (
            <button
              onClick={handleRepurpose}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-600 hover:bg-purple-100 rounded flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Repurpose</span>
            </button>
          )}
        </div>
      </div>

      {showEvergreenModal && (
        <EvergreenRuleModal
          postId={post._id}
          existingRule={evergreenRule || undefined}
          onClose={handleEvergreenModalClose}
          onSuccess={handleEvergreenModalSuccess}
        />
      )}

      {showRepurposeModal && (
        <RepurposeModal
          postId={post._id}
          content={post.content}
          platform={account?.platform || 'unknown'}
          onClose={handleRepurposeModalClose}
        />
      )}
    </>
  );
}
