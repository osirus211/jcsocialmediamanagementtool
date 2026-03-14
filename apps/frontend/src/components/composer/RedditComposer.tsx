/**
 * Reddit Composer Component
 * Enhanced composer with Reddit-specific features
 */

import React, { useState, useCallback, useEffect } from 'react';
import { MessageSquare, Link, Image, Video, Share, AlertTriangle, Eye, EyeOff, Tag, Search, Users, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface RedditComposerProps {
  content: string;
  onContentChange: (content: string) => void;
  postType?: 'text' | 'link' | 'image' | 'video' | 'crosspost';
  onPostTypeChange?: (type: 'text' | 'link' | 'image' | 'video' | 'crosspost') => void;
  title: string;
  onTitleChange: (title: string) => void;
  subreddit?: string;
  onSubredditChange?: (subreddit: string) => void;
  linkUrl?: string;
  onLinkUrlChange?: (url: string) => void;
  nsfw?: boolean;
  onNsfwChange?: (nsfw: boolean) => void;
  spoiler?: boolean;
  onSpoilerChange?: (spoiler: boolean) => void;
  sendReplies?: boolean;
  onSendRepliesChange?: (sendReplies: boolean) => void;
  flairId?: string;
  onFlairIdChange?: (flairId: string) => void;
  flairText?: string;
  onFlairTextChange?: (flairText: string) => void;
  accountId?: string;
  maxTitleLength?: number;
  maxContentLength?: number;
}

interface Subreddit {
  display_name: string;
  title: string;
  subscribers: number;
  over18: boolean;
  icon_img?: string;
  description: string;
  submit_text?: string;
  submission_type: string;
  link_flair_enabled: boolean;
}

interface RedditFlair {
  id: string;
  text: string;
  type: string;
}

const REDDIT_TITLE_LIMIT = 300;
const REDDIT_CONTENT_LIMIT = 40000;

const postTypeOptions = [
  {
    value: 'text' as const,
    label: 'Text Post',
    icon: MessageSquare,
    description: 'Share text content with the community'
  },
  {
    value: 'link' as const,
    label: 'Link Post',
    icon: Link,
    description: 'Share a link to external content'
  },
  {
    value: 'image' as const,
    label: 'Image Post',
    icon: Image,
    description: 'Share an image with the community'
  },
  {
    value: 'video' as const,
    label: 'Video Post',
    icon: Video,
    description: 'Share a video with the community'
  },
  {
    value: 'crosspost' as const,
    label: 'Crosspost',
    icon: Share,
    description: 'Share a post from another subreddit'
  }
];

export const RedditComposer: React.FC<RedditComposerProps> = ({
  content,
  onContentChange,
  postType = 'text',
  onPostTypeChange,
  title,
  onTitleChange,
  subreddit = '',
  onSubredditChange,
  linkUrl = '',
  onLinkUrlChange,
  nsfw = false,
  onNsfwChange,
  spoiler = false,
  onSpoilerChange,
  sendReplies = true,
  onSendRepliesChange,
  flairId = '',
  onFlairIdChange,
  flairText = '',
  onFlairTextChange,
  accountId,
  maxTitleLength = REDDIT_TITLE_LIMIT,
  maxContentLength = REDDIT_CONTENT_LIMIT,
}) => {
  const [subreddits, setSubreddits] = useState<Subreddit[]>([]);
  const [flairs, setFlairs] = useState<RedditFlair[]>([]);
  const [loadingSubreddits, setLoadingSubreddits] = useState(false);
  const [loadingFlairs, setLoadingFlairs] = useState(false);
  const [showSubredditDropdown, setShowSubredditDropdown] = useState(false);
  const [showFlairDropdown, setShowFlairDropdown] = useState(false);
  const [subredditSearch, setSubredditSearch] = useState('');
  const [selectedSubredditInfo, setSelectedSubredditInfo] = useState<Subreddit | null>(null);

  const isTitleOverLimit = title.length > maxTitleLength;
  const isContentOverLimit = content.length > maxContentLength;
  const remainingTitleChars = maxTitleLength - title.length;
  const remainingContentChars = maxContentLength - content.length;

  // Load user's subscribed subreddits
  useEffect(() => {
    if (accountId) {
      loadSubreddits();
    }
  }, [accountId]);

  // Load flairs when subreddit changes
  useEffect(() => {
    if (subreddit && accountId) {
      loadSubredditFlairs(subreddit);
      loadSubredditInfo(subreddit);
    } else {
      setFlairs([]);
      setSelectedSubredditInfo(null);
    }
  }, [subreddit, accountId]);

  const loadSubreddits = async () => {
    if (!accountId) return;

    setLoadingSubreddits(true);
    try {
      const response = await apiClient.get(`/reddit/subreddits?accountId=${accountId}`);
      setSubreddits(response.subreddits || []);
    } catch (error) {
      console.error('Failed to load subreddits:', error);
    } finally {
      setLoadingSubreddits(false);
    }
  };

  const loadSubredditFlairs = async (subredditName: string) => {
    if (!accountId) return;

    setLoadingFlairs(true);
    try {
      const response = await apiClient.get(`/reddit/subreddits/${subredditName}/flairs?accountId=${accountId}`);
      setFlairs(response.flairs || []);
    } catch (error) {
      console.error('Failed to load flairs:', error);
      setFlairs([]);
    } finally {
      setLoadingFlairs(false);
    }
  };

  const loadSubredditInfo = async (subredditName: string) => {
    if (!accountId) return;

    try {
      const response = await apiClient.get(`/reddit/subreddits/${subredditName}?accountId=${accountId}`);
      setSelectedSubredditInfo(response.subreddit);
    } catch (error) {
      console.error('Failed to load subreddit info:', error);
      setSelectedSubredditInfo(null);
    }
  };

  const handlePostTypeChange = useCallback((newType: typeof postType) => {
    if (onPostTypeChange) {
      onPostTypeChange(newType);
    }
  }, [onPostTypeChange]);

  const handleSubredditSelect = useCallback((selectedSubreddit: string) => {
    if (onSubredditChange) {
      onSubredditChange(selectedSubreddit);
    }
    setShowSubredditDropdown(false);
    setSubredditSearch('');
  }, [onSubredditChange]);

  const handleFlairSelect = useCallback((selectedFlair: RedditFlair) => {
    if (onFlairIdChange) {
      onFlairIdChange(selectedFlair.id);
    }
    if (onFlairTextChange) {
      onFlairTextChange(selectedFlair.text);
    }
    setShowFlairDropdown(false);
  }, [onFlairIdChange, onFlairTextChange]);

  const filteredSubreddits = subreddits.filter(sub =>
    sub.display_name.toLowerCase().includes(subredditSearch.toLowerCase()) ||
    sub.title.toLowerCase().includes(subredditSearch.toLowerCase())
  );

  const formatSubscriberCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="space-y-6">
      {/* Post Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Post Type</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {postTypeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => handlePostTypeChange(option.value)}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  postType === option.value
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
                title={option.description}
              >
                <Icon className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subreddit Selector */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Subreddit <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <button
            onClick={() => setShowSubredditDropdown(!showSubredditDropdown)}
            className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
          >
            <div className="flex items-center justify-between">
              <span className={subreddit ? 'text-gray-900' : 'text-gray-500'}>
                {subreddit ? `r/${subreddit}` : 'Select a subreddit'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          {showSubredditDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search subreddits..."
                    value={subredditSearch}
                    onChange={(e) => setSubredditSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>
              
              {loadingSubreddits ? (
                <div className="p-4 text-center text-gray-500">Loading subreddits...</div>
              ) : filteredSubreddits.length > 0 ? (
                <div className="max-h-48 overflow-y-auto">
                  {filteredSubreddits.map((sub) => (
                    <button
                      key={sub.display_name}
                      onClick={() => handleSubredditSelect(sub.display_name)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3"
                    >
                      <div className="flex-shrink-0">
                        {sub.icon_img ? (
                          <img
                            src={sub.icon_img}
                            alt={`r/${sub.display_name}`}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white font-bold">r/</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">r/{sub.display_name}</span>
                          {sub.over18 && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-800 rounded">NSFW</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <Users className="w-3 h-3" />
                          <span>{formatSubscriberCount(sub.subscribers)} members</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">No subreddits found</div>
              )}
            </div>
          )}
        </div>

        {/* Subreddit Info */}
        {selectedSubredditInfo && (
          <div className="mt-2 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-medium text-gray-700">{selectedSubredditInfo.title}</span>
              {selectedSubredditInfo.over18 && (
                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">NSFW</span>
              )}
            </div>
            {selectedSubredditInfo.submit_text && (
              <p className="mt-1 text-xs text-gray-600">{selectedSubredditInfo.submit_text}</p>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter your post title..."
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
              isTitleOverLimit ? 'border-red-300' : 'border-gray-300'
            }`}
            maxLength={maxTitleLength + 50} // Allow typing beyond limit to show error
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <span className={`text-xs ${isTitleOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
              {remainingTitleChars}
            </span>
          </div>
        </div>
        {isTitleOverLimit && (
          <p className="mt-1 text-xs text-red-600">Title exceeds maximum length</p>
        )}
      </div>

      {/* Link URL (for link posts) */}
      {postType === 'link' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Link URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => onLinkUrlChange?.(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Content (for text posts) */}
      {postType === 'text' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content (Markdown supported)
          </label>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Write your post content here... (Markdown supported)"
              rows={8}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-vertical ${
                isContentOverLimit ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <div className="absolute right-3 bottom-3">
              <span className={`text-xs ${isContentOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                {remainingContentChars}
              </span>
            </div>
          </div>
          {isContentOverLimit && (
            <p className="mt-1 text-xs text-red-600">Content exceeds maximum length</p>
          )}
        </div>
      )}

      {/* Flair Selector */}
      {selectedSubredditInfo?.link_flair_enabled && flairs.length > 0 && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">Post Flair</label>
          <button
            onClick={() => setShowFlairDropdown(!showFlairDropdown)}
            className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
          >
            <div className="flex items-center justify-between">
              <span className={flairText ? 'text-gray-900' : 'text-gray-500'}>
                {flairText ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                    <Tag className="w-3 h-3 mr-1" />
                    {flairText}
                  </span>
                ) : (
                  'Select a flair (optional)'
                )}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          {showFlairDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
              <button
                onClick={() => {
                  onFlairIdChange?.('');
                  onFlairTextChange?.('');
                  setShowFlairDropdown(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-500"
              >
                No flair
              </button>
              {flairs.map((flair) => (
                <button
                  key={flair.id}
                  onClick={() => handleFlairSelect(flair)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                    <Tag className="w-3 h-3 mr-1" />
                    {flair.text}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Post Options</h3>
        
        <div className="space-y-3">
          {/* NSFW Toggle */}
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={nsfw}
              onChange={(e) => onNsfwChange?.(e.target.checked)}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-700">Mark as NSFW (Not Safe For Work)</span>
            </div>
          </label>

          {/* Spoiler Toggle */}
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={spoiler}
              onChange={(e) => onSpoilerChange?.(e.target.checked)}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <div className="flex items-center space-x-2">
              <EyeOff className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Mark as Spoiler</span>
            </div>
          </label>

          {/* Send Replies Toggle */}
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={sendReplies}
              onChange={(e) => onSendRepliesChange?.(e.target.checked)}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Send reply notifications to inbox</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};