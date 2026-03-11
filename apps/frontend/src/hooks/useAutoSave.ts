import { useEffect, useRef, useCallback } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { composerService } from '@/services/composer.service';
import { SaveStatus, SocialPlatform } from '@/types/composer.types';

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
  const {
    draftId,
    hasUnsavedChanges,
    mainContent,
    platformContent,
    selectedAccounts,
    media,
    saveStatus,
    setDraftId,
    setSaveStatus,
    setSaveError,
    setLastSaved,
    setHasUnsavedChanges,
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
    if (!hasUnsavedChanges) {
      return;
    }

    // Don't save if already saving
    if (saveStatus === 'saving') {
      return;
    }

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');

      const platformContentArray = Object.entries(platformContent)
        .filter(([_, text]) => text.trim().length > 0)
        .map(([platform, text]) => ({
          platform: platform as SocialPlatform,
          text,
          enabled: true,
        }));

      const payload = {
        content: mainContent,
        socialAccountIds: selectedAccounts.length > 0 ? selectedAccounts : undefined,
        mediaIds: media
          .filter((m) => m.uploadStatus === 'completed')
          .map((m) => m.id),
        platformContent: platformContentArray.length > 0 ? platformContentArray : undefined,
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
      setSaveStatus('saved');
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
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
        setSaveError(error.response?.data?.message || 'Failed to save draft');
        setSaveStatus('error');
        retryCountRef.current = 0;
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [
    hasUnsavedChanges,
    saveStatus,
    draftId,
    mainContent,
    platformContent,
    selectedAccounts,
    media,
    setDraftId,
    setSaveStatus,
    setSaveError,
    setLastSaved,
    setHasUnsavedChanges,
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
    if (hasUnsavedChanges) {
      triggerSave();
    }

    // Cleanup: Cancel pending save on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, mainContent, platformContent, selectedAccounts, media, triggerSave]);

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
    isSaving: saveStatus === 'saving',
    isSaved: saveStatus === 'saved',
    hasError: saveStatus === 'error',
  };
}
