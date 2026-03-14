import { useState, memo, useEffect } from 'react';
import { X, Eye, AlertCircle, Check } from 'lucide-react';
import { MediaFile } from '@/types/composer.types';
import { SocialPlatform } from '@/types/composer.types';

interface AltTextModalProps {
  isOpen: boolean;
  media: MediaFile;
  selectedPlatforms: SocialPlatform[];
  onSave: (altTexts: Record<SocialPlatform, string>) => void;
  onClose: () => void;
}

const ALT_TEXT_LIMITS: Record<SocialPlatform, number> = {
  twitter: 1000,
  linkedin: 300,
  instagram: 100,
  facebook: 255,
  threads: 100,
  bluesky: 300,
  youtube: 5000,
  'google-business': 1000,
  pinterest: 500,
};

const AltTextModal = memo(function AltTextModal({
  isOpen,
  media,
  selectedPlatforms,
  onSave,
  onClose,
}: AltTextModalProps) {
  const [altTexts, setAltTexts] = useState<Record<SocialPlatform, string>>(() => {
    const initial: Record<SocialPlatform, string> = {} as Record<SocialPlatform, string>;
    return initial;
  });
  const [useGlobalAltText, setUseGlobalAltText] = useState(true);
  const [globalAltText, setGlobalAltText] = useState('');

  // Initialize alt texts from media metadata
  useEffect(() => {
    if (media.metadata?.altText) {
      setGlobalAltText(media.metadata.altText);
    }
    if (media.metadata?.platformAltTexts) {
      setAltTexts(media.metadata.platformAltTexts);
    }
  }, [media]);

  const handleSave = () => {
    const finalAltTexts = {} as Record<SocialPlatform, string>;
    
    if (useGlobalAltText) {
      selectedPlatforms.forEach(platform => {
        finalAltTexts[platform] = globalAltText;
      });
    } else {
      selectedPlatforms.forEach(platform => {
        finalAltTexts[platform] = altTexts[platform] || '';
      });
    }
    
    onSave(finalAltTexts);
    onClose();
  };

  const getCharacterLimit = (platform: SocialPlatform) => {
    return ALT_TEXT_LIMITS[platform] || 1000;
  };

  const isOverLimit = (text: string, platform: SocialPlatform) => {
    return text.length > getCharacterLimit(platform);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Add Alt Text</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Image Preview */}
          <div className="flex items-start gap-4">
            <img
              src={media.thumbnailUrl || media.url}
              alt="Preview"
              className="w-24 h-24 object-cover rounded-lg border"
            />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{media.filename}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Alt text helps screen readers describe images to visually impaired users.
              </p>
            </div>
          </div>

          {/* Global vs Platform-specific toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="global-alt"
                checked={useGlobalAltText}
                onChange={() => setUseGlobalAltText(true)}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="global-alt" className="text-sm font-medium text-gray-700">
                Use same alt text for all platforms
              </label>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="platform-alt"
                checked={!useGlobalAltText}
                onChange={() => setUseGlobalAltText(false)}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="platform-alt" className="text-sm font-medium text-gray-700">
                Customize alt text per platform
              </label>
            </div>
          </div>

          {/* Global Alt Text */}
          {useGlobalAltText && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Alt Text
              </label>
              <textarea
                value={globalAltText}
                onChange={(e) => setGlobalAltText(e.target.value)}
                placeholder="Describe what's in this image..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="text-sm text-gray-500">
                {globalAltText.length} characters
              </div>
            </div>
          )}

          {/* Platform-specific Alt Text */}
          {!useGlobalAltText && (
            <div className="space-y-4">
              {selectedPlatforms.map(platform => {
                const text = altTexts[platform] || '';
                const limit = getCharacterLimit(platform);
                const overLimit = isOverLimit(text, platform);
                
                return (
                  <div key={platform} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {platform.charAt(0).toUpperCase() + platform.slice(1)} Alt Text
                      <span className="text-xs text-gray-500 ml-2">
                        (max {limit} characters)
                      </span>
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setAltTexts(prev => ({
                        ...prev,
                        [platform]: e.target.value
                      }))}
                      placeholder={`Describe this image for ${platform}...`}
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                        overLimit ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <div className={`text-sm ${overLimit ? 'text-red-600' : 'text-gray-500'}`}>
                      {text.length} / {limit} characters
                      {overLimit && (
                        <span className="ml-2">
                          ({text.length - limit} over limit)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tips */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Alt Text Tips:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Be specific and descriptive</li>
              <li>• Include important text that appears in the image</li>
              <li>• Don't start with "Image of..." or "Picture of..."</li>
              <li>• Focus on what's relevant to your post's context</li>
              <li>• Keep it concise but informative</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <AlertCircle className="h-4 w-4" />
            <span>Alt text improves accessibility and SEO</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Save Alt Text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export { AltTextModal };