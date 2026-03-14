import { useState, useCallback, memo } from 'react';
import { X, Upload, Download, Plus, Calendar, Trash2, Eye } from 'lucide-react';
import { SocialPlatform, PublishMode } from '@/types/composer.types';

interface BulkPost {
  id: string;
  content: string;
  platforms: SocialPlatform[];
  scheduledAt?: Date;
  publishMode: PublishMode;
  status: 'draft' | 'scheduled' | 'error';
  errorMessage?: string;
}

interface BulkComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleAll: (posts: BulkPost[]) => Promise<void>;
}

const BulkComposer = memo(function BulkComposer({
  isOpen,
  onClose,
  onScheduleAll,
}: BulkComposerProps) {
  const [posts, setPosts] = useState<BulkPost[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Add a new empty post
  const addPost = useCallback(() => {
    if (posts.length >= 100) return; // Limit to 100 posts
    
    const newPost: BulkPost = {
      id: `post-${Date.now()}-${Math.random()}`,
      content: '',
      platforms: [],
      publishMode: PublishMode.SCHEDULE,
      status: 'draft',
    };
    
    setPosts(prev => [...prev, newPost]);
  }, [posts.length]);

  // Remove a post
  const removePost = useCallback((id: string) => {
    setPosts(prev => prev.filter(post => post.id !== id));
  }, []);

  // Update a post
  const updatePost = useCallback((id: string, updates: Partial<BulkPost>) => {
    setPosts(prev => prev.map(post => 
      post.id === id ? { ...post, ...updates } : post
    ));
  }, []);

  // Handle CSV upload
  const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const newPosts: BulkPost[] = [];
      
      for (let i = 1; i < lines.length && i <= 100; i++) { // Limit to 100 posts
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < headers.length || !values[0]) continue;
        
        const contentIndex = headers.findIndex(h => h.toLowerCase().includes('content'));
        const platformsIndex = headers.findIndex(h => h.toLowerCase().includes('platform'));
        const dateIndex = headers.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('time'));
        
        if (contentIndex === -1) continue;
        
        const content = values[contentIndex] || '';
        const platformsStr = values[platformsIndex] || '';
        const dateStr = values[dateIndex] || '';
        
        const platforms = platformsStr
          .split(';')
          .map(p => p.trim().toLowerCase())
          .filter(p => ['twitter', 'linkedin', 'instagram', 'facebook', 'threads', 'bluesky', 'youtube', 'google-business', 'pinterest'].includes(p)) as SocialPlatform[];
        
        const scheduledAt = dateStr ? new Date(dateStr) : undefined;
        
        newPosts.push({
          id: `csv-${i}-${Date.now()}`,
          content,
          platforms,
          scheduledAt,
          publishMode: scheduledAt ? PublishMode.SCHEDULE : PublishMode.NOW,
          status: 'draft',
        });
      }
      
      setPosts(prev => [...prev, ...newPosts]);
    };
    
    reader.readAsText(file);
  }, []);

  // Download CSV template
  const downloadTemplate = useCallback(() => {
    const csvContent = 'Content,Platforms,Scheduled Date\n"Your post content here","twitter;linkedin","2024-12-25 10:00"\n"Another post","instagram;facebook","2024-12-26 14:30"';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-posts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Schedule all posts
  const handleScheduleAll = useCallback(async () => {
    const validPosts = posts.filter(post => 
      post.content.trim() && 
      post.platforms.length > 0 &&
      post.status === 'draft'
    );
    
    if (validPosts.length === 0) return;
    
    setIsScheduling(true);
    
    try {
      await onScheduleAll(validPosts);
      setPosts(prev => prev.map(post => 
        validPosts.some(vp => vp.id === post.id) 
          ? { ...post, status: 'scheduled' as const }
          : post
      ));
    } catch (error) {
      console.error('Failed to schedule posts:', error);
      setPosts(prev => prev.map(post => 
        validPosts.some(vp => vp.id === post.id) 
          ? { ...post, status: 'error' as const, errorMessage: 'Failed to schedule' }
          : post
      ));
    } finally {
      setIsScheduling(false);
    }
  }, [posts, onScheduleAll]);

  const validPostsCount = posts.filter(post => 
    post.content.trim() && post.platforms.length > 0
  ).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bulk Composer</h2>
            <p className="text-sm text-gray-600 mt-1">
              Schedule up to 100 posts at once
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={addPost}
              disabled={posts.length >= 100}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Post
            </button>
            
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                <Upload className="h-4 w-4" />
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Template
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {validPostsCount} / {posts.length} posts ready
            </span>
            
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
            
            <button
              onClick={handleScheduleAll}
              disabled={validPostsCount === 0 || isScheduling}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScheduling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Schedule All ({validPostsCount})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Posts List */}
        <div className="flex-1 overflow-y-auto max-h-[60vh]">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
              <Calendar className="h-12 w-12 mb-4" />
              <h3 className="text-lg font-medium mb-2">No posts yet</h3>
              <p className="text-sm text-center mb-4">
                Add posts manually or upload a CSV file to get started
              </p>
              <button
                onClick={addPost}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Your First Post
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  className={`border rounded-lg p-4 ${
                    post.status === 'error' ? 'border-red-300 bg-red-50' :
                    post.status === 'scheduled' ? 'border-green-300 bg-green-50' :
                    'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Post Number */}
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                      {index + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <textarea
                        value={post.content}
                        onChange={(e) => updatePost(post.id, { content: e.target.value })}
                        placeholder="What do you want to share?"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />

                      <div className="flex items-center gap-4">
                        {/* Platform Selection */}
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Platforms
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {(['twitter', 'linkedin', 'instagram', 'facebook'] as SocialPlatform[]).map(platform => (
                              <label key={platform} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={post.platforms.includes(platform)}
                                  onChange={(e) => {
                                    const platforms = e.target.checked
                                      ? [...post.platforms, platform]
                                      : post.platforms.filter(p => p !== platform);
                                    updatePost(post.id, { platforms });
                                  }}
                                  className="h-3 w-3 text-blue-600 rounded"
                                />
                                <span className="text-xs text-gray-600 capitalize">
                                  {platform}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Schedule Date */}
                        <div className="w-48">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Schedule Date
                          </label>
                          <input
                            type="datetime-local"
                            value={post.scheduledAt ? post.scheduledAt.toISOString().slice(0, 16) : ''}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : undefined;
                              updatePost(post.id, { 
                                scheduledAt: date,
                                publishMode: date ? PublishMode.SCHEDULE : PublishMode.NOW
                              });
                            }}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Status */}
                      {post.status === 'error' && post.errorMessage && (
                        <div className="text-xs text-red-600">
                          Error: {post.errorMessage}
                        </div>
                      )}
                      
                      {post.status === 'scheduled' && (
                        <div className="text-xs text-green-600">
                          ✓ Scheduled successfully
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => removePost(post.id)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {posts.length} / 100 posts • {validPostsCount} ready to schedule
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export { BulkComposer, type BulkPost };