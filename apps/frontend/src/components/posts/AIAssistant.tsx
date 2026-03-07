import { useState } from 'react';
import { useAIStore } from '@/store/ai.store';
import { ContentTone, ContentLength, SocialPlatform } from '@/types/ai.types';

interface AIAssistantProps {
  currentContent: string;
  platform?: string;
  onInsert: (content: string) => void;
  onClose: () => void;
}

export function AIAssistant({ currentContent, platform, onInsert, onClose }: AIAssistantProps) {
  const { isGenerating, generateCaption, generateHashtags, improveContent, generateSuggestions } = useAIStore();
  
  const [activeTab, setActiveTab] = useState<'generate' | 'improve' | 'hashtags' | 'suggestions'>('generate');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<ContentTone>(ContentTone.PROFESSIONAL);
  const [length, setLength] = useState<ContentLength>(ContentLength.MEDIUM);
  const [result, setResult] = useState<string>('');

  const handleGenerateCaption = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    try {
      const response = await generateCaption({
        topic,
        tone,
        platform: (platform as SocialPlatform) || SocialPlatform.TWITTER,
        length,
      });
      setResult(response.caption);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to generate caption');
    }
  };

  const handleGenerateHashtags = async () => {
    if (!currentContent.trim()) {
      alert('Please write some content first');
      return;
    }

    try {
      const response = await generateHashtags({
        caption: currentContent,
        platform: (platform as SocialPlatform) || SocialPlatform.TWITTER,
      });
      setResult(response.hashtags.join(' '));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to generate hashtags');
    }
  };

  const handleImprove = async () => {
    if (!currentContent.trim()) {
      alert('Please write some content first');
      return;
    }

    try {
      const response = await improveContent(currentContent, platform);
      setResult(response.rewrittenContent);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to improve content');
    }
  };

  const handleGenerateSuggestions = async (type: 'cta' | 'hook' | 'timing' | 'style') => {
    try {
      const response = await generateSuggestions({
        caption: currentContent,
        platform: (platform as SocialPlatform) || undefined,
        type,
      });
      setResult(response.suggestions.join('\n\n'));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to generate suggestions');
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          ✨ AI Assistant
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'generate'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Generate
        </button>
        <button
          onClick={() => setActiveTab('improve')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'improve'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Improve
        </button>
        <button
          onClick={() => setActiveTab('hashtags')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'hashtags'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Hashtags
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'suggestions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Suggestions
        </button>
      </div>

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What do you want to post about?"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as ContentTone)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {Object.values(ContentTone).map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Length
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as ContentLength)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {Object.values(ContentLength).map((l) => (
                  <option key={l} value={l}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateCaption}
            disabled={isGenerating}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : '✨ Generate Caption'}
          </button>
        </div>
      )}

      {/* Improve Tab */}
      {activeTab === 'improve' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            AI will improve your current content for better engagement and clarity.
          </p>
          <button
            onClick={handleImprove}
            disabled={isGenerating || !currentContent}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Improving...' : '✨ Improve Content'}
          </button>
        </div>
      )}

      {/* Hashtags Tab */}
      {activeTab === 'hashtags' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Generate relevant hashtags based on your content.
          </p>
          <button
            onClick={handleGenerateHashtags}
            disabled={isGenerating || !currentContent}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : '✨ Generate Hashtags'}
          </button>
        </div>
      )}

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-3">
            Get smart suggestions to improve your post.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleGenerateSuggestions('cta')}
              disabled={isGenerating}
              className="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              CTA Ideas
            </button>
            <button
              onClick={() => handleGenerateSuggestions('hook')}
              disabled={isGenerating}
              className="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              Hook Ideas
            </button>
            <button
              onClick={() => handleGenerateSuggestions('timing')}
              disabled={isGenerating}
              className="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              Best Times
            </button>
            <button
              onClick={() => handleGenerateSuggestions('style')}
              disabled={isGenerating}
              className="px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              Style Tips
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 p-3 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Result:</span>
            <button
              onClick={() => onInsert(result)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Insert
            </button>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{result}</p>
        </div>
      )}
    </div>
  );
}
