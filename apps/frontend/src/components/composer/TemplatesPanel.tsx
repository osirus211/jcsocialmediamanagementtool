/**
 * Templates Panel
 * Phase 2: Post Templates UI
 */

import { useState, useEffect } from 'react';
import { templateService, PostTemplate } from '@/services/template.service';
import { useComposerStore } from '@/store/composer.store';
import { logger } from '@/lib/logger';
import { Save, Trash2, FileText, Loader2, X } from 'lucide-react';

interface TemplatesPanelProps {
  onClose: () => void;
}

export function TemplatesPanel({ onClose }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { mainContent, applyTemplate } = useComposerStore();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await templateService.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      logger.error('Failed to load templates:', { error: err.message });
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    if (!mainContent.trim()) {
      setError('Cannot save empty template');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await templateService.createTemplate({
        name: templateName.trim(),
        content: mainContent,
      });

      setTemplateName('');
      setShowSaveDialog(false);
      await loadTemplates();
    } catch (err: any) {
      logger.error('Failed to save template:', { error: err.message });
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      await applyTemplate(templateId);
      onClose();
    } catch (err: any) {
      logger.error('Failed to apply template:', { error: err.message });
      setError('Failed to apply template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await templateService.deleteTemplate(templateId);
      setDeleteConfirm(null);
      await loadTemplates();
    } catch (err: any) {
      logger.error('Failed to delete template:', { error: err.message });
      setError('Failed to delete template');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Post Templates</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close templates panel"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Save Template Button */}
          {!showSaveDialog && (
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!mainContent.trim()}
              className="w-full mb-4 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-gray-700"
            >
              <Save className="h-5 w-5" />
              <span>Save Current as Template</span>
            </button>
          )}

          {/* Save Dialog */}
          {showSaveDialog && (
            <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Weekly Newsletter"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !templateName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setTemplateName('');
                    setError(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && templates.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No templates yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Save your first template to reuse content
              </p>
            </div>
          )}

          {/* Templates List */}
          {!isLoading && templates.length > 0 && (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => handleApplyTemplate(template.id)}
                      className="flex-1 text-left"
                    >
                      <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{template.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>Used {template.usageCount} times</span>
                        {template.lastUsedAt && (
                          <span>Last used {new Date(template.lastUsedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>

                    {/* Delete Button */}
                    {deleteConfirm === template.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(template.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        aria-label={`Delete template ${template.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
