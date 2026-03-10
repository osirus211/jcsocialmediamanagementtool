import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiService, LongformToSocialOutput } from '@/services/ai.service';
import { SocialPlatform, PLATFORM_LIMITS } from '@/types/composer.types';
import { 
  Copy, 
  Check, 
  Loader2, 
  ExternalLink, 
  AlertCircle,
  RefreshCw,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  Hash
} from 'lucide-react';

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  threads: Hash,
  bluesky: Hash,
  'google-business': Hash,
  pinterest: Hash,
};

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  threads: 'Threads',
  bluesky: 'Bluesky',
  'google-business': 'Google Business',
  pinterest: 'Pinterest',
};

const ALL_PLATFORMS = [
  'twitter',
  'linkedin',
  'facebook', 
  'instagram',
  'youtube',
  'threads',
  'bluesky',
  'google-business',
  'pinterest'
];

export function LongformRepurposer() {
  const navigate = useNavigate();
  const [longFormContent, setLongFormContent] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('');
  const [focusPoints, setFocusPoints] = useState('');
  const [preserveLinks, setPreserveLinks] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LongformToSocialOutput | null>(null);
  const [copiedContent, setCopiedContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  const handleConvert = async () => {
    if (!longFormContent.trim()) {
      setError('Please enter some long-form content to convert');
      return;
    }

    if (!targetPlatform) {
      setError('Please select a target platform');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const convertResult = await aiService.longformToSocial({
        longFormContent: longFormContent.trim(),
        targetPlatform,
        focusPoints: focusPoints.trim() || undefined,
        preserveLinks,
        includeHashtags,
      });

      setResult(convertResult);
      setEditedContent(convertResult.content);

    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to convert content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedContent);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = editedContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  const handleOpenInComposer = () => {
    const params = new URLSearchParams({
      platform: targetPlatform,
      content: editedContent,
      source: 'longform-repurpose'
    });
    navigate(`/posts/create?${params.toString()}`);
  };

  const handleTryAnother = () => {
    setTargetPlatform('');
    setResult(null);
    setEditedContent('');
    setError(null);
  };

  const getCharacterLimit = (platform: string): number => {
    return PLATFORM_LIMITS[platform as SocialPlatform] || 500;
  };

  const getCharacterColor = (count: number, limit: number): string => {
    const percentage = count / limit;
    if (percentage > 1) return 'text-red-600';
    if (percentage > 0.9) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const characterLimit = targetPlatform ? getCharacterLimit(targetPlatform) : 0;
  const characterCount = editedContent.length;

  return (
    <div className="space-y-6">
      {/* Long-form Content Input */}
      <div>
        <label htmlFor="longform-content" className="block text-sm font-medium text-gray-700 mb-2">
          Long-form Content
        </label>
        <textarea
          id="longform-content"
          value={longFormContent}
          onChange={(e) => setLongFormContent(e.target.value)}
          placeholder="Paste your blog post, article, or long-form content here..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={8}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-500">
            Paste content from blogs, articles, newsletters, or any long-form text
          </p>
          <span className="text-xs text-gray-500">
            {longFormContent.length} characters
          </span>
        </div>
      </div>

      {/* Target Platform Selection */}
      <div>
        <label htmlFor="target-platform" className="block text-sm font-medium text-gray-700 mb-2">
          Target Platform
        </label>
        <select
          id="target-platform"
          value={targetPlatform}
          onChange={(e) => setTargetPlatform(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a platform...</option>
          {ALL_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {PLATFORM_NAMES[platform]}
            </option>
          ))}
        </select>
      </div>

      {/* Focus Points */}
      <div>
        <label htmlFor="focus-points" className="block text-sm font-medium text-gray-700 mb-2">
          Focus Points (Optional)
        </label>
        <input
          id="focus-points"
          type="text"
          value={focusPoints}
          onChange={(e) => setFocusPoints(e.target.value)}
          placeholder="What should we emphasize? e.g., key benefits, call-to-action, main takeaway"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Specify what aspects of the content to highlight in the social post
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Options</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preserveLinks}
              onChange={(e) => setPreserveLinks(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Preserve links</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeHashtags}
              onChange={(e) => setIncludeHashtags(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Include hashtags</span>
          </label>
        </div>
      </div>

      {/* Convert Button */}
      <button
        onClick={handleConvert}
        disabled={isLoading || !longFormContent.trim() || !targetPlatform}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Converting to Social Post...
          </>
        ) : (
          <>
            Convert to Social Post
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && targetPlatform && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Generated Social Post
            </h3>
            <button
              onClick={handleTryAnother}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded hover:bg-blue-50"
            >
              <RefreshCw className="h-3 w-3" />
              Try Another Platform
            </button>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4">
            {/* Platform Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = PLATFORM_ICONS[targetPlatform] || Hash;
                  return <Icon className="h-5 w-5 text-gray-600" />;
                })()}
                <h4 className="font-medium text-gray-900">
                  {PLATFORM_NAMES[targetPlatform]}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${getCharacterColor(characterCount, characterLimit)}`}>
                  {characterCount}/{characterLimit}
                </span>
              </div>
            </div>

            {/* Content Editor */}
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
              placeholder="Generated content will appear here..."
            />

            {/* Character limit warning */}
            {characterCount > characterLimit && (
              <p className="text-xs text-red-600 mt-1">
                Content exceeds {PLATFORM_NAMES[targetPlatform]} character limit by {characterCount - characterLimit} characters
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
              >
                {copiedContent ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleOpenInComposer}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Composer
              </button>
            </div>
          </div>

          {/* Usage Info */}
          <div className="text-xs text-gray-500 text-center">
            Used {result.tokensUsed} tokens • Powered by {result.provider}
          </div>
        </div>
      )}
    </div>
  );
}