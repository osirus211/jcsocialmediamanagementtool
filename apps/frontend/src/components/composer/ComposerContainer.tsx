import { useEffect, useState, useCallback, useRef } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { useSocialAccountStore } from '@/store/social.store';
import { composerService } from '@/services/composer.service';
import { SocialPlatform, PublishMode, PLATFORM_LIMITS } from '@/types/composer.types';
import { StatusBar } from './StatusBar';
import { AccountSelector } from '../posts/AccountSelector';
import { ContentSection } from './ContentSection';
import { MediaUploadSection } from './MediaUploadSection';
import { PublishModeSelector } from './PublishModeSelector';
import { ComposerActions } from './ComposerActions';
import { AlertBanner } from './AlertBanner';
import { ToastContainer, ToastMessage } from './ToastContainer';
import { TemplatesPanel } from './TemplatesPanel';
import { PostPreviewPanel } from './preview/PostPreviewPanel';

interface ComposerContainerProps {
  draftId?: string;
  onSuccess?: (postId: string) => void;
  onCancel?: () => void;
}

export function ComposerContainer({
  draftId,
  onSuccess,
  onCancel,
}: ComposerContainerProps) {
  const {
    mainContent,
    platformContent,
    selectedAccounts,
    media,
    publishMode,
    scheduledDate,
    selectedQueueSlot,
    saveStatus,
    lastSaved,
    saveError,
    hasUnsavedChanges,
    setContent,
    setSelectedAccounts,
    setPublishMode,
    setScheduledDate,
    setQueueSlot,
    addMedia,
    removeMedia,
    saveDraft,
    setDraftId,
    setIsNewDraft,
    reset,
  } = useComposerStore();

  const { accounts } = useSocialAccountStore();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isRetryingPublish, setIsRetryingPublish] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [autoShortenLinks, setAutoShortenLinks] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get unique platforms from selected accounts
  const selectedPlatforms = Array.from(
    new Set(
      accounts
        .filter((acc) => selectedAccounts.includes(acc._id))
        .map((acc) => acc.platform.toLowerCase() as SocialPlatform)
    )
  );

  // Detect URLs in content
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urlsInContent = mainContent.match(urlRegex) || [];
  const urlCount = urlsInContent.length;

  // Toast management
  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load draft on mount if draftId provided
  useEffect(() => {
    if (draftId) {
      loadDraft(draftId);
    }

    return () => {
      // Cleanup on unmount
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [draftId]);

  // Network recovery detection
  useEffect(() => {
    const handleOnline = () => {
      addToast('success', 'Connection restored. Saving changes...');
      if (hasUnsavedChanges) {
        saveDraft();
      }
    };

    const handleOffline = () => {
      addToast('warning', 'Connection lost. Changes will be saved when connection is restored.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [hasUnsavedChanges, saveDraft, addToast]);

  // Auto-save with debounce
  useEffect(() => {
    if (hasUnsavedChanges && mainContent.trim()) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer for 3 seconds
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, 3000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, mainContent, platformContent, selectedAccounts, media]);

  const loadDraft = async (id: string) => {
    try {
      const draft = await composerService.getDraft(id);
      
      // Populate store with draft data
      setDraftId(draft._id);
      setIsNewDraft(false);
      setContent('main', draft.content || '');
      setSelectedAccounts(draft.socialAccountIds || []);
      
      // Load platform content
      if (draft.platformContent) {
        draft.platformContent.forEach((pc: any) => {
          setContent(pc.platform as SocialPlatform, pc.text);
        });
      }
      
      // Note: Media loading would need to be implemented based on backend response
    } catch (error: any) {
      console.error('Failed to load draft:', error);
      alert('Failed to load draft: ' + (error.message || 'Unknown error'));
    }
  };

  const fetchQueueSlots = useCallback(async () => {
    setIsLoadingSlots(true);
    try {
      const response = await composerService.getQueueSlots();
      setAvailableSlots(response.slots || []);
      
      // Auto-select default slot if in queue mode
      if (publishMode === PublishMode.QUEUE && response.nextAvailable) {
        setQueueSlot(response.nextAvailable);
      }
    } catch (error: any) {
      console.error('Failed to fetch queue slots:', error);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [publishMode, setQueueSlot]);

  const validatePublish = (): string[] => {
    const errors: string[] = [];

    // Check accounts selected
    if (selectedAccounts.length === 0) {
      errors.push('Please select at least one account');
    }

    // Check content exists
    if (!mainContent.trim() && Object.values(platformContent).every((c) => !c?.trim())) {
      errors.push('Please enter post content');
    }

    // Check character limits
    for (const platform of selectedPlatforms) {
      const content = platformContent[platform] || mainContent;
      const limit = PLATFORM_LIMITS[platform];
      
      if (content.length > limit) {
        errors.push(`${platform} content exceeds ${limit} character limit`);
      }
    }

    // Check scheduled date
    if (publishMode === PublishMode.SCHEDULE) {
      if (!scheduledDate) {
        errors.push('Please select a scheduled date and time');
      } else if (scheduledDate <= new Date()) {
        errors.push('Scheduled date must be in the future');
      }
    }

    // Check queue slot
    if (publishMode === PublishMode.QUEUE && !selectedQueueSlot) {
      errors.push('Please select a queue slot');
    }

    return errors;
  };

  const handlePublish = async () => {
    // Validate
    const errors = validatePublish();
    if (errors.length > 0) {
      setPublishError(errors.join(', '));
      return;
    }

    setIsPublishing(true);
    setPublishError(null);

    try {
      // Auto-shorten links if enabled
      let contentToPublish = mainContent;
      if (autoShortenLinks && urlsInContent.length > 0) {
        const { linkService } = await import('@/services/link.service');
        
        // Shorten each URL
        for (const url of urlsInContent) {
          try {
            const shortLink = await linkService.shortenUrl(url);
            contentToPublish = contentToPublish.replace(url, shortLink.shortUrl);
          } catch (error: any) {
            console.error(`Failed to shorten URL ${url}:`, error);
            // Continue with original URL if shortening fails
          }
        }
        
        // Update content with shortened URLs
        setContent('main', contentToPublish);
      }

      // Save draft first if there are unsaved changes
      if (hasUnsavedChanges) {
        await saveDraft();
      }

      // Get the draft ID from store
      const currentDraftId = useComposerStore.getState().draftId;
      
      if (!currentDraftId) {
        throw new Error('No draft ID available');
      }

      // Prepare publish request
      const publishRequest: any = {
        publishMode,
      };

      if (publishMode === PublishMode.SCHEDULE && scheduledDate) {
        publishRequest.scheduledAt = scheduledDate.toISOString();
      } else if (publishMode === PublishMode.QUEUE && selectedQueueSlot) {
        publishRequest.queueSlot = selectedQueueSlot.slotId;
      }

      // Publish
      const publishedPost = await composerService.publishPost(currentDraftId, publishRequest);

      // Success
      addToast('success', 'Post published successfully!');
      reset();
      
      if (onSuccess) {
        onSuccess(publishedPost._id);
      }
    } catch (error: any) {
      console.error('Failed to publish post:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to publish post';
      setPublishError(errorMessage);
      addToast('error', 'Failed to publish post. Please try again.');
    } finally {
      setIsPublishing(false);
      setIsRetryingPublish(false);
    }
  };

  const handleRetryPublish = async () => {
    setIsRetryingPublish(true);
    await handlePublish();
  };

  const handleCancel = () => {
    reset();
    if (onCancel) {
      onCancel();
    }
  };

  const canPublish = 
    selectedAccounts.length > 0 &&
    (mainContent.trim().length > 0 || Object.values(platformContent).some((c) => c?.trim())) &&
    !hasUnsavedChanges &&
    !isPublishing;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {showTemplates && <TemplatesPanel onClose={() => setShowTemplates(false)} />}
      
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main Composer */}
        <div className="flex-1 bg-white rounded-lg shadow-lg" role="main" aria-label="Post composer">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Post</h1>
              <StatusBar
                saveStatus={saveStatus}
                lastSaved={lastSaved}
                errorMessage={saveError}
              />
            </div>
          </div>

          {/* Mobile Preview Toggle */}
          <div className="lg:hidden border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setShowPreview(false)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  !showPreview
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Write
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  showPreview
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className={`p-4 sm:p-6 space-y-4 sm:space-y-6 ${showPreview ? 'hidden lg:block' : ''}`}>
            {/* Account Selection */}
            <section aria-labelledby="account-selection-label">
              <h2 id="account-selection-label" className="sr-only">Select social media accounts</h2>
              <AccountSelector
                value={selectedAccounts}
                onChange={setSelectedAccounts}
                multiSelect
              />
            </section>

            {/* Content Section */}
            <section aria-labelledby="content-section-label">
              <h2 id="content-section-label" className="sr-only">Post content</h2>
              <ContentSection
                platforms={selectedPlatforms}
                mainContent={mainContent}
                platformContent={platformContent}
                onContentChange={setContent}
              />
            </section>

            {/* Media Upload */}
            <section aria-labelledby="media-section-label">
              <h2 id="media-section-label" className="sr-only">Media attachments</h2>
              <MediaUploadSection
                media={media}
                onUpload={addMedia}
                onRemove={removeMedia}
              />
            </section>

            {/* Publish Mode */}
            <section aria-labelledby="publish-mode-label">
              <h2 id="publish-mode-label" className="sr-only">Publishing options</h2>
              <PublishModeSelector
                mode={publishMode}
                onChange={setPublishMode}
                scheduledDate={scheduledDate}
                onScheduledDateChange={setScheduledDate}
                selectedSlot={selectedQueueSlot}
                onSlotChange={setQueueSlot}
                availableSlots={availableSlots}
                onFetchSlots={fetchQueueSlots}
                isLoadingSlots={isLoadingSlots}
              />
            </section>

            {/* Error Display */}
            {publishError && (
              <AlertBanner
                message={publishError}
                onRetry={handleRetryPublish}
                onDismiss={() => setPublishError(null)}
                isRetrying={isRetryingPublish}
              />
            )}
          </div>

          {/* Actions */}
          <ComposerActions
            onSave={saveDraft}
            onPublish={handlePublish}
            onCancel={handleCancel}
            onTemplates={() => setShowTemplates(true)}
            publishMode={publishMode}
            isLoading={isPublishing}
            isSaving={saveStatus === 'saving'}
            canPublish={canPublish}
            hasUnsavedChanges={hasUnsavedChanges}
            autoShortenLinks={autoShortenLinks}
            onToggleAutoShorten={() => setAutoShortenLinks(!autoShortenLinks)}
            urlCount={urlCount}
          />
        </div>

        {/* Preview Panel - Desktop: side by side, Mobile: toggled */}
        <div className={`${showPreview ? 'block' : 'hidden'} lg:block lg:w-[375px]`}>
          <div className="bg-white rounded-lg shadow-lg h-full">
            <PostPreviewPanel />
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
