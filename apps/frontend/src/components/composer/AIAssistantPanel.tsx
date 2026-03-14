import { useState, useEffect, memo, useCallback } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { aiService, ContentTone, CaptionGenerationOutput, CaptionScoreOutput, EngagementPredictionOutput } from '@/services/ai.service';
import { SocialPlatform } from '@/types/composer.types';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  RefreshCw, 
  Wand2, 
  Hash, 
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import EnhancedHashtagPanel from './EnhancedHashtagPanel';

interface AIAssistantPanelProps {
  selectedPlatforms: SocialPlatform[];
  mainContent: string;
}

type TabType = 'generate' | 'improve' | 'hashtags' | 'insights';

interface CaptionVariant extends CaptionGenerationOutput {
  id: string;
  score?: CaptionScoreOutput;
  isLoadingScore?: boolean;
}

const AIAssistantPanel = memo(function AIAssistantPanel({ selectedPlatforms, mainContent }: AIAssistantPanelProps) {
  const { setContent } = useComposerStore();
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generate tab state
  const [topic, setTopic] = useState('');
  const [selectedTone, setSelectedTone] = useState<ContentTone>(ContentTone.CASUAL);
  const [keywords, setKeywords] = useState('');
  const [captionVariants, setCaptionVariants] = useState<CaptionVariant[]>([]);

  // Improve tab state
  const [improveInstruction, setImproveInstruction] = useState('');
  const [improvedContent, setImprovedContent] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);

  // Insights tab state
  const [engagementPrediction, setEngagementPrediction] = useState<EngagementPredictionOutput | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const primaryPlatform = selectedPlatforms[0] || 'twitter';

  // Reset error when tab changes
  useEffect(() => {
    setError(null);
  }, [activeTab]);

  const handleGenerateCaption = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic or brief description');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCaptionVariants([]);

    try {
      // Generate 3 caption variants
      const promises = Array.from({ length: 3 }, (_, i) =>
        aiService.generateCaption({
          topic: topic.trim(),
          platform: primaryPlatform,
          tone: selectedTone,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        }).then(result => ({
          ...result,
          id: `variant-${i + 1}`,
        }))
      );

      const variants = await Promise.all(promises);
      setCaptionVariants(variants);

      // Score each caption
      variants.forEach(async (variant) => {
        try {
          setCaptionVariants(prev => prev.map(v => 
            v.id === variant.id ? { ...v, isLoadingScore: true } : v
          ));

          const score = await aiService.scoreCaption({
            caption: variant.caption,
            platform: primaryPlatform,
          });

          setCaptionVariants(prev => prev.map(v => 
            v.id === variant.id ? { ...v, score, isLoadingScore: false } : v
          ));
        } catch (error) {
          setCaptionVariants(prev => prev.map(v => 
            v.id === variant.id ? { ...v, isLoadingScore: false } : v
          ));
        }
      });

    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to generate captions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImproveContent = async () => {
    if (!mainContent.trim()) {
      setError('No content to improve. Please write something first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOriginalContent(mainContent);

    try {
      const result = await aiService.improveContent({
        content: mainContent,
        platform: primaryPlatform,
      });

      setImprovedContent(result.rewrittenContent);
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to improve content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRewriteContent = async () => {
    if (!mainContent.trim()) {
      setError('No content to rewrite. Please write something first.');
      return;
    }

    if (!improveInstruction.trim()) {
      setError('Please provide rewrite instructions');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOriginalContent(mainContent);

    try {
      const result = await aiService.rewriteContent({
        content: mainContent,
        platform: primaryPlatform,
        instruction: improveInstruction,
      });

      setImprovedContent(result.rewrittenContent);
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to rewrite content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateHashtags = async () => {
    // This function is now handled by EnhancedHashtagPanel
    // Keeping for backward compatibility if needed
  };

  const handlePredictEngagement = async () => {
    if (!mainContent.trim()) {
      setError('No content available. Please write something first.');
      return;
    }

    setIsLoadingInsights(true);
    setError(null);

    try {
      const result = await aiService.predictEngagement({
        platform: primaryPlatform,
        caption: mainContent,
        hasMedia: false, // TODO: Check if media is attached
      });

      setEngagementPrediction(result);
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to predict engagement');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleCopyCaption = async (caption: string, id: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = caption;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleUseCaption = (caption: string) => {
    setContent('main', caption);
  };

  const handleApplyImprovement = () => {
    if (improvedContent) {
      setContent('main', improvedContent);
      setImprovedContent(null);
      setOriginalContent(null);
    }
  };

  const handleDiscardImprovement = () => {
    setImprovedContent(null);
    setOriginalContent(null);
  };

  const handleToggleHashtag = (hashtag: string) => {
    // This function is now handled by EnhancedHashtagPanel
    // Keeping for backward compatibility if needed
  };

  const handleAddHashtags = (hashtags: string[]) => {
    const hashtagsText = hashtags.join(' ');
    const newContent = mainContent.trim() + (mainContent.trim() ? '\n\n' : '') + hashtagsText;
    setContent('main', newContent);
  };

  const handleReplaceHashtags = (hashtags: string[]) => {
    // Remove existing hashtags from content and add new ones
    const contentWithoutHashtags = mainContent.replace(/#\w+/g, '').trim();
    const hashtagsText = hashtags.join(' ');
    const newContent = contentWithoutHashtags + (contentWithoutHashtags ? '\n\n' : '') + hashtagsText;
    setContent('main', newContent);
  };

  // Extract current hashtags from content
  const getCurrentHashtags = (): string[] => {
    const hashtagRegex = /#\w+/g;
    return mainContent.match(hashtagRegex) || [];
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-100';
    if (score >= 40) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {[
            { id: 'generate', label: 'Generate', icon: Sparkles },
            { id: 'improve', label: 'Improve', icon: Wand2 },
            { id: 'hashtags', label: 'Hashtags', icon: Hash },
            { id: 'insights', label: 'Insights', icon: TrendingUp },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === id
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                What do you want to post about?
              </label>
              <textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Launching our new product, sharing a team milestone, industry insights..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-2">
                Tone
              </label>
              <select
                id="tone"
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value as ContentTone)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={ContentTone.PROFESSIONAL}>Professional</option>
                <option value={ContentTone.CASUAL}>Casual</option>
                <option value={ContentTone.FRIENDLY}>Friendly</option>
                <option value={ContentTone.HUMOROUS}>Humorous</option>
                <option value={ContentTone.INSPIRATIONAL}>Inspirational</option>
                <option value={ContentTone.MARKETING}>Marketing</option>
                <option value={ContentTone.VIRAL}>Viral</option>
              </select>
            </div>

            <div>
              <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-2">
                Keywords (optional)
              </label>
              <input
                id="keywords"
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g., innovation, teamwork, growth"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Separate with commas</p>
            </div>

            <button
              onClick={handleGenerateCaption}
              disabled={isLoading || !topic.trim()}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Captions
                </>
              )}
            </button>

            {/* Caption Variants */}
            {captionVariants.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Generated Captions</h3>
                {captionVariants.map((variant) => (
                  <div key={variant.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm text-gray-900 flex-1">{variant.caption}</p>
                      {variant.score && (
                        <div className={`px-2 py-1 rounded text-xs font-medium ${getScoreBgColor(variant.score.score)} ${getScoreColor(variant.score.score)}`}>
                          {variant.score.score}/100
                        </div>
                      )}
                      {variant.isLoadingScore && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyCaption(variant.caption, variant.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        {copiedId === variant.id ? (
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
                        onClick={() => handleUseCaption(variant.caption)}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Use This
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Improve Tab */}
        {activeTab === 'improve' && (
          <div className="space-y-4">
            {mainContent.trim() ? (
              <div>
                <p className="text-sm text-gray-600 mb-3">Current content:</p>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900 max-h-32 overflow-y-auto">
                  {mainContent}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">No content to improve. Write something in the composer first.</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleImproveContent}
                disabled={isLoading || !mainContent.trim()}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Improving...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Improve Writing
                  </>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <div>
                <label htmlFor="rewrite-instruction" className="block text-sm font-medium text-gray-700 mb-2">
                  Custom rewrite instruction
                </label>
                <input
                  id="rewrite-instruction"
                  type="text"
                  value={improveInstruction}
                  onChange={(e) => setImproveInstruction(e.target.value)}
                  placeholder="e.g., Make it more professional, Add a call-to-action, Make it shorter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleRewriteContent}
                disabled={isLoading || !mainContent.trim() || !improveInstruction.trim()}
                className="w-full px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rewriting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Rewrite
                  </>
                )}
              </button>
            </div>

            {/* Improved Content */}
            {improvedContent && originalContent && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Improved Version</h3>
                
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600 mb-1">Original:</p>
                    <p className="text-sm text-gray-500 line-through">{originalContent}</p>
                  </div>
                  
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">Improved:</p>
                    <p className="text-sm text-gray-900">{improvedContent}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleApplyImprovement}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleDiscardImprovement}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hashtags Tab */}
        {activeTab === 'hashtags' && (
          <EnhancedHashtagPanel
            selectedPlatform={primaryPlatform}
            currentHashtags={getCurrentHashtags()}
            onHashtagsAdd={handleAddHashtags}
            onHashtagsReplace={handleReplaceHashtags}
            content={mainContent}
          />
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            <button
              onClick={handlePredictEngagement}
              disabled={isLoadingInsights || !mainContent.trim()}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoadingInsights ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  Predict Engagement
                </>
              )}
            </button>

            {!mainContent.trim() && (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">Write some content first to get engagement insights.</p>
              </div>
            )}

            {/* Engagement Prediction */}
            {engagementPrediction && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${getScoreBgColor(engagementPrediction.score)} ${getScoreColor(engagementPrediction.score)}`}>
                    {engagementPrediction.score}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Engagement Score</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Breakdown</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Timing</span>
                      <span className={getScoreColor(engagementPrediction.breakdown.timing)}>
                        {engagementPrediction.breakdown.timing}/100
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Content</span>
                      <span className={getScoreColor(engagementPrediction.breakdown.content)}>
                        {engagementPrediction.breakdown.content}/100
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Hashtags</span>
                      <span className={getScoreColor(engagementPrediction.breakdown.hashtags)}>
                        {engagementPrediction.breakdown.hashtags}/100
                      </span>
                    </div>
                  </div>
                </div>

                {engagementPrediction.tips.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Tips to Improve</h4>
                    <ul className="space-y-1">
                      {engagementPrediction.tips.map((tip, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-purple-600 mt-1">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export { AIAssistantPanel };