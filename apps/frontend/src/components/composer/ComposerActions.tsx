import { PublishMode } from '@/types/composer.types';
import { Save, Send, X, Loader2, FileText, Link } from 'lucide-react';

interface ComposerActionsProps {
  onSave: () => void;
  onPublish: () => void;
  onCancel: () => void;
  onTemplates?: () => void;
  publishMode: PublishMode;
  isLoading: boolean;
  isSaving: boolean;
  canPublish: boolean;
  hasUnsavedChanges: boolean;
  autoShortenLinks?: boolean;
  onToggleAutoShorten?: () => void;
  urlCount?: number;
}

export function ComposerActions({
  onSave,
  onPublish,
  onCancel,
  onTemplates,
  publishMode,
  isLoading,
  isSaving,
  canPublish,
  hasUnsavedChanges,
  autoShortenLinks = false,
  onToggleAutoShorten,
  urlCount = 0,
}: ComposerActionsProps) {
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  const getPublishButtonText = () => {
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
  };

  const getPublishAriaLabel = () => {
    const baseText = getPublishButtonText();
    if (!canPublish) {
      return `${baseText} (disabled: ${hasUnsavedChanges ? 'save draft first' : 'complete required fields'})`;
    }
    return baseText;
  };

  return (
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
          aria-label={getPublishAriaLabel()}
          aria-disabled={!canPublish}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{getPublishButtonText()}</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>{getPublishButtonText()}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
