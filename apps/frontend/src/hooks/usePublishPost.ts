import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComposerStore, composerSelectors } from '@/store/composer.store';
import { composerService } from '@/services/composer.service';
import { ComposerStatus, PublishMode } from '@/types/composer.types';

/**
 * usePublishPost Hook
 * 
 * Implements safe end-to-end publish flow
 * 
 * Flow:
 * 1. Ensure draft is saved
 * 2. Validate publish settings
 * 3. Call publish API
 * 4. Handle success/error
 * 5. Reset or redirect
 * 
 * Safety:
 * - Prevents duplicate clicks
 * - Validates before publish
 * - Shows loading state
 * - Handles errors gracefully
 * - Prevents publish during save
 */
export function usePublishPost() {
  const navigate = useNavigate();
  
  const draftId = useComposerStore(composerSelectors.draftId);
  const isDirty = useComposerStore(composerSelectors.isDirty);
  const publishMode = useComposerStore(composerSelectors.publishMode);
  const scheduledAt = useComposerStore(composerSelectors.scheduledAt);
  const queueSlot = useComposerStore(composerSelectors.queueSlot);
  const text = useComposerStore(composerSelectors.text);
  const selectedAccountIds = useComposerStore(composerSelectors.selectedAccountIds);
  const status = useComposerStore(composerSelectors.status);

  const {
    setStatus,
    setError,
    resetComposer,
  } = useComposerStore();

  const [isPublishing, setIsPublishing] = useState(false);

  /**
   * Validate publish settings
   */
  const validate = useCallback((): { valid: boolean; error?: string } => {
    // Check content
    if (!text.trim()) {
      return { valid: false, error: 'Post content is required' };
    }

    // Check accounts
    if (selectedAccountIds.length === 0) {
      return { valid: false, error: 'Please select at least one account' };
    }

    // Check draft saved
    if (!draftId) {
      return { valid: false, error: 'Draft must be saved before publishing' };
    }

    // Check not dirty
    if (isDirty) {
      return { valid: false, error: 'Please wait for draft to save' };
    }

    // Check not already publishing
    if (isPublishing || status === ComposerStatus.PUBLISHING) {
      return { valid: false, error: 'Publish already in progress' };
    }

    // Validate schedule mode
    if (publishMode === PublishMode.SCHEDULE) {
      if (!scheduledAt) {
        return { valid: false, error: 'Please select a date and time' };
      }

      // Validate future date
      const scheduleDate = new Date(scheduledAt);
      const now = new Date();
      
      if (scheduleDate <= now) {
        return { valid: false, error: 'Scheduled time must be in the future' };
      }
    }

    // Validate queue mode
    if (publishMode === PublishMode.QUEUE) {
      if (!queueSlot) {
        return { valid: false, error: 'Please select a queue slot' };
      }
    }

    return { valid: true };
  }, [
    text,
    selectedAccountIds,
    draftId,
    isDirty,
    isPublishing,
    status,
    publishMode,
    scheduledAt,
    queueSlot,
  ]);

  /**
   * Publish post
   */
  const publish = useCallback(async () => {
    // Validate
    const validation = validate();
    if (!validation.valid) {
      setError(validation.error || 'Validation failed');
      return;
    }

    try {
      setIsPublishing(true);
      setStatus(ComposerStatus.PUBLISHING);
      setError(null);

      // Build publish request
      const publishRequest = {
        publishMode,
        scheduledAt: publishMode === PublishMode.SCHEDULE ? scheduledAt : undefined,
        queueSlot: publishMode === PublishMode.QUEUE ? queueSlot : undefined,
      };

      // Call publish API
      await composerService.publishPost(draftId!, publishRequest);

      // Success
      setStatus(ComposerStatus.SUCCESS);

      // Reset composer
      resetComposer();

      // Redirect to posts list
      setTimeout(() => {
        navigate('/posts');
      }, 500);
    } catch (error: any) {
      console.error('Publish error:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to publish post';
      setError(errorMessage);
      setStatus(ComposerStatus.ERROR);
    } finally {
      setIsPublishing(false);
    }
  }, [
    validate,
    draftId,
    publishMode,
    scheduledAt,
    queueSlot,
    setStatus,
    setError,
    resetComposer,
    navigate,
  ]);

  /**
   * Get publish button text based on mode
   */
  const getPublishButtonText = useCallback((): string => {
    if (isPublishing) {
      return 'Publishing...';
    }

    switch (publishMode) {
      case PublishMode.NOW:
        return 'Post Now';
      case PublishMode.SCHEDULE:
        return 'Schedule Post';
      case PublishMode.QUEUE:
        return 'Add to Queue';
      default:
        return 'Publish';
    }
  }, [isPublishing, publishMode]);

  /**
   * Check if can publish
   */
  const canPublish = useCallback((): boolean => {
    const validation = validate();
    return validation.valid;
  }, [validate]);

  return {
    publish,
    isPublishing,
    canPublish: canPublish(),
    publishButtonText: getPublishButtonText(),
    validate,
  };
}
