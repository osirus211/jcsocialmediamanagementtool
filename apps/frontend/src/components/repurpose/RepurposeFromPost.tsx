import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiService, RepurposingOutput, PlatformVersion } from '@/services/ai.service';
import { SocialPlatform, PLATFORM_LIMITS } from '@/types/composer.types';
import { 
  Copy, 
  Check, 
  Loader2, 
  ExternalLink, 
  AlertCircle,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  Hash
} from 'lucide-react';

interface RepurposeFromPostProps {
  postId: string;
  content: string;
  originalPlatform: string;
}

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

export function RepurposeFromPost({ postId, content, originalPlatform }: RepurposeFromPostProps) {
  const navigate = useNavigate();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [preserveHashtags, setPreserveHashtags] = useState(true);
  const [preserveMentions, setPreserveMentions] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RepurposingOutput | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleRepurpose = async () => {
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one target platform');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const result = await aiService.repurposeContent({
        originalContent: content,
        targetPlatforms: selectedPlatforms,
        originalPlatform,
        preserveHashtags,
        preserveMentions,
      });

      setResults(result);
      
      // Initialize edited content with original results
      const initialEdited: Record<string, string> = {};
      result.platformVersions.forEach(version => {
        initialEdited[version.platform] = version.content;
      });
      setEditedContent(initialEdited);

    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to repurpose content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (content: string, platform: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(platform);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(platform);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleOpenInComposer = (platform: string, content: string) => {
    const params = new URLSearchParams({
      platform,
      content,
      source: 'repurpose'
    });
    navigate(`/posts/create?${params.toString()}`);
  };

  const handleContentEdit = (platform: string, newContent: string) => {
    setEditedContent(prev => ({
      ...prev,
      [platform]: newContent
    }));
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

  const truncateContent = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      {/* Original Content Preview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Original Content</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
            {PLATFORM_NAMES[originalPlatform] || originalPlatform}
          </span>
        </div>
        <p className="text-sm text-gray-900 whitespace-pre-wrap">
          {truncateContent(content)}
        </p>
        {content.length > 200 && (
          <p className="text-xs text-gray-500 mt-1">
            {content.length} characters (truncated for preview)
          </p>
        )}
      </div>

      {/* Target Platforms Selection */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Select Target Platforms
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ALL_PLATFORMS.filter(p => p !== originalPlatform).map((platform) => {
            const Icon = PLATFORM_ICONS[platform] || Hash;
            const isSelected = selectedPlatforms.includes(platform);
            
            return (
              <button
                key={platform}
                onClick={() => handlePlatformToggle(platform)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {PLATFORM_NAMES[platform]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Options</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preserveHashtags}
              onChange={(e) => setPreserveHashtags(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Preserve hashtags</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preserveMentions}
              onChange={(e) => setPreserveMentions(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Preserve @mentions</span>
          </label>
        </div>
      </div>

      {/* Repurpose Button */}
      <button
        onClick={handleRepurpose}
        disabled={isLoading || selectedPlatforms.length === 0}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Repurposing for {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''}...
          </>
        ) : (
          <>
            Repurpose Content
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

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Repurposed Content ({results.platformVersions.length} platforms)
          </h3>
          
          <div className="space-y-4">
            {results.platformVersions.map((version) => {
              const Icon = PLATFORM_ICONS[version.platform] || Hash;
              const currentContent = editedContent[version.platform] || version.content;
              const characterLimit = getCharacterLimit(version.platform);
              const characterCount = currentContent.length;
              
              return (
                <div key={version.platform} className="border border-gray-200 rounded-lg p-4">
                  {/* Platform Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <h4 className="font-medium text-gray-900">
                        {PLATFORM_NAMES[version.platform]}
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
                    value={currentContent}
                    onChange={(e) => handleContentEdit(version.platform, e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                    placeholder="Repurposed content will appear here..."
                  />

                  {/* Character limit warning */}
                  {characterCount > characterLimit && (
                    <p className="text-xs text-red-600 mt-1">
                      Content exceeds {PLATFORM_NAMES[version.platform]} character limit by {characterCount - characterLimit} characters
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleCopy(currentContent, version.platform)}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      {copiedId === version.platform ? (
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
                      onClick={() => handleOpenInComposer(version.platform, currentContent)}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Composer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Usage Info */}
          <div className="text-xs text-gray-500 text-center">
            Used {results.tokensUsed} tokens • Powered by {results.provider}
          </div>
        </div>
      )}
    </div>
  );
}