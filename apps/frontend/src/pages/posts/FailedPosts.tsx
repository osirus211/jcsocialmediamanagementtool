import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { dlqService } from '@/services/dlq.service';
import { useRetryPost } from '@/hooks/useRetryPost';
import { FailedPostCard } from '@/components/failed-posts/FailedPostCard';
import { DLQJob } from '@/types/dlq.types';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SuccessToast } from '@/components/feedback/SuccessToast';

/**
 * FailedPostsPage Component
 * 
 * Shows all failed posts with retry/delete actions
 * 
 * Features:
 * - List failed posts
 * - Retry individual posts
 * - Bulk retry (optional)
 * - Delete posts
 * - Loading/empty states
 * - Error handling
 * 
 * Safety:
 * - No duplicate retries
 * - Idempotent operations
 * - Optimistic updates
 * - Clear error messages
 */
export function FailedPostsPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  
  const [jobs, setJobs] = useState<DLQJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const {
    retryJob,
    retryBatch,
    isRetrying,
    getRetryStatus,
    getRetryError,
    clearRetryError,
  } = useRetryPost();

  /**
   * Fetch failed posts
   */
  const fetchFailedPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await dlqService.preview(1, 100);
      setJobs(response.jobs);
    } catch (err: any) {
      console.error('Fetch failed posts error:', err);
      setError(err.response?.data?.message || 'Failed to load failed posts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load on mount
   */
  useEffect(() => {
    if (currentWorkspace) {
      fetchFailedPosts();
    }
  }, [currentWorkspace, fetchFailedPosts]);

  /**
   * Handle retry single post
   */
  const handleRetry = useCallback(async (jobId: string) => {
    const success = await retryJob(jobId);
    
    if (success) {
      // Remove from list after successful retry
      setTimeout(() => {
        setJobs((prev) => prev.filter((job) => job.id !== jobId));
        setSuccessMessage('Post retried successfully!');
        setShowSuccessToast(true);
      }, 1000);
    }
  }, [retryJob]);

  /**
   * Handle delete post
   */
  const handleDelete = useCallback(async (jobId: string) => {
    // Remove from list (optimistic)
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
    
    // TODO: Call delete API if needed
    // For now, just remove from UI
  }, []);

  /**
   * Handle bulk retry
   */
  const handleBulkRetry = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    const jobIds = Array.from(selectedJobs);
    const result = await retryBatch(jobIds);
    
    if (result.success) {
      // Remove successfully retried jobs
      setTimeout(() => {
        setJobs((prev) => prev.filter((job) => !selectedJobs.has(job.id)));
        setSelectedJobs(new Set());
        setSuccessMessage(`${result.replayed} post(s) retried successfully!`);
        setShowSuccessToast(true);
      }, 1000);
    }
  }, [selectedJobs, retryBatch]);

  /**
   * Toggle job selection
   */
  const toggleJobSelection = useCallback((jobId: string) => {
    setSelectedJobs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  }, []);

  /**
   * Select all jobs
   */
  const selectAll = useCallback(() => {
    setSelectedJobs(new Set(jobs.map((job) => job.id)));
  }, [jobs]);

  /**
   * Deselect all jobs
   */
  const deselectAll = useCallback(() => {
    setSelectedJobs(new Set());
  }, []);

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Please select a workspace first
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Failed Posts</h1>
            <p className="text-gray-600 mt-1">
              Review and retry posts that failed to publish
            </p>
          </div>
          
          <button
            onClick={fetchFailedPosts}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {jobs.length > 0 && (
          <div className="bg-white border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {selectedJobs.size} of {jobs.length} selected
                </span>
                
                {selectedJobs.size === 0 ? (
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Select All
                  </button>
                ) : (
                  <button
                    onClick={deselectAll}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Deselect All
                  </button>
                )}
              </div>
              
              {selectedJobs.size > 0 && (
                <button
                  onClick={handleBulkRetry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Selected ({selectedJobs.size})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading failed posts...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && jobs.length === 0 && (
          <div className="text-center py-12 bg-white border rounded-lg">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No failed posts
            </h3>
            <p className="text-gray-600 mb-4">
              All your posts have been published successfully!
            </p>
            <button
              onClick={() => navigate('/posts')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View All Posts
            </button>
          </div>
        )}

        {/* Failed posts list */}
        {!isLoading && jobs.length > 0 && (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedJobs.has(job.id)}
                  onChange={() => toggleJobSelection(job.id)}
                  className="mt-5 w-4 h-4 text-blue-600 rounded"
                />
                
                {/* Card */}
                <div className="flex-1">
                  <FailedPostCard
                    job={job}
                    onRetry={handleRetry}
                    onDelete={handleDelete}
                    retryStatus={getRetryStatus(job.id)}
                    retryError={getRetryError(job.id)}
                    isRetrying={isRetrying(job.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Success toast */}
      {showSuccessToast && (
        <SuccessToast
          message={successMessage}
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
}
