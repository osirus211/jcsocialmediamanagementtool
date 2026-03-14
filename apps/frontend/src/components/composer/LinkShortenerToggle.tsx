import { memo } from 'react';
import { Link2, Check } from 'lucide-react';

interface LinkShortenerToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  customDomain?: string;
  onCustomDomainChange?: (domain: string) => void;
}

const LinkShortenerToggle = memo(function LinkShortenerToggle({
  enabled,
  onToggle,
  customDomain,
  onCustomDomainChange,
}: LinkShortenerToggleProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900">URL Shortening</span>
        </div>
        <button
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Check className="h-3 w-3 text-green-500" />
            <span>URLs will be automatically shortened</span>
          </div>

          {onCustomDomainChange && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Custom Domain (optional)
              </label>
              <input
                type="text"
                value={customDomain || ''}
                onChange={(e) => onCustomDomainChange(e.target.value)}
                placeholder="e.g., yourbrand.com"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to use default short domain
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export { LinkShortenerToggle };