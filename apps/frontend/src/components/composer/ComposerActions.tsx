import { memo, useCallback, useMemo, useState } from 'react';
import { PublishMode } from '@/types/composer.types';
import { Save, Send, X, Loader2, FileText, Link, Calendar, List } from 'lucide-react';
import { AIToggleButton } from './AIToggleButton';
import { BulkComposer, BulkPost } from './BulkComposer';

interface ComposerActionsProps {
  onSave: () => void;
  onPublish: () => void;
  onCancel: () => void;
  onTemplates?: () => void;
  onToggleAI?: () => void;
  onBulkComposer?: () => void;
  publishMode: PublishMode;
  isLoading: boolean;
  isSaving: boolean;
  canPublish: boolean;
  hasUnsavedChanges: boolean;
  autoShortenLinks?: boolean;
  onToggleAutoShorten?: () => void;
  urlCount?: number;
  showAIPanel?: boolean;
}

const ComposerActions = memo(function ComposerActions({
  onSave,
  onPublish,
  onCancel,
  onTemplates,
  onToggleAI,
  onBulkComposer,
  publishMode,
  isLoading,
  isSaving,
  canPublish,
  hasUnsavedChanges,
  autoShortenLinks = false,
  onToggleAutoShorten,
  urlCount = 0,
  showAIPanel = false,
}: ComposerActionsProps) {
  const [showBulkComposer, setShowBulkComposer] = useState(false);
  
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    onCancel();
  }, [hasUnsavedChanges, onCancel]);

  const handleBulkSchedule = useCallback(async (posts: BulkPost[]) => {
    // In real app, this would call the bulk scheduling API
    console.log('Scheduling bulk posts:', posts);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Show success message
    alert(`Successfully scheduled ${posts.length} posts!`);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  const publishButtonText = useMemo(() => {
    if (isLoading) return 'Publishing...';
    
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
  }, [isLoading, publishMode]);

  const publishAriaLabel = useMemo(() => {
    if (!canPublish) {
      return `${publishButtonText} (disabled: ${hasUnsavedChanges ? 'save draft first' : 'complete required fields'})`;
    }
    return publishButtonText;
  }, [publishButtonText, canPublish, hasUnsavedChanges]);

  return (
    <>
    <div 
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 border-t bg-white sticky bottom-0 z-10"
      role="toolbar"
      aria-label="Post actions"
    >
      <button
        type="button"
        onClick={handleCancel}
        disabled={isLoading || isSaving}
        className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
        aria-label="Cancel and discard changes"
      >
        <X className="h-4 w-4" />
        <span className="sm:inline">Cancel</span>
      </button>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {onToggleAutoShorten && (
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <input
              type="checkbox"
              id="auto-shorten"
              checked={autoShortenLinks}
              onChange={onToggleAutoShorten}
              disabled={isLoading || isSaving}
              className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="auto-shorten" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <Link className="h-4 w-4" />
              <span>Auto-shorten links</span>
              {autoShortenLinks && urlCount > 0 && (
                <span className="text-xs text-blue-600 font-medium">
                  ({urlCount} {urlCount === 1 ? 'link' : 'links'})
                </span>
              )}
            </label>
          </div>
        )}

        {onTemplates && (
          <button
            type="button"
            onClick={onTemplates}
            disabled={isLoading || isSaving}
            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
            aria-label="Open templates"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>Templates</span>
          </button>
        )}

        {onToggleAI && (
          <AIToggleButton
            onClick={onToggleAI}
            isActive={showAIPanel}
            disabled={isLoading || isSaving}
          />
        )}

        <button
          type="button"
          onClick={() => setShowBulkComposer(true)}
          disabled={isLoading || isSaving}
          className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
          aria-label="Open bulk composer"
        >
          <List className="h-4 w-4" aria-hidden="true" />
          <span>Bulk</span>
        </button>
        
        <button
          type="button"
          onClick={onSave}
          disabled={isLoading || isSaving || !hasUnsavedChanges}
          className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
          aria-label={hasUnsavedChanges ? 'Save draft' : 'No changes to save'}
          aria-disabled={!hasUnsavedChanges}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save Draft</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onPublish}
          disabled={isLoading || isSaving || !canPublish}
          className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium min-h-[44px]"
          aria-label={publishAriaLabel}
          aria-disabled={!canPublish}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{publishButtonText}</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>{publishButtonText}</span>
            </>
          )}
        </button>
      </div>
    </div>

    {/* Bulk Composer Modal */}
    <BulkComposer
      isOpen={showBulkComposer}
      onClose={() => setShowBulkComposer(false)}
      onScheduleAll={handleBulkSchedule}
    />
    </>
  );
});

export { ComposerActions };
