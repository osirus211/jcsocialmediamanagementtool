import { create } from 'zustand';
import {
  PublishMode,
  SaveStatus,
  MediaFile,
  QueueSlot,
  SocialPlatform,
} from '@/types/composer.types';
import { logger } from '@/lib/logger';

/**
 * Composer Store State
 * Manages draft creation, editing, and publishing workflow
 */
interface ComposerState {
  // Draft metadata
  draftId: string | null;
  isNewDraft: boolean;
  
  // Content
  mainContent: string;
  platformContent: Record<SocialPlatform, string>;
  
  // Media
  media: MediaFile[];
  
  // Accounts
  selectedAccounts: string[];
  
  // Publish settings
  publishMode: PublishMode;
  scheduledDate?: Date;
  selectedQueueSlot?: QueueSlot;
  
  // UI state
  activePlatformTab: SocialPlatform | null;
  activePreviewTab: SocialPlatform | null;
  
  // Auto-save state
  saveStatus: SaveStatus;
  lastSaved?: Date;
  saveError?: string;
  hasUnsavedChanges: boolean;
  
  // Content type (post/story/reel)
  contentType: 'post' | 'story' | 'reel';
  reelOptions: {
    shareToFeed: boolean;
  };
  
  // Content organization
  categoryId?: string;
  campaignId?: string;
  tags: string[];
  
  // First comment (Instagram/Facebook)
  firstComment?: string;
  enableFirstComment?: boolean;
  
  // Per-platform customization
  enablePlatformCustomization: boolean;
  platformSettings: Record<SocialPlatform, any>;
}

/**
 * Composer Store Actions
 */
interface ComposerActions {
  // Content setters
  setContent: (platform: SocialPlatform | 'main', content: string) => void;
  setSelectedAccounts: (accountIds: string[]) => void;
  setPublishMode: (mode: PublishMode) => void;
  setScheduledDate: (date: Date | undefined) => void;
  setQueueSlot: (slot: QueueSlot | undefined) => void;
  setContentType: (type: 'post' | 'story' | 'reel') => void;
  setReelShareToFeed: (shareToFeed: boolean) => void;
  
  // Content organization
  setCategory: (categoryId: string | undefined) => void;
  setCampaign: (campaignId: string | undefined) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  clearTags: () => void;
  
  // First comment
  setFirstComment: (comment: string) => void;
  setEnableFirstComment: (enabled: boolean) => void;
  
  // Per-platform customization
  setEnablePlatformCustomization: (enabled: boolean) => void;
  copyFromBaseContent: (platform: SocialPlatform) => void;
  resetPlatformContent: (platform: SocialPlatform) => void;
  setPlatformSettings: (platform: SocialPlatform, settings: any) => void;
  
  // Media management
  addMedia: (files: File[]) => Promise<void>;
  removeMedia: (mediaId: string) => void;
  updateMedia: (mediaId: string, updates: Partial<MediaFile>) => void;
  replaceMedia: (oldMediaId: string, newMedia: MediaFile) => void;
  updateMediaProgress: (mediaId: string, progress: number) => void;
  updateMediaStatus: (mediaId: string, status: MediaFile['uploadStatus'], errorMessage?: string) => void;
  
  // UI state
  setActivePlatformTab: (platform: SocialPlatform | null) => void;
  setActivePreviewTab: (platform: SocialPlatform | null) => void;
  
  // Save state
  setSaveStatus: (status: SaveStatus) => void;
  setSaveError: (error: string | undefined) => void;
  setLastSaved: (date: Date | undefined) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // Draft management
  setDraftId: (draftId: string | null) => void;
  setIsNewDraft: (isNew: boolean) => void;
  saveDraft: () => Promise<void>;
  
  // Reset
  reset: () => void;
  
  // Templates
  applyTemplate: (templateId: string) => Promise<void>;
}

type ComposerStore = ComposerState & ComposerActions;

/**
 * Initial state
 */
const initialState: ComposerState = {
  draftId: null,
  isNewDraft: true,
  mainContent: '',
  platformContent: {} as Record<SocialPlatform, string>,
  media: [],
  selectedAccounts: [],
  publishMode: PublishMode.NOW,
  scheduledDate: undefined,
  selectedQueueSlot: undefined,
  activePlatformTab: null,
  activePreviewTab: null,
  saveStatus: 'idle',
  lastSaved: undefined,
  saveError: undefined,
  hasUnsavedChanges: false,
  contentType: 'post',
  reelOptions: {
    shareToFeed: true,
  },
  categoryId: undefined,
  campaignId: undefined,
  tags: [],
  firstComment: '',
  enableFirstComment: false,
  enablePlatformCustomization: false,
  platformSettings: {} as Record<SocialPlatform, any>,
};

/**
 * Composer Store
 * 
 * Design principles:
 * - Minimal re-renders: Use granular selectors
 * - Session persistence: draftId persisted to sessionStorage
 * - Safe state updates: Immutable updates
 * - Error resilience: Graceful error handling
 * 
 * Auto-save is handled by a separate hook (useAutoSave)
 * to keep store logic clean and testable
 */
export const useComposerStore = create<ComposerStore>((set, get) => ({
  ...initialState,

  // ============================================
  // CONTENT SETTERS
  // ============================================

  setContent: (platform, content) => {
    if (platform === 'main') {
      set({ mainContent: content, hasUnsavedChanges: true });
    } else {
      set((state) => ({
        platformContent: {
          ...state.platformContent,
          [platform]: content,
        },
        hasUnsavedChanges: true,
      }));
    }
  },

  setSelectedAccounts: (accountIds) => {
    const state = get();
    
    // Check if Instagram was deselected
    const hadInstagram = state.selectedAccounts.some((id) => {
      // This is a simplified check - in real implementation, you'd check account platform
      return true; // Placeholder
    });
    
    // Reset contentType to 'post' if Instagram is not in new selection
    // and current contentType is story or reel
    const updates: Partial<ComposerState> = {
      selectedAccounts: accountIds,
      hasUnsavedChanges: true,
    };
    
    // If contentType is story or reel, reset to post when no accounts selected
    if ((state.contentType === 'story' || state.contentType === 'reel') && accountIds.length === 0) {
      updates.contentType = 'post';
    }
    
    set(updates);
  },

  setPublishMode: (mode) => {
    set({ publishMode: mode, hasUnsavedChanges: true });
  },

  setScheduledDate: (date) => {
    set({ scheduledDate: date, hasUnsavedChanges: true });
  },

  setQueueSlot: (slot) => {
    set({ selectedQueueSlot: slot, hasUnsavedChanges: true });
  },

  setContentType: (type) => {
    set({ contentType: type, hasUnsavedChanges: true });
  },

  setReelShareToFeed: (shareToFeed) => {
    set((state) => ({
      reelOptions: { ...state.reelOptions, shareToFeed },
      hasUnsavedChanges: true,
    }));
  },

  // Content organization methods
  setCategory: (categoryId) => {
    set({ categoryId, hasUnsavedChanges: true });
  },

  setCampaign: (campaignId) => {
    set({ campaignId, hasUnsavedChanges: true });
  },

  addTag: (tag) => {
    set((state) => {
      if (state.tags.includes(tag) || state.tags.length >= 10) return state;
      return {
        tags: [...state.tags, tag],
        hasUnsavedChanges: true,
      };
    });
  },

  removeTag: (tag) => {
    set((state) => ({
      tags: state.tags.filter(t => t !== tag),
      hasUnsavedChanges: true,
    }));
  },

  clearTags: () => {
    set({ tags: [], hasUnsavedChanges: true });
  },

  // First comment methods
  setFirstComment: (comment) => {
    set({ firstComment: comment, hasUnsavedChanges: true });
  },

  setEnableFirstComment: (enabled) => {
    set({ enableFirstComment: enabled, hasUnsavedChanges: true });
  },

  // ============================================
  // PER-PLATFORM CUSTOMIZATION
  // ============================================

  setEnablePlatformCustomization: (enabled) => {
    const state = get();
    
    if (enabled && state.mainContent.trim()) {
      // When enabling, pre-fill each platform with base content
      const newPlatformContent = { ...state.platformContent };
      
      // Get selected platforms from selected accounts
      // This will be populated when accounts are selected
      const selectedPlatforms: SocialPlatform[] = [];
      
      selectedPlatforms.forEach(platform => {
        if (!newPlatformContent[platform]) {
          newPlatformContent[platform] = state.mainContent;
        }
      });
      
      set({ 
        enablePlatformCustomization: enabled, 
        platformContent: newPlatformContent,
        hasUnsavedChanges: true 
      });
    } else {
      set({ enablePlatformCustomization: enabled, hasUnsavedChanges: true });
    }
  },

  copyFromBaseContent: (platform) => {
    const state = get();
    set((state) => ({
      platformContent: {
        ...state.platformContent,
        [platform]: state.mainContent,
      },
      hasUnsavedChanges: true,
    }));
  },

  resetPlatformContent: (platform) => {
    set((state) => ({
      platformContent: {
        ...state.platformContent,
        [platform]: '',
      },
      hasUnsavedChanges: true,
    }));
  },

  setPlatformSettings: (platform, settings) => {
    set((state) => ({
      platformSettings: {
        ...state.platformSettings,
        [platform]: settings,
      },
      hasUnsavedChanges: true,
    }));
  },

  // ============================================
  // MEDIA MANAGEMENT
  // ============================================

  addMedia: async (files) => {
    const { FILE_VALIDATION } = await import('@/types/composer.types');
    const { composerService } = await import('@/services/composer.service');

    // Validate and upload each file
    for (const file of files) {
      const fileId = `temp-${Date.now()}-${Math.random()}`;
      
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        logger.error(`Invalid file type: ${file.type}`);
        continue;
      }

      const validation = isImage ? FILE_VALIDATION.image : FILE_VALIDATION.video;
      
      // Validate file type against allowed types
      if (!validation.types.includes(file.type)) {
        set((state) => ({
          media: [
            ...state.media,
            {
              id: fileId,
              url: '',
              type: isImage ? 'image' : 'video',
              size: file.size,
              filename: file.name,
              mimeType: file.type,
              uploadStatus: 'error',
              errorMessage: `File type ${file.type} is not supported`,
            },
          ],
        }));
        continue;
      }

      // Validate file size
      if (file.size > validation.maxSize) {
        const maxSizeMB = validation.maxSize / (1024 * 1024);
        set((state) => ({
          media: [
            ...state.media,
            {
              id: fileId,
              url: '',
              type: isImage ? 'image' : 'video',
              size: file.size,
              filename: file.name,
              mimeType: file.type,
              uploadStatus: 'error',
              errorMessage: `File size exceeds ${maxSizeMB}MB limit`,
            },
          ],
        }));
        continue;
      }

      // Create temporary media item
      const tempMedia: MediaFile = {
        id: fileId,
        url: URL.createObjectURL(file),
        type: isImage ? 'image' : 'video',
        size: file.size,
        filename: file.name,
        mimeType: file.type,
        uploadProgress: 0,
        uploadStatus: 'uploading',
      };

      set((state) => ({
        media: [...state.media, tempMedia],
        hasUnsavedChanges: true,
      }));

      // Upload file
      try {
        const uploadedMedia = await composerService.uploadMedia(
          file,
          (progress) => {
            get().updateMediaProgress(fileId, progress);
          }
        );

        // Update media with uploaded data
        set((state) => ({
          media: state.media.map((m) =>
            m.id === fileId
              ? {
                  ...m,
                  id: uploadedMedia._id,
                  url: uploadedMedia.url,
                  thumbnailUrl: uploadedMedia.thumbnailUrl,
                  uploadProgress: 100,
                  uploadStatus: 'completed',
                }
              : m
          ),
        }));
      } catch (error: any) {
        logger.error('Failed to upload media:', { error: error.message });
        
        set((state) => ({
          media: state.media.map((m) =>
            m.id === fileId
              ? {
                  ...m,
                  uploadStatus: 'error',
                  errorMessage: error.message || 'Upload failed',
                }
              : m
          ),
        }));
      }
    }
  },

  removeMedia: (mediaId) => {
    set((state) => ({
      media: state.media.filter((m) => m.id !== mediaId),
      hasUnsavedChanges: true,
    }));
  },

  updateMedia: (mediaId, updates) => {
    set((state) => ({
      media: state.media.map((m) =>
        m.id === mediaId ? { ...m, ...updates } : m
      ),
      hasUnsavedChanges: true,
    }));
  },

  replaceMedia: (oldMediaId, newMedia) => {
    set((state) => ({
      media: state.media.map((m) =>
        m.id === oldMediaId ? newMedia : m
      ),
      hasUnsavedChanges: true,
    }));
  },

  updateMediaProgress: (mediaId, progress) => {
    set((state) => ({
      media: state.media.map((m) =>
        m.id === mediaId ? { ...m, uploadProgress: progress } : m
      ),
    }));
  },

  updateMediaStatus: (mediaId, status, errorMessage) => {
    set((state) => ({
      media: state.media.map((m) =>
        m.id === mediaId
          ? { ...m, uploadStatus: status, errorMessage }
          : m
      ),
    }));
  },

  // ============================================
  // UI STATE
  // ============================================

  setActivePlatformTab: (platform) => {
    set({ activePlatformTab: platform });
  },

  setActivePreviewTab: (platform) => {
    set({ activePreviewTab: platform });
  },

  // ============================================
  // SAVE STATE
  // ============================================

  setSaveStatus: (status) => {
    set({ saveStatus: status });
  },

  setSaveError: (error) => {
    set({ saveError: error });
  },

  setLastSaved: (date) => {
    set({ lastSaved: date });
  },

  setHasUnsavedChanges: (hasChanges) => {
    set({ hasUnsavedChanges: hasChanges });
  },

  // ============================================
  // DRAFT MANAGEMENT
  // ============================================

  setDraftId: (draftId) => {
    set({ draftId });
    
    // Persist to sessionStorage
    if (draftId) {
      sessionStorage.setItem('composer_draft_id', draftId);
    } else {
      sessionStorage.removeItem('composer_draft_id');
    }
  },

  setIsNewDraft: (isNew) => {
    set({ isNewDraft: isNew });
  },

  // ============================================
  // AUTO-SAVE
  // ============================================

  saveDraft: async () => {
    const state = get();
    
    // Don't save if already saving
    if (state.saveStatus === 'saving') {
      return;
    }

    // Track retry attempts
    const retryAttempts = (state as any).retryAttempts || 0;
    const maxRetries = 3;

    try {
      set({ saveStatus: 'saving', saveError: undefined });

      // Import service dynamically to avoid circular dependencies
      const { composerService } = await import('@/services/composer.service');

      // Prepare draft data
      const platformContent = Object.entries(state.platformContent)
        .filter(([_, text]) => text.trim().length > 0)
        .map(([platform, text]) => ({
          platform: platform as SocialPlatform,
          text,
          enabled: true,
        }));

      const draftData = {
        content: state.mainContent,
        socialAccountIds: state.selectedAccounts,
        mediaIds: state.media
          .filter((m) => m.uploadStatus === 'completed')
          .map((m) => m.id),
        platformContent: platformContent.length > 0 ? platformContent : undefined,
        platformSettings: Object.keys(state.platformSettings).length > 0 ? state.platformSettings : undefined,
        categoryId: state.categoryId,
        campaignId: state.campaignId,
        tags: state.tags,
      };

      let savedDraft;

      if (state.draftId && !state.isNewDraft) {
        // Update existing draft
        savedDraft = await composerService.updateDraft(state.draftId, draftData);
      } else {
        // Create new draft
        savedDraft = await composerService.createDraft(draftData);
        set({ draftId: savedDraft._id, isNewDraft: false });
        
        // Persist to sessionStorage
        sessionStorage.setItem('composer_draft_id', savedDraft._id);
      }

      // Mark as saved and reset retry counter
      set({
        saveStatus: 'saved',
        lastSaved: new Date(),
        hasUnsavedChanges: false,
        saveError: undefined,
        retryAttempts: 0,
      } as any);

      // Auto-transition to idle after 3 seconds
      setTimeout(() => {
        if (get().saveStatus === 'saved') {
          set({ saveStatus: 'idle' });
        }
      }, 3000);

    } catch (error: any) {
      logger.error('Failed to save draft:', { error: error.message });
      
      const isNetworkError = !navigator.onLine || error.message?.includes('network') || error.message?.includes('fetch');
      const errorMessage = isNetworkError 
        ? 'Network error. Changes will be saved when connection is restored.'
        : error.message || 'Failed to save draft';
      
      set({
        saveStatus: 'error',
        saveError: errorMessage,
        retryAttempts: retryAttempts + 1,
      } as any);

      // Retry with exponential backoff if under max retries
      if (retryAttempts < maxRetries) {
        const retryDelay = Math.min(5000 * Math.pow(2, retryAttempts), 30000); // Max 30 seconds
        
        setTimeout(() => {
          const currentState = get();
          if (currentState.saveStatus === 'error' && currentState.hasUnsavedChanges) {
            logger.debug(`Retrying auto-save (attempt ${retryAttempts + 1}/${maxRetries})...`);
            currentState.saveDraft();
          }
        }, retryDelay);
      } else {
        // Max retries reached
        logger.error('Max auto-save retries reached. Manual save required.');
      }
    }
  },

  // ============================================
  // RESET
  // ============================================

  reset: () => {
    // Clear sessionStorage
    sessionStorage.removeItem('composer_draft_id');
    
    // Reset to initial state
    set(initialState);
  },

  // ============================================
  // TEMPLATES
  // ============================================

  applyTemplate: async (templateId: string) => {
    try {
      const { templateService } = await import('@/services/template.service');
      
      // Apply template (increments usage count)
      const template = await templateService.applyTemplate(templateId);
      
      // Load template content into composer
      set({
        mainContent: template.content,
        hasUnsavedChanges: true,
      });
      
      logger.info('Template applied', { templateId, name: template.name });
    } catch (error: any) {
      logger.error('Failed to apply template:', { error: error.message });
      throw error;
    }
  },
}));

/**
 * Restore draft ID from sessionStorage on app load
 */
export const restoreComposerSession = () => {
  const draftId = sessionStorage.getItem('composer_draft_id');
  if (draftId) {
    useComposerStore.getState().setDraftId(draftId);
  }
};
