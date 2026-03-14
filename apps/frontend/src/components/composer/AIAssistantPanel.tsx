import { useState, useEffect, memo, useCallback } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { aiService, ContentTone, CaptionGenerationOutput, CaptionScoreOutput, EngagementPredictionOutput, ContentLength } from '@/services/ai.service';
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
  ChevronUp,
  Image,
  FileText,
  Mic,
  Smile,
  Target,
  Save
} from 'lucide-react';
import EnhancedHashtagPanel from './EnhancedHashtagPanel';

interface AIAssistantPanelProps {
  selectedPlatforms: SocialPlatform[];
  mainContent: string;
}

type TabType = 'generate' | 'improve' | 'hashtags' | 'insights' | 'image' | 'templates' | 'brand-voice';

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
  const [selectedLength, setSelectedLength] = useState<ContentLength>(ContentLength.MEDIUM);
  const [keywords, setKeywords] = useState('');
  const [captionVariants, setCaptionVariants] = useState<CaptionVariant[]>([]);
  const [showCTAOptions, setShowCTAOptions] = useState(false);
  const [showEmojiSuggestions, setShowEmojiSuggestions] = useState(false);
  const [ctas, setCTAs] = useState<string[]>([]);
  const [emojis, setEmojis] = useState<any[]>([]);

  // Image caption state
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCaptions, setImageCaptions] = useState<CaptionVariant[]>([]);

  // Templates state
  const [selectedIndustry, setSelectedIndustry] = useState('technology');
  const [selectedContentType, setSelectedContentType] = useState<'product' | 'service' | 'announcement' | 'educational' | 'promotional'>('product');
  const [templates, setTemplates] = useState<any[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);

  // Brand voice state
  const [brandVoiceProfile, setBrandVoiceProfile] = useState<any>(null);
  const [isAnalyzingBrandVoice, setIsAnalyzingBrandVoice] = useState(false);

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

  const handleGenerateImageCaption = async () => {
    if (!imageUrl && !imageFile) {
      setError('Please provide an image URL or upload an image');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImageCaptions([]);

    try {
      let finalImageUrl = imageUrl;
      
      // If file is uploaded, we'd need to upload it first
      // For now, assuming imageUrl is provided
      if (!finalImageUrl) {
        setError('Image upload not implemented yet. Please provide an image URL.');
        return;
      }

      // Generate 3 image caption variants
      const promises = Array.from({ length: 3 }, (_, i) =>
        aiService.generateImageCaption({
          imageUrl: finalImageUrl,
          platform: primaryPlatform,
          tone: selectedTone,
          length: selectedLength,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        }).then(result => ({
          ...result,
          id: `image-variant-${i + 1}`,
        }))
      );

      const variants = await Promise.all(promises);
      setImageCaptions(variants);

    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to generate image captions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTemplates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await aiService.generateTemplates({
        industry: selectedIndustry,
        platform: primaryPlatform,
        contentType: selectedContentType,
        tone: selectedTone,
      });

      setTemplates(result.templates);
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to generate templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeBrandVoice = async () => {
    // This would analyze recent posts to create a brand voice profile
    setIsAnalyzingBrandVoice(true);
    setError(null);

    try {
      // Get recent posts from the workspace (mock for now)
      const sampleContent = [
        mainContent, // Current content
        // Would fetch more from API
      ].filter(Boolean);

      if (sampleContent.length === 0) {
        setError('No content available for brand voice analysis');
        return;
      }

      const result = await aiService.analyzeBrandVoice({
        sampleContent,
        industry: selectedIndustry,
      });

      setBrandVoiceProfile(result.voiceProfile);
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to analyze brand voice');
    } finally {
      setIsAnalyzingBrandVoice(false);
    }
  };

  const handleSaveAsTemplate = (caption: string) => {
    const template = {
      id: Date.now().toString(),
      name: `Template ${savedTemplates.length + 1}`,
      content: caption,
      platform: primaryPlatform,
      tone: selectedTone,
      createdAt: new Date(),
    };
    
    setSavedTemplates(prev => [...prev, template]);
    // Would save to backend in real implementation
  };

  const handleGenerateCTAs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await aiService.generateCTAs({
        platform: primaryPlatform,
        tone: selectedTone,
        objective: 'engagement',
        context: topic,
      });

      setCTAs(result.ctas);
      setShowCTAOptions(true);
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to generate CTAs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestEmojis = async () => {
    if (!mainContent.trim()) {
      setError('Write some content first to get emoji suggestions');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await aiService.suggestEmojis({
        content: mainContent,
        platform: primaryPlatform,
        tone: selectedTone,
        maxEmojis: 8,
      });

      setEmojis(result.emojis);
      setShowEmojiSuggestions(true);
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to suggest emojis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertCTA = (cta: string) => {
    const newContent = mainContent.trim() + (mainContent.trim() ? '\n\n' : '') + cta;
    setContent('main', newContent);
  };

  const handleInsertEmoji = (emoji: string) => {
    const newContent = mainContent + emoji;
    setContent('main', newContent);
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
        <div className="flex overflow-x-auto">
          {[
            { id: 'generate', label: 'Generate', icon: Sparkles },
            { id: 'image', label: 'Image', icon: Image },
            { id: 'improve', label: 'Improve', icon: Wand2 },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'hashtags', label: 'Hashtags', icon: Hash },
            { id: 'brand-voice', label: 'Brand Voice', icon: Mic },
            { id: 'insights', label: 'Insights', icon: TrendingUp },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors flex-shrink-0 ${
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
              <label htmlFor="length" className="block text-sm font-medium text-gray-700 mb-2">
                Length
              </label>
              <select
                id="length"
                value={selectedLength}
                onChange={(e) => setSelectedLength(e.target.value as ContentLength)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={ContentLength.SHORT}>Short (50-100 chars)</option>
                <option value={ContentLength.MEDIUM}>Medium (100-200 chars)</option>
                <option value={ContentLength.LONG}>Long (200-280 chars)</option>
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

            {/* Additional AI Tools */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleGenerateCTAs}
                disabled={isLoading}
                className="px-3 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                <Target className="h-4 w-4" />
                Add CTA
              </button>
              <button
                onClick={handleSuggestEmojis}
                disabled={isLoading || !mainContent.trim()}
                className="px-3 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                <Smile className="h-4 w-4" />
                Add Emojis
              </button>
            </div>

            {/* CTA Options */}
            {showCTAOptions && ctas.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Call-to-Action Options</h4>
                <div className="grid grid-cols-2 gap-2">
                  {ctas.map((cta, index) => (
                    <button
                      key={index}
                      onClick={() => handleInsertCTA(cta)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
                    >
                      {cta}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCTAOptions(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Hide CTAs
                </button>
              </div>
            )}

            {/* Emoji Suggestions */}
            {showEmojiSuggestions && emojis.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Emoji Suggestions</h4>
                <div className="grid grid-cols-4 gap-2">
                  {emojis.map((emojiData, index) => (
                    <button
                      key={index}
                      onClick={() => handleInsertEmoji(emojiData.emoji)}
                      className="p-2 text-lg border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
                      title={emojiData.description}
                    >
                      {emojiData.emoji}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowEmojiSuggestions(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Hide Emojis
                </button>
              </div>
            )}

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
                      <button
                        onClick={() => handleSaveAsTemplate(variant.caption)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <Save className="h-3 w-3" />
                        Save
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

        {/* Image Caption Tab */}
        {activeTab === 'image' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="image-url" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                id="image-url"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Provide a direct link to your image</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="image-tone" className="block text-sm font-medium text-gray-700 mb-2">
                  Tone
                </label>
                <select
                  id="image-tone"
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
                <label htmlFor="image-length" className="block text-sm font-medium text-gray-700 mb-2">
                  Length
                </label>
                <select
                  id="image-length"
                  value={selectedLength}
                  onChange={(e) => setSelectedLength(e.target.value as ContentLength)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={ContentLength.SHORT}>Short</option>
                  <option value={ContentLength.MEDIUM}>Medium</option>
                  <option value={ContentLength.LONG}>Long</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateImageCaption}
              disabled={isLoading || !imageUrl.trim()}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Image...
                </>
              ) : (
                <>
                  <Image className="h-4 w-4" />
                  Generate from Image
                </>
              )}
            </button>

            {/* Image Caption Results */}
            {imageCaptions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Generated Captions</h3>
                {imageCaptions.map((variant) => (
                  <div key={variant.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-900 mb-2">{variant.caption}</p>
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

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                  Industry
                </label>
                <select
                  id="industry"
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="technology">Technology</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="finance">Finance</option>
                  <option value="retail">Retail</option>
                  <option value="food">Food & Beverage</option>
                  <option value="education">Education</option>
                  <option value="real-estate">Real Estate</option>
                  <option value="automotive">Automotive</option>
                  <option value="beauty">Beauty & Wellness</option>
                  <option value="fitness">Fitness</option>
                  <option value="travel">Travel</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="nonprofit">Non-Profit</option>
                </select>
              </div>

              <div>
                <label htmlFor="content-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type
                </label>
                <select
                  id="content-type"
                  value={selectedContentType}
                  onChange={(e) => setSelectedContentType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                  <option value="announcement">Announcement</option>
                  <option value="educational">Educational</option>
                  <option value="promotional">Promotional</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateTemplates}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Templates...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate Templates
                </>
              )}
            </button>

            {/* Templates Results */}
            {templates.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Industry Templates</h3>
                {templates.map((template, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{template.name}</h4>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                    <div className="bg-gray-50 p-2 rounded text-sm text-gray-900 mb-2">
                      {template.template}
                    </div>
                    {template.placeholders.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-600">Placeholders:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {template.placeholders.map((placeholder: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {placeholder}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyCaption(template.template, `template-${index}`)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                      <button
                        onClick={() => handleUseCaption(template.template)}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Saved Templates */}
            {savedTemplates.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Saved Templates</h3>
                {savedTemplates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{template.name}</h4>
                      <span className="text-xs text-gray-500">{template.platform}</span>
                    </div>
                    <p className="text-sm text-gray-900 mb-2">{template.content}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUseCaption(template.content)}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand Voice Tab */}
        {activeTab === 'brand-voice' && (
          <div className="space-y-4">
            <div className="text-center">
              <Mic className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brand Voice Analysis</h3>
              <p className="text-sm text-gray-600 mb-4">
                Analyze your content to create a consistent brand voice profile
              </p>
            </div>

            <button
              onClick={handleAnalyzeBrandVoice}
              disabled={isAnalyzingBrandVoice || !mainContent.trim()}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAnalyzingBrandVoice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Voice...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Analyze Brand Voice
                </>
              )}
            </button>

            {!mainContent.trim() && (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">Write some content first to analyze your brand voice.</p>
              </div>
            )}

            {/* Brand Voice Results */}
            {brandVoiceProfile && (
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Voice Profile</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600">Tone:</span>
                      <p className="text-sm text-gray-900">{brandVoiceProfile.tone}</p>
                    </div>
                    
                    <div>
                      <span className="text-xs font-medium text-gray-600">Style:</span>
                      <p className="text-sm text-gray-900">{brandVoiceProfile.style}</p>
                    </div>
                    
                    {brandVoiceProfile.vocabulary.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">Key Vocabulary:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {brandVoiceProfile.vocabulary.slice(0, 10).map((word: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {brandVoiceProfile.phrases.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">Signature Phrases:</span>
                        <div className="space-y-1 mt-1">
                          {brandVoiceProfile.phrases.slice(0, 5).map((phrase: string, i: number) => (
                            <p key={i} className="text-xs text-gray-700 italic">"{phrase}"</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export { AIAssistantPanel };