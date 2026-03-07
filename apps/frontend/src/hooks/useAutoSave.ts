import { useEffect, useRef, useCallback } from 'react';
import { useComposerStore, composerSelectors } from '@/store/composer.store';
import { composerService } from '@/services/composer.service';
import { ComposerStatus } from '@/types/composer.types';

/**
 * Auto-save configuration
 */
const AUTO_SAVE_DEBOUNCE_MS = 1000; // 1 second debounce
const MAX_RETRY_ATTEMPTS = 1;

/**
 * useAutoSave Hook
 * 
 * Implements safe debounced auto-save for composer drafts
 * 
 * Features:
 * - Debounced saves (1 second)
 * - Race condition protection
 * - Retry on failure (1 attempt)
 * - Cancel pending saves on unmount
 * - Only saves when dirty
 * - Shows UI state (Saving... → Saved)
 * 
 * Safety:
 * - Prevents overlapping saves
 * - Prevents API spam
 * - Safe under rapid typing
 * - Graceful error handling
 */
export function useAutoSave() {
  const draftId = useComposerStore(composerSelectors.draftId);
  const isDirty = useComposerStore(composerSelectors.isDirty);
  const text = useComposerStore(composerSelectors.text);
  const platformContent = useComposerStore(composerSelectors.platformContent);
  const selectedAccountIds = useComposerStore(composerSelectors.selectedAccountIds);
  const mediaIds = useComposerStore(composerSelectors.mediaIds);
  const status = useComposerStore(composerSelectors.status);

  const {
    setDraftId,
    markSaved,
    setStatus,
    setError,
  } = useComposerStore();

  // Track if save is in progress (prevent race conditions)
  const isSavingRef = useRef(false);
  
  // Debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Retry counter
  const retryCountRef = useRef(0);

  /**
   * Perform save operation
   */
  const performSave = useCallback(async () => {
    // Prevent overlapping saves
    if (isSavingRef.current) {
      return;
    }

    // Don't save if not dirty
    if (!isDirty) {
      return;
    }

    // Don't save if already publishing
    if (status === ComposerStatus.PUBLISHING) {
      return;
    }

    try {
      isSavingRef.current = true;
      setStatus(ComposerStatus.SAVING);

      const payload = {
        content: text,
        socialAccountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
        platformContent: platformContent.length > 0 ? platformContent : undefined,
      };

      let savedPost;

      if (draftId) {
        // Update existing draft
        savedPost = await composerService.updateDraft(draftId, payload);
      } else {
        // Create new draft
        savedPost = await composerService.createDraft(payload);
        setDraftId(savedPost._id);
      }

      // Mark as saved
      markSaved();
      retryCountRef.current = 0; // Reset retry counter on success
    } catch (error: any) {
      console.error('Auto-save error:', error);

      // Retry once on failure
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current++;
        
        // Retry after 2 seconds
        setTimeout(() => {
          isSavingRef.current = false;
          performSave();
        }, 2000);
      } else {
        // Max retries reached, show error
        setError(error.response?.data?.message || 'Failed to save draft');
        retryCountRef.current = 0;
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [
    isDirty,
    status,
    draftId,
    text,
    platformContent,
    selectedAccountIds,
    mediaIds,
    setDraftId,
    markSaved,
    setStatus,
    setError,
  ]);

  /**
   * Debounced save trigger
   */
  const triggerSave = useCallback(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [performSave]);

  /**
   * Effect: Trigger save when content changes
   */
  useEffect(() => {
    if (isDirty) {
      triggerSave();
    }

    // Cleanup: Cancel pending save on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isDirty, text, platformContent, selectedAccountIds, mediaIds, triggerSave]);

  /**
   * Manual save function (for explicit save button)
   */
  const manualSave = useCallback(async () => {
    // Cancel debounced save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Perform immediate save
    await performSave();
  }, [performSave]);

  return {
    manualSave,
    isSaving: status === ComposerStatus.SAVING,
    isSaved: status === ComposerStatus.SAVED,
    hasError: status === ComposerStatus.ERROR,
  };
}
