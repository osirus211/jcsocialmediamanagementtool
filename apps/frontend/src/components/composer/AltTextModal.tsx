import { useState, memo, useEffect } from 'react';
import { X, Eye, AlertCircle, Check, Wand2, RefreshCw, Lightbulb } from 'lucide-react';
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
  tiktok: 150,
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{
    id: number;
    text: string;
    style: string;
    score?: number;
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const generateAltText = async (style: 'descriptive' | 'seo' | 'concise' = 'descriptive') => {
    if (!media.url) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/v1/alttext/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: media.url,
          platform: selectedPlatforms[0] || 'general',
          style,
          maxLength: useGlobalAltText 
            ? 1000 
            : getCharacterLimit(selectedPlatforms[0] as SocialPlatform),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate alt text');
      }

      const data = await response.json();
      
      if (useGlobalAltText) {
        setGlobalAltText(data.data.altText);
      } else {
        setAltTexts(prev => ({
          ...prev,
          [selectedPlatforms[0]]: data.data.altText,
        }));
      }
    } catch (error) {
      console.error('Failed to generate alt text:', error);
      // You might want to show a toast notification here
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSuggestions = async () => {
    if (!media.url) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/v1/alttext/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: media.url,
          platform: selectedPlatforms[0] || 'general',
          maxLength: useGlobalAltText 
            ? 1000 
            : getCharacterLimit(selectedPlatforms[0] as SocialPlatform),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate suggestions');
      }

      const data = await response.json();
      setSuggestions(data.data.suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const validateAltText = async (text: string, platform?: SocialPlatform) => {
    if (!text.trim()) return null;

    try {
      const response = await fetch('/api/v1/alttext/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          platform,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate alt text');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to validate alt text:', error);
      return null;
    }
  };

  const applySuggestion = (suggestion: { text: string }) => {
    if (useGlobalAltText) {
      setGlobalAltText(suggestion.text);
    } else {
      setAltTexts(prev => ({
        ...prev,
        [selectedPlatforms[0]]: suggestion.text,
      }));
    }
    setShowSuggestions(false);
  };

  const getQualityIndicator = (text: string) => {
    if (!text.trim()) return { level: 'poor', color: 'text-red-600', label: 'Missing' };
    
    if (text.length < 10) return { level: 'poor', color: 'text-red-600', label: 'Too short' };
    if (text.length > 125) return { level: 'good', color: 'text-yellow-600', label: 'Long' };
    if (text.toLowerCase().startsWith('image of') || text.toLowerCase().startsWith('photo of')) {
      return { level: 'poor', color: 'text-red-600', label: 'Poor quality' };
    }
    
    return { level: 'excellent', color: 'text-green-600', label: 'Good quality' };
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Alt Text
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generateAltText('descriptive')}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    AI Generate
                  </button>
                  <button
                    type="button"
                    onClick={generateSuggestions}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Lightbulb className="h-3 w-3" />
                    Suggestions
                  </button>
                </div>
              </div>
              
              <textarea
                value={globalAltText}
                onChange={(e) => setGlobalAltText(e.target.value)}
                placeholder="Describe what's in this image..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">
                    {globalAltText.length} characters
                  </span>
                  <span className={`font-medium ${getQualityIndicator(globalAltText).color}`}>
                    {getQualityIndicator(globalAltText).label}
                  </span>
                </div>
                
                {/* Platform support indicators */}
                <div className="flex items-center gap-1">
                  {selectedPlatforms.map(platform => (
                    <span
                      key={platform}
                      className={`px-2 py-1 text-xs rounded ${
                        globalAltText.length <= getCharacterLimit(platform)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {platform}
                    </span>
                  ))}
                </div>
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

          {/* AI Suggestions Panel */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-900">AI Suggestions</h4>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-2 bg-white rounded border border-blue-200 cursor-pointer hover:bg-blue-50"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-900 flex-1">{suggestion.text}</p>
                      <span className="text-xs text-blue-600 font-medium ml-2 capitalize">
                        {suggestion.style}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {suggestion.text.length} characters
                      </span>
                      <span className={`text-xs font-medium ${getQualityIndicator(suggestion.text).color}`}>
                        {getQualityIndicator(suggestion.text).label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Alt Text Best Practices (WCAG 2.1):</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Be specific and descriptive</li>
              <li>• Include important text that appears in the image</li>
              <li>• Don't start with "Image of..." or "Picture of..."</li>
              <li>• Focus on what's relevant to your post's context</li>
              <li>• Keep it concise but informative (10-125 characters ideal)</li>
              <li>• Include emotions or actions if relevant to the content</li>
            </ul>
            
            {/* Platform Support Matrix */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <h5 className="text-xs font-medium text-blue-900 mb-2">Platform Support:</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-blue-800">Instagram: Full support</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-blue-800">Twitter/X: Full support</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-blue-800">LinkedIn: Full support</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-blue-800">Facebook: Full support</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-blue-800">Pinterest: Full support</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span className="text-blue-800">TikTok: Limited</span>
                </div>
              </div>
            </div>
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