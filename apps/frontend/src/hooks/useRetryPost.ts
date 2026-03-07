import { useState, useCallback, useRef } from 'react';
import { dlqService } from '@/services/dlq.service';
import { RetryStatus } from '@/types/dlq.types';

/**
 * useRetryPost Hook
 * 
 * Manages retry logic for failed posts
 * 
 * Safety:
 * - Prevents duplicate retries (isRetrying flag)
 * - Disables button during retry
 * - Shows loading state
 * - Handles errors gracefully
 * - Respects backend idempotency
 */
export function useRetryPost() {
  const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());
  const [retryStatus, setRetryStatus] = useState<Record<string, RetryStatus>>({});
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  
  // Prevent concurrent retries for same job
  const retryingRef = useRef<Set<string>>(new Set());

  /**
   * Retry single job
   */
  const retryJob = useCallback(async (jobId: string): Promise<boolean> => {
    // Prevent duplicate retry
    if (retryingRef.current.has(jobId)) {
      return false;
    }

    try {
      // Mark as retrying
      retryingRef.current.add(jobId);
      setRetryingJobs((prev) => new Set(prev).add(jobId));
      setRetryStatus((prev) => ({ ...prev, [jobId]: RetryStatus.RETRYING }));
      setRetryErrors((prev) => {
        const { [jobId]: _, ...rest } = prev;
        return rest;
      });

      // Call API
      const response = await dlqService.replayJob(jobId);

      // Success
      setRetryStatus((prev) => ({ ...prev, [jobId]: RetryStatus.SUCCESS }));
      
      // Clear success status after 3 seconds
      setTimeout(() => {
        setRetryStatus((prev) => {
          const { [jobId]: _, ...rest } = prev;
          return rest;
        });
      }, 3000);

      return true;
    } catch (error: any) {
      console.error('Retry job error:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to retry post';
      
      setRetryStatus((prev) => ({ ...prev, [jobId]: RetryStatus.FAILED }));
      setRetryErrors((prev) => ({ ...prev, [jobId]: errorMessage }));
      
      return false;
    } finally {
      // Clean up
      retryingRef.current.delete(jobId);
      setRetryingJobs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  }, []);

  /**
   * Retry multiple jobs (batch)
   */
  const retryBatch = useCallback(async (jobIds: string[]): Promise<{
    success: boolean;
    replayed: number;
    failed: number;
  }> => {
    // Filter out jobs already being retried
    const validJobIds = jobIds.filter((id) => !retryingRef.current.has(id));
    
    if (validJobIds.length === 0) {
      return { success: false, replayed: 0, failed: 0 };
    }

    try {
      // Mark all as retrying
      validJobIds.forEach((id) => {
        retryingRef.current.add(id);
        setRetryingJobs((prev) => new Set(prev).add(id));
        setRetryStatus((prev) => ({ ...prev, [id]: RetryStatus.RETRYING }));
      });

      // Call batch API
      const response = await dlqService.replayBatch(validJobIds);

      // Mark all as success
      validJobIds.forEach((id) => {
        setRetryStatus((prev) => ({ ...prev, [id]: RetryStatus.SUCCESS }));
      });

      // Clear success status after 3 seconds
      setTimeout(() => {
        setRetryStatus((prev) => {
          const newStatus = { ...prev };
          validJobIds.forEach((id) => {
            delete newStatus[id];
          });
          return newStatus;
        });
      }, 3000);

      return {
        success: true,
        replayed: response.replayed,
        failed: response.failed,
      };
    } catch (error: any) {
      console.error('Retry batch error:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to retry posts';
      
      // Mark all as failed
      validJobIds.forEach((id) => {
        setRetryStatus((prev) => ({ ...prev, [id]: RetryStatus.FAILED }));
        setRetryErrors((prev) => ({ ...prev, [id]: errorMessage }));
      });

      return { success: false, replayed: 0, failed: validJobIds.length };
    } finally {
      // Clean up
      validJobIds.forEach((id) => {
        retryingRef.current.delete(id);
        setRetryingJobs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      });
    }
  }, []);

  /**
   * Check if job is retrying
   */
  const isRetrying = useCallback((jobId: string): boolean => {
    return retryingJobs.has(jobId);
  }, [retryingJobs]);

  /**
   * Get retry status for job
   */
  const getRetryStatus = useCallback((jobId: string): RetryStatus => {
    return retryStatus[jobId] || RetryStatus.IDLE;
  }, [retryStatus]);

  /**
   * Get retry error for job
   */
  const getRetryError = useCallback((jobId: string): string | null => {
    return retryErrors[jobId] || null;
  }, [retryErrors]);

  /**
   * Clear retry error
   */
  const clearRetryError = useCallback((jobId: string) => {
    setRetryErrors((prev) => {
      const { [jobId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    retryJob,
    retryBatch,
    isRetrying,
    getRetryStatus,
    getRetryError,
    clearRetryError,
  };
}
