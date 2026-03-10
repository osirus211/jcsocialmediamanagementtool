/**
 * Calendar Auto-Fill Modal
 * Multi-step wizard for AI-powered calendar content generation
 */

import React, { useState, useEffect } from 'react';
import { Loader2, Calendar, Clock, Hash, X, CheckSquare, Square, Sparkles } from 'lucide-react';
import { aiService, GenerateCalendarInput, GeneratedPost } from '@/services/ai.service';
import { PostService, CreatePostInput } from '@/services/post.service';
import { toast } from '@/lib/notifications';

interface CalendarAutoFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedAccounts?: Array<{
    id: string;
    platform: string;
    username: string;
  }>;
}

type Step = 'configure' | 'review' | 'done';

// Helper functions for date formatting
const formatDateForInput = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDisplayDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDisplayTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export const CalendarAutoFillModal: React.FC<CalendarAutoFillModalProps> = ({
  isOpen,
  onClose,
  connectedAccounts = [],
}) => {
  const [step, setStep] = useState<Step>('configure');
  const [loading, setLoading] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());
  const [scheduledCount, setScheduledCount] = useState(0);

  // Configuration state
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return formatDateForInput(tomorrow);
  });
  const [endDate, setEndDate] = useState(() => {
    const nextWeek = addDays(new Date(), 7);
    return formatDateForInput(nextWeek);
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [tone, setTone] = useState<string>('casual');
  const [topics, setTopics] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      setGeneratedPosts([]);
      setSelectedPosts(new Set());
      setScheduledCount(0);
      // Auto-select platforms from connected accounts
      const platforms = new Set(connectedAccounts.map(acc => acc.platform));
      setSelectedPlatforms(platforms);
    }
  }, [isOpen, connectedAccounts]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleGenerate = async () => {
    if (selectedPlatforms.size === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setLoading(true);
    try {
      const input: GenerateCalendarInput = {
        startDate,
        endDate,
        platforms: Array.from(selectedPlatforms),
        postsPerDay: postsPerDay,
        topics: topics.trim() ? topics.split(',').map(t => t.trim()) : undefined,
        tone: tone as any,
      };

      const result = await aiService.generateCalendarPosts(input);
      setGeneratedPosts(result.posts);
      
      // Select all posts by default
      const allIndices = new Set(result.posts.map((_, index) => index));
      setSelectedPosts(allIndices);
      
      setStep('review');
      toast.success(`Generated ${result.totalGenerated} posts!`);
    } catch (error) {
      console.error('Failed to generate calendar posts:', error);
      toast.error('Failed to generate posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePosts = async () => {
    const postsToSchedule = generatedPosts.filter((_, index) => selectedPosts.has(index));
    
    if (postsToSchedule.length === 0) {
      toast.error('Please select at least one post to schedule');
      return;
    }

    setLoading(true);
    try {
      // Find social account IDs for each platform
      const postInputs = postsToSchedule.map(post => {
        const account = connectedAccounts.find(acc => acc.platform === post.platform);
        if (!account) {
          throw new Error(`No connected account found for ${post.platform}`);
        }

        return {
          workspaceId: '', // Will be set by backend
          socialAccountId: account.id,
          platform: post.platform,
          content: `${post.content}\n\n${post.hashtags.join(' ')}`,
          scheduledAt: new Date(post.scheduledAt),
        } as CreatePostInput;
      });

      await PostService.bulkCreatePosts(postInputs);
      setScheduledCount(postsToSchedule.length);
      setStep('done');
      toast.success(`Successfully scheduled ${postsToSchedule.length} posts!`);
    } catch (error) {
      console.error('Failed to schedule posts:', error);
      toast.error('Failed to schedule posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePostSelection = (index: number) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPosts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === generatedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(generatedPosts.map((_, index) => index)));
    }
  };

  const updatePostContent = (index: number, content: string) => {
    const updated = [...generatedPosts];
    updated[index] = { ...updated[index], content };
    setGeneratedPosts(updated);
  };

  const removePost = (index: number) => {
    const updated = generatedPosts.filter((_, i) => i !== index);
    setGeneratedPosts(updated);
    
    // Update selected posts indices
    const newSelected = new Set<number>();
    selectedPosts.forEach(selectedIndex => {
      if (selectedIndex < index) {
        newSelected.add(selectedIndex);
      } else if (selectedIndex > index) {
        newSelected.add(selectedIndex - 1);
      }
    });
    setSelectedPosts(newSelected);
  };

  const renderConfigureStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
        <div className="grid grid-cols-2 gap-2">
          {connectedAccounts.map((account) => (
            <div key={account.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={account.platform}
                checked={selectedPlatforms.has(account.platform)}
                onChange={(e) => {
                  const newPlatforms = new Set(selectedPlatforms);
                  if (e.target.checked) {
                    newPlatforms.add(account.platform);
                  } else {
                    newPlatforms.delete(account.platform);
                  }
                  setSelectedPlatforms(newPlatforms);
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={account.platform} className="text-sm text-gray-700 capitalize">
                {account.platform} (@{account.username})
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Posts per Day: {postsPerDay}
        </label>
        <input
          type="range"
          min="1"
          max="5"
          value={postsPerDay}
          onChange={(e) => setPostsPerDay(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div>
        <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-1">
          Tone
        </label>
        <select
          id="tone"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="humorous">Humorous</option>
          <option value="inspirational">Inspirational</option>
        </select>
      </div>

      <div>
        <label htmlFor="topics" className="block text-sm font-medium text-gray-700 mb-1">
          Topics (optional)
        </label>
        <textarea
          id="topics"
          placeholder="What topics should we cover? (comma-separated)"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <button 
        onClick={handleGenerate} 
        disabled={loading || selectedPlatforms.size === 0}
        className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ✨ Generating posts...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            ✨ Generate Posts
          </>
        )}
      </button>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {selectedPosts.size === generatedPosts.length ? (
              <CheckSquare className="w-4 h-4 mr-1" />
            ) : (
              <Square className="w-4 h-4 mr-1" />
            )}
            {selectedPosts.size === generatedPosts.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm text-gray-600">
            {selectedPosts.size} posts selected
          </span>
        </div>
        <button 
          onClick={() => setStep('configure')} 
          className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3">
        {generatedPosts.map((post, index) => (
          <div 
            key={index} 
            className={`relative border rounded-lg p-4 ${selectedPosts.has(index) ? 'ring-2 ring-purple-500 border-purple-200' : 'border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedPosts.has(index)}
                  onChange={() => togglePostSelection(index)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                  {post.platform}
                </span>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDisplayDate(new Date(post.scheduledAt))}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDisplayTime(new Date(post.scheduledAt))}
                </div>
              </div>
              <button
                onClick={() => removePost(index)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-3">
              <textarea
                value={post.content}
                onChange={(e) => updatePostContent(index, e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <div className="flex items-center space-x-1 flex-wrap">
                <Hash className="w-3 h-3 text-gray-400" />
                {post.hashtags.map((hashtag, hashIndex) => (
                  <span key={hashIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {hashtag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={handleSchedulePosts}
        disabled={loading || selectedPosts.size === 0}
        className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Scheduling posts...
          </>
        ) : (
          `Schedule ${selectedPosts.size} Selected Posts`
        )}
      </button>
    </div>
  );

  const renderDoneStep = () => (
    <div className="text-center space-y-4">
      <div className="text-6xl">✅</div>
      <h3 className="text-lg font-semibold text-gray-900">
        {scheduledCount} posts scheduled!
      </h3>
      <p className="text-gray-600">
        Your posts have been added to the calendar and will be published at the scheduled times.
      </p>
      <div className="flex space-x-2">
        <button 
          onClick={onClose} 
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          View in Calendar
        </button>
        <button 
          onClick={onClose} 
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            ✨ Auto-fill Calendar
            {step === 'configure' && ' - Configure'}
            {step === 'review' && ' - Review & Edit'}
            {step === 'done' && ' - Complete'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {step === 'configure' && renderConfigureStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'done' && renderDoneStep()}
        </div>
      </div>
    </div>
  );
};