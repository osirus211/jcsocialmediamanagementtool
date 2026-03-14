import React, { useState, useCallback } from 'react';
import { Plus, X, GripVertical, MessageCircle, BarChart3, Clock, ArrowUp, ArrowDown } from 'lucide-react';

interface Tweet {
  id: string;
  content: string;
  mediaIds: string[];
  altTexts: string[];
}

interface TwitterThreadComposerProps {
  onThreadChange: (tweets: Tweet[]) => void;
  maxTweets?: number;
  characterLimit?: number;
}

export function TwitterThreadComposer({ 
  onThreadChange, 
  maxTweets = 25, 
  characterLimit = 280 
}: TwitterThreadComposerProps) {
  const [tweets, setTweets] = useState<Tweet[]>([
    { id: '1', content: '', mediaIds: [], altTexts: [] }
  ]);

  const updateTweet = useCallback((id: string, content: string) => {
    const updatedTweets = tweets.map(tweet => 
      tweet.id === id ? { ...tweet, content } : tweet
    );
    setTweets(updatedTweets);
    onThreadChange(updatedTweets);
  }, [tweets, onThreadChange]);

  const addTweet = useCallback(() => {
    if (tweets.length >= maxTweets) return;
    
    const newTweet: Tweet = {
      id: Date.now().toString(),
      content: '',
      mediaIds: [],
      altTexts: []
    };
    
    const updatedTweets = [...tweets, newTweet];
    setTweets(updatedTweets);
    onThreadChange(updatedTweets);
  }, [tweets, maxTweets, onThreadChange]);

  const removeTweet = useCallback((id: string) => {
    if (tweets.length <= 1) return;
    
    const updatedTweets = tweets.filter(tweet => tweet.id !== id);
    setTweets(updatedTweets);
    onThreadChange(updatedTweets);
  }, [tweets, onThreadChange]);

  const moveTweet = useCallback((index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tweets.length) return;

    const updatedTweets = [...tweets];
    [updatedTweets[index], updatedTweets[newIndex]] = [updatedTweets[newIndex], updatedTweets[index]];
    
    setTweets(updatedTweets);
    onThreadChange(updatedTweets);
  }, [tweets, onThreadChange]);

  const getTotalCharacters = () => {
    return tweets.reduce((total, tweet) => total + tweet.content.length, 0);
  };

  const getEstimatedReadTime = () => {
    const totalWords = tweets.reduce((total, tweet) => 
      total + tweet.content.split(' ').length, 0
    );
    return Math.ceil(totalWords / 200); // Average reading speed
  };

  return (
    <div className="space-y-4">
      {/* Thread Stats */}
      <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <MessageCircle className="h-4 w-4" />
          <span>{tweets.length} tweets</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <BarChart3 className="h-4 w-4" />
          <span>{getTotalCharacters()} characters</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Clock className="h-4 w-4" />
          <span>~{getEstimatedReadTime()} min read</span>
        </div>
      </div>

      {/* Thread Composer */}
      <div className="space-y-3">
        {tweets.map((tweet, index) => (
          <div key={tweet.id} className="relative border rounded-lg p-4 bg-white shadow-sm">
            {/* Tweet Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <button
                    onClick={() => moveTweet(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveTweet(index, 'down')}
                    disabled={index === tweets.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  Tweet {index + 1}
                </span>
                {index > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Reply to tweet {index}
                  </span>
                )}
              </div>
              
              {tweets.length > 1 && (
                <button
                  onClick={() => removeTweet(tweet.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Tweet Content */}
            <div className="space-y-3">
              <textarea
                value={tweet.content}
                onChange={(e) => updateTweet(tweet.id, e.target.value)}
                placeholder={index === 0 ? "Start your thread..." : "Continue your thread..."}
                className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                maxLength={characterLimit}
              />
              
              {/* Character Count */}
              <div className="flex justify-between items-center text-sm">
                <div className="text-gray-500">
                  {tweet.content.length} / {characterLimit}
                </div>
                <div className={`font-medium ${
                  tweet.content.length > characterLimit * 0.9 
                    ? 'text-red-500' 
                    : tweet.content.length > characterLimit * 0.8 
                      ? 'text-yellow-500' 
                      : 'text-green-500'
                }`}>
                  {characterLimit - tweet.content.length} remaining
                </div>
              </div>
            </div>

            {/* Thread Connection Indicator */}
            {index < tweets.length - 1 && (
              <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Tweet Button */}
      {tweets.length < maxTweets && (
        <button
          onClick={addTweet}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Tweet to Thread
        </button>
      )}

      {/* Thread Tips */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Thread Tips:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Start with a hook to grab attention</li>
          <li>• Keep each tweet focused on one idea</li>
          <li>• Use numbers or bullets for clarity</li>
          <li>• End with a call-to-action or question</li>
          <li>• Use arrow buttons to reorder tweets</li>
        </ul>
      </div>
    </div>
  );
}