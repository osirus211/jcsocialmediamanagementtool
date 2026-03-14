import { useState, memo } from 'react';
import { Link2, X, Plus } from 'lucide-react';

interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

interface UTMBuilderProps {
  url: string;
  onApply: (url: string, utmParams: UTMParams) => void;
  onClose: () => void;
}

const UTMBuilder = memo(function UTMBuilder({
  url,
  onApply,
  onClose,
}: UTMBuilderProps) {
  const [utmParams, setUtmParams] = useState<UTMParams>({
    source: '',
    medium: '',
    campaign: '',
    term: '',
    content: '',
  });

  const handleParamChange = (key: keyof UTMParams, value: string) => {
    setUtmParams(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const generatePreviewUrl = () => {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      Object.entries(utmParams).forEach(([key, value]) => {
        if (value?.trim()) {
          params.set(`utm_${key}`, value.trim());
        }
      });
      
      urlObj.search = params.toString();
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  const handleApply = () => {
    const filteredParams = Object.fromEntries(
      Object.entries(utmParams).filter(([_, value]) => value?.trim())
    );
    onApply(generatePreviewUrl(), filteredParams);
  };

  const presets = [
    { name: 'Social Media', source: 'social', medium: 'social' },
    { name: 'Email Newsletter', source: 'newsletter', medium: 'email' },
    { name: 'Blog Post', source: 'blog', medium: 'referral' },
    { name: 'Paid Ad', source: 'google', medium: 'cpc' },
  ];

  const applyPreset = (preset: { source: string; medium: string }) => {
    setUtmParams(prev => ({
      ...prev,
      source: preset.source,
      medium: preset.medium,
    }));
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-gray-900">UTM Builder</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quick Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* UTM Parameters */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source * <span className="text-gray-500">(utm_source)</span>
          </label>
          <input
            type="text"
            value={utmParams.source || ''}
            onChange={(e) => handleParamChange('source', e.target.value)}
            placeholder="e.g., google, facebook, newsletter"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Medium * <span className="text-gray-500">(utm_medium)</span>
          </label>
          <input
            type="text"
            value={utmParams.medium || ''}
            onChange={(e) => handleParamChange('medium', e.target.value)}
            placeholder="e.g., cpc, social, email, referral"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Campaign <span className="text-gray-500">(utm_campaign)</span>
          </label>
          <input
            type="text"
            value={utmParams.campaign || ''}
            onChange={(e) => handleParamChange('campaign', e.target.value)}
            placeholder="e.g., spring_sale, product_launch"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Term <span className="text-gray-500">(utm_term)</span>
            </label>
            <input
              type="text"
              value={utmParams.term || ''}
              onChange={(e) => handleParamChange('term', e.target.value)}
              placeholder="e.g., running shoes"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-gray-500">(utm_content)</span>
            </label>
            <input
              type="text"
              value={utmParams.content || ''}
              onChange={(e) => handleParamChange('content', e.target.value)}
              placeholder="e.g., logolink, textlink"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preview URL
        </label>
        <div className="p-3 bg-gray-50 rounded-md border">
          <code className="text-sm text-gray-800 break-all">
            {generatePreviewUrl()}
          </code>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!utmParams.source?.trim() || !utmParams.medium?.trim()}
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Apply UTM Parameters
        </button>
      </div>
    </div>
  );
});

export { UTMBuilder, type UTMParams };