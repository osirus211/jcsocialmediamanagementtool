/**
 * Threads Composer Component
 * Enhanced composer with Threads-specific features
 */

import React, { useState, useCallback } from 'react';
import { Plus, X, Reply, Image, Video, Type } from 'lucide-react';

interface ThreadsComposerProps {
  content: string;
  onContentChange: (content: string) => void;
  replyToId?: string;
  replyToUsername?: string;
  onReplyChange?: (replyToId?: string, replyToUsername?: string) => void;
  maxLength?: number;
}

const THREADS_LIMIT = 500;

export const ThreadsComposer: React.FC<ThreadsComposerProps> = ({
  content,
  onContentChange,
  replyToId,
  replyToUsername,
  onReplyChange,
  maxLength = THREADS_LIMIT,
}) => {
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'carousel'>('text');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [tempReplyUsername, setTempReplyUsername] = useState('');

  const isOverLimit = content.length > maxLength;
  const remainingChars = maxLength - content.length;

  const handleReplySubmit = useCallback(() => {
    if (tempReplyUsername.trim() && onReplyChange) {
      // In a real app, you'd validate the username and get the thread ID
      onReplyChange(`thread_${tempReplyUsername}`, tempReplyUsername);
      setShowReplyInput(false);
      setTempReplyUsername('');
    }
  }, [tempReplyUsername, onReplyChange]);

  const clearReply = useCallback(() => {
    if (onReplyChange) {
      onReplyChange(undefined, undefined);
    }
  }, [onReplyChange]);

  return (
    <div className="space-y-4">
      {/* Post Type Selector */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Post Type:</span>
        <div className="flex gap-1">
          {[
            { type: 'text' as const, icon: Type, label: 'Text' },
            { type: 'image' as const, icon: Image, label: 'Image' },
            { type: 'video' as const, icon: Video, label: 'Video' },
            { type: 'carousel' as const, icon: Plus, label: 'Carousel' },
          ].map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setPostType(type)}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                postType === type
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* Reply Context */}
      {replyToId && replyToUsername && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Reply className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Replying to @{replyToUsername}
          </span>
          <button
            onClick={clearReply}
            className="ml-auto p-1 hover:bg-blue-100 rounded"
          >
            <X className="h-4 w-4 text-blue-600" />
          </button>
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Reply className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Reply to Thread</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter username (without @)"
              value={tempReplyUsername}
              onChange={(e) => setTempReplyUsername(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleReplySubmit()}
            />
            <button
              onClick={handleReplySubmit}
              disabled={!tempReplyUsername.trim()}
              className="px-4 py-2 bg-black text-white rounded-md text-sm disabled:opacity-50"
            >
              Set Reply
            </button>
            <button
              onClick={() => setShowReplyInput(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={
            replyToId 
              ? `Reply to @${replyToUsername}...` 
              : postType === 'carousel'
              ? 'Write your carousel caption (up to 20 items)...'
              : 'What\'s on your mind?'
          }
          className={`w-full p-4 border rounded-lg resize-none focus:ring-2 focus:ring-black focus:border-transparent ${
            isOverLimit ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
          }`}
          rows={4}
        />
        
        {/* Character Counter */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {!showReplyInput && !replyToId && (
            <button
              onClick={() => setShowReplyInput(true)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Reply to thread"
            >
              <Reply className="h-4 w-4" />
            </button>
          )}
          <div className={`text-sm ${
            isOverLimit ? 'text-red-600 font-semibold' : 
            remainingChars < 50 ? 'text-orange-600' : 'text-gray-500'
          }`}>
            {remainingChars}
          </div>
        </div>
      </div>

      {/* Post Type Specific Options */}
      {postType === 'carousel' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">Carousel Post</span>
          </div>
          <p className="text-sm text-yellow-700">
            Upload up to 20 images or videos. Mix and match different media types for engaging carousel posts.
          </p>
        </div>
      )}

      {postType === 'video' && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Video className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Video Post</span>
          </div>
          <p className="text-sm text-purple-700">
            Videos will be processed before publishing. Supported formats: MP4, MOV, AVI.
          </p>
        </div>
      )}

      {/* Threads Features Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>• Character limit: {maxLength} characters</div>
        <div>• Supports text, images, videos, and carousels (up to 20 items)</div>
        <div>• Reply to existing threads for better engagement</div>
        <div>• Videos are automatically processed before publishing</div>
      </div>
    </div>
  );
};