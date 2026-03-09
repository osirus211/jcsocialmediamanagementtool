import { useState, useEffect } from 'react';
import { X, Loader2, Repeat2 } from 'lucide-react';
import { evergreenService, CreateRuleInput, UpdateRuleInput, EvergreenRule } from '@/services/evergreen.service';
import { logger } from '@/lib/logger';

interface EvergreenRuleModalProps {
  postId: string;
  existingRule?: EvergreenRule;
  onClose: () => void;
  onSuccess: () => void;
}

export function EvergreenRuleModal({ postId, existingRule, onClose, onSuccess }: EvergreenRuleModalProps) {
  const [repostInterval, setRepostInterval] = useState(existingRule?.repostInterval || 7);
  const [maxReposts, setMaxReposts] = useState(existingRule?.maxReposts || -1);
  const [isUnlimited, setIsUnlimited] = useState((existingRule?.maxReposts || -1) === -1);
  const [enabled, setEnabled] = useState(existingRule?.enabled ?? true);
  const [prefix, setPrefix] = useState(existingRule?.contentModification?.prefix || '');
  const [suffix, setSuffix] = useState(existingRule?.contentModification?.suffix || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isUnlimited) {
      setMaxReposts(-1);
    }
  }, [isUnlimited]);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const contentModification = prefix || suffix ? { prefix, suffix } : undefined;

      if (existingRule) {
        const updates: UpdateRuleInput = {
          repostInterval,
          maxReposts: isUnlimited ? -1 : maxReposts,
          enabled,
          contentModification,
        };
        await evergreenService.updateRule(existingRule._id, updates);
        logger.info('Evergreen rule updated', { ruleId: existingRule._id });
      } else {
        const input: CreateRuleInput = {
          postId,
          repostInterval,
          maxReposts: isUnlimited ? -1 : maxReposts,
          enabled,
          contentModification,
        };
        await evergreenService.createRule(input);
        logger.info('Evergreen rule created', { postId });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save evergreen rule';
      logger.error('Failed to save evergreen rule', { error: errorMessage });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Repeat2 className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {existingRule ? 'Edit Evergreen Rule' : 'Make Post Evergreen'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Repost Interval */}
          <div>
            <label htmlFor="repostInterval" className="block text-sm font-medium text-gray-700 mb-2">
              Repost every
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                id="repostInterval"
                min="1"
                max="365"
                value={repostInterval}
                onChange={(e) => setRepostInterval(parseInt(e.target.value) || 1)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-600">days</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">Between 1 and 365 days</p>
          </div>

          {/* Max Reposts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="maxReposts" className="block text-sm font-medium text-gray-700">
                Maximum reposts
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUnlimited}
                  onChange={(e) => setIsUnlimited(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Unlimited</span>
              </label>
            </div>
            {!isUnlimited && (
              <input
                type="number"
                id="maxReposts"
                min="1"
                max="100"
                value={maxReposts}
                onChange={(e) => setMaxReposts(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
            <p className="mt-1 text-sm text-gray-500">
              {isUnlimited ? 'Post will repeat indefinitely' : 'Between 1 and 100 reposts'}
            </p>
          </div>

          {/* Content Modification */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Content Modification (Optional)</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="prefix" className="block text-sm font-medium text-gray-700 mb-2">
                  Add text before post
                </label>
                <input
                  type="text"
                  id="prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="e.g., 🔄 Repost:"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="suffix" className="block text-sm font-medium text-gray-700 mb-2">
                  Add text after post
                </label>
                <input
                  type="text"
                  id="suffix"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder="e.g., #ThrowbackThursday"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable rule</p>
              <p className="text-sm text-gray-500">Rule will start scheduling reposts immediately</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{existingRule ? 'Update Rule' : 'Create Rule'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
