import { useState, useEffect } from 'react';
import { usePostStore } from '@/store/post.store';
import { PostStatus } from '@/types/post.types';
import { RepurposeFromPost } from '@/components/repurpose/RepurposeFromPost';
import { LongformRepurposer } from '@/components/repurpose/LongformRepurposer';
import { RotateCcw, FileText, Calendar } from 'lucide-react';

export function RepurposePage() {
  const { posts, fetchPosts } = usePostStore();
  const [activeTab, setActiveTab] = useState<'existing' | 'longform'>('existing');
  const [selectedPost, setSelectedPost] = useState<string | null>(null);

  // Load published posts on mount
  useEffect(() => {
    fetchPosts({
      status: PostStatus.PUBLISHED,
    });
  }, [fetchPosts]);

  const publishedPosts = posts.filter(post => post.status === PostStatus.PUBLISHED);
  const selectedPostData = publishedPosts.find(post => post._id === selectedPost);

  const truncateContent = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <RotateCcw className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900">Content Repurposer</h1>
        </div>
        <p className="text-gray-600">
          Transform your content for every platform automatically
        </p>
      </div>

      {/* Mobile Tabs */}
      <div className="lg:hidden border-b border-gray-200 mb-6">
        <div className="flex">
          <button
            onClick={() => setActiveTab('existing')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'existing'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="h-4 w-4" />
            From Existing Post
          </button>
          <button
            onClick={() => setActiveTab('longform')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'longform'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="h-4 w-4" />
            From Long-form
          </button>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
        {/* From Existing Post Section */}
        <div className={`${activeTab === 'existing' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">From Existing Post</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Select a published post to repurpose for other platforms
              </p>
            </div>

            <div className="p-4">
              {selectedPostData ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    ← Back to post list
                  </button>
                  
                  <RepurposeFromPost
                    postId={selectedPostData._id}
                    content={selectedPostData.content}
                    originalPlatform={
                      typeof selectedPostData.socialAccountId === 'object' 
                        ? selectedPostData.socialAccountId.platform 
                        : 'unknown'
                    }
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {publishedPosts.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No published posts found</p>
                      <p className="text-sm text-gray-500">
                        Publish some posts first to repurpose them
                      </p>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Recent Published Posts ({publishedPosts.length})
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {publishedPosts.map((post) => {
                          const account = typeof post.socialAccountId === 'object' 
                            ? post.socialAccountId 
                            : null;
                          
                          return (
                            <button
                              key={post._id}
                              onClick={() => setSelectedPost(post._id)}
                              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-900 line-clamp-2">
                                    {truncateContent(post.content)}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {account && (
                                      <span className="text-xs text-gray-500">
                                        {account.platform}
                                      </span>
                                    )}
                                    {post.publishedAt && (
                                      <span className="text-xs text-gray-500">
                                        {formatDate(post.publishedAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <RotateCcw className="h-4 w-4 text-purple-600 flex-shrink-0" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* From Long-form Section */}
        <div className={`${activeTab === 'longform' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">From Long-form</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Convert blog posts, articles, or long-form content into social media posts
              </p>
            </div>

            <div className="p-4">
              <LongformRepurposer />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}