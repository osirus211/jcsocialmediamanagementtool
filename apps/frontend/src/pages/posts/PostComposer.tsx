import { useState, useEffect } from 'react';
import { postService, CreatePostRequest } from '../../services/post.service';
import { socialService, SocialAccount } from '../../services/social.service';
import { 
  Send, 
  Calendar, 
  Image as ImageIcon, 
  Sparkles, 
  Twitter, 
  Linkedin, 
  Facebook, 
  Instagram,
  Youtube,
  Plus,
  X,
  AlertCircle
} from 'lucide-react';

/**
 * Post Composer
 * Create and schedule social media posts
 */

const PLATFORM_ICONS = {
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
};

export function PostComposer() {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isThread, setIsThread] = useState(false);
  const [threadPosts, setThreadPosts] = useState<string[]>(['']);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await socialService.getAccounts();
      setAccounts(data);
    } catch (err: any) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleGenerateAI = async () => {
    if (!content.trim()) {
      alert('Please enter a prompt for AI generation');
      return;
    }

    try {
      setAiLoading(true);
      const { content: generatedContent } = await postService.generateAIContent(content);
      setContent(generatedContent);
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert(err.response.data.error || 'AI limit reached. Upgrade to continue.');
      } else {
        alert(err.message || 'Failed to generate AI content');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddThreadPost = () => {
    setThreadPosts([...threadPosts, '']);
  };

  const handleRemoveThreadPost = (index: number) => {
    setThreadPosts(threadPosts.filter((_, i) => i !== index));
  };

  const handleThreadPostChange = (index: number, value: string) => {
    const updated = [...threadPosts];
    updated[index] = value;
    setThreadPosts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!content.trim() && !isThread) {
      setError('Please enter post content');
      return;
    }

    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    if (isThread && threadPosts.some((post) => !post.trim())) {
      setError('All thread posts must have content');
      return;
    }

    try {
      setLoading(true);

      const postData: CreatePostRequest = {
        content: isThread ? threadPosts[0] : content,
        platforms: selectedPlatforms,
        scheduledFor: scheduledFor || undefined,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        isThread,
        threadPosts: isThread ? threadPosts : undefined,
      };

      await postService.createPost(postData);
      
      setSuccess(true);
      
      // Reset form
      setContent('');
      setSelectedPlatforms([]);
      setScheduledFor('');
      setMediaUrls([]);
      setIsThread(false);
      setThreadPosts(['']);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(err.response.data.error || 'Post limit reached. Upgrade to continue.');
      } else {
        setError(err.message || 'Failed to create post');
      }
    } finally {
      setLoading(false);
    }
  };

  const connectedPlatforms = accounts.map((acc) => acc.platform);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Post</h1>
          <p className="text-gray-600 mt-2">Compose and schedule your social media posts</p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">Post created successfully!</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Platform Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Select Platforms</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(PLATFORM_ICONS).map(([platform, Icon]) => {
                const isConnected = connectedPlatforms.includes(platform as 'twitter' | 'linkedin' | 'facebook' | 'instagram');
                const isSelected = selectedPlatforms.includes(platform);

                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => isConnected && handlePlatformToggle(platform)}
                    disabled={!isConnected}
                    className={`p-4 rounded-lg border-2 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${!isConnected && 'opacity-50 cursor-not-allowed'}`}
                  >
                    <Icon className={`w-6 h-6 mx-auto ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                    <p className={`text-sm mt-2 capitalize ${isSelected ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                      {platform}
                    </p>
                    {!isConnected && (
                      <p className="text-xs text-red-500 mt-1">Not connected</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thread Toggle */}
          {selectedPlatforms.includes('twitter') && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isThread}
                  onChange={(e) => setIsThread(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <p className="font-semibold text-gray-900">Create Twitter Thread</p>
                  <p className="text-sm text-gray-600">Post multiple tweets in sequence</p>
                </div>
              </label>
            </div>
          )}

          {/* Content Editor */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {isThread ? 'Thread Content' : 'Post Content'}
              </h3>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={aiLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI Generate
                  </>
                )}
              </button>
            </div>

            {isThread ? (
              <div className="space-y-4">
                {threadPosts.map((post, index) => (
                  <div key={index} className="relative">
                    <textarea
                      value={post}
                      onChange={(e) => handleThreadPostChange(index, e.target.value)}
                      placeholder={`Tweet ${index + 1}`}
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveThreadPost(index)}
                        className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddThreadPost}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Tweet
                </button>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={6}
              />
            )}

            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>{isThread ? threadPosts.reduce((sum, post) => sum + post.length, 0) : content.length} characters</span>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Schedule (Optional)</h3>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-600" />
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Leave empty to post immediately
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Creating Post...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {scheduledFor ? 'Schedule Post' : 'Post Now'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
