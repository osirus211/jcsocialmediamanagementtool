/**
 * Mastodon Composer Component
 * Enhanced composer with Mastodon-specific features
 */

import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, AlertTriangle, Globe, Users, Lock, Mail, BarChart3, Clock, Plus, X } from 'lucide-react';

interface MastodonComposerProps {
  content: string;
  onContentChange: (content: string) => void;
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  onVisibilityChange?: (visibility: 'public' | 'unlisted' | 'private' | 'direct') => void;
  sensitive?: boolean;
  onSensitiveChange?: (sensitive: boolean) => void;
  spoilerText?: string;
  onSpoilerTextChange?: (spoilerText: string) => void;
  language?: string;
  onLanguageChange?: (language: string) => void;
  poll?: {
    options: string[];
    expiresIn: number;
    multiple: boolean;
    hideTotals: boolean;
  };
  onPollChange?: (poll?: {
    options: string[];
    expiresIn: number;
    multiple: boolean;
    hideTotals: boolean;
  }) => void;
  maxLength?: number;
}

const MASTODON_LIMIT = 500;

const visibilityOptions = [
  {
    value: 'public' as const,
    label: 'Public',
    icon: Globe,
    description: 'Visible to everyone and appears in public timelines'
  },
  {
    value: 'unlisted' as const,
    label: 'Unlisted',
    icon: Eye,
    description: 'Visible to everyone but not in public timelines'
  },
  {
    value: 'private' as const,
    label: 'Followers only',
    icon: Users,
    description: 'Only visible to your followers'
  },
  {
    value: 'direct' as const,
    label: 'Direct',
    icon: Mail,
    description: 'Only visible to mentioned users'
  }
];

const pollDurations = [
  { value: 300, label: '5 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 21600, label: '6 hours' },
  { value: 86400, label: '1 day' },
  { value: 259200, label: '3 days' },
  { value: 604800, label: '7 days' }
];

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' }
];

export const MastodonComposer: React.FC<MastodonComposerProps> = ({
  content,
  onContentChange,
  visibility = 'public',
  onVisibilityChange,
  sensitive = false,
  onSensitiveChange,
  spoilerText = '',
  onSpoilerTextChange,
  language = 'en',
  onLanguageChange,
  poll,
  onPollChange,
  maxLength = MASTODON_LIMIT,
}) => {
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const isOverLimit = content.length > maxLength;
  const remainingChars = maxLength - content.length;

  const handleVisibilityChange = useCallback((newVisibility: typeof visibility) => {
    if (onVisibilityChange) {
      onVisibilityChange(newVisibility);
    }
  }, [onVisibilityChange]);

  const handleSensitiveToggle = useCallback(() => {
    if (onSensitiveChange) {
      onSensitiveChange(!sensitive);
    }
  }, [sensitive, onSensitiveChange]);

  const handleSpoilerTextChange = useCallback((text: string) => {
    if (onSpoilerTextChange) {
      onSpoilerTextChange(text);
    }
  }, [onSpoilerTextChange]);

  const handleLanguageChange = useCallback((newLanguage: string) => {
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
    }
  }, [onLanguageChange]);

  const createPoll = useCallback(() => {
    if (onPollChange) {
      onPollChange({
        options: ['', ''],
        expiresIn: 86400, // 1 day
        multiple: false,
        hideTotals: false
      });
    }
    setShowPollCreator(true);
  }, [onPollChange]);

  const updatePollOption = useCallback((index: number, value: string) => {
    if (poll && onPollChange) {
      const newOptions = [...poll.options];
      newOptions[index] = value;
      onPollChange({
        ...poll,
        options: newOptions
      });
    }
  }, [poll, onPollChange]);

  const addPollOption = useCallback(() => {
    if (poll && onPollChange && poll.options.length < 4) {
      onPollChange({
        ...poll,
        options: [...poll.options, '']
      });
    }
  }, [poll, onPollChange]);

  const removePollOption = useCallback((index: number) => {
    if (poll && onPollChange && poll.options.length > 2) {
      const newOptions = poll.options.filter((_, i) => i !== index);
      onPollChange({
        ...poll,
        options: newOptions
      });
    }
  }, [poll, onPollChange]);

  const removePoll = useCallback(() => {
    if (onPollChange) {
      onPollChange(undefined);
    }
    setShowPollCreator(false);
  }, [onPollChange]);

  const selectedVisibility = visibilityOptions.find(opt => opt.value === visibility);

  return (
    <div className="space-y-4">
      {/* Visibility Selector */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Visibility:</span>
        <div className="flex gap-1">
          {visibilityOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleVisibilityChange(value)}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                visibility === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              title={visibilityOptions.find(opt => opt.value === value)?.description}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Warning */}
      {sensitive && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Content Warning</span>
            <button
              onClick={handleSensitiveToggle}
              className="ml-auto p-1 hover:bg-orange-100 rounded"
            >
              <X className="h-4 w-4 text-orange-600" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Describe what people might want to be warned about..."
            value={spoilerText}
            onChange={(e) => handleSpoilerTextChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            maxLength={100}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={
            sensitive && spoilerText
              ? 'Write your toot content (hidden behind content warning)...'
              : 'What\'s happening?'
          }
          className={`w-full p-4 border rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
            isOverLimit ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
          }`}
          rows={4}
        />
        
        {/* Character Counter */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <div className={`text-sm ${
            isOverLimit ? 'text-red-600 font-semibold' : 
            remainingChars < 50 ? 'text-orange-600' : 'text-gray-500'
          }`}>
            {remainingChars}
          </div>
        </div>
      </div>

      {/* Poll Creator */}
      {poll && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Poll</span>
            </div>
            <button
              onClick={removePoll}
              className="p-1 hover:bg-blue-100 rounded"
            >
              <X className="h-4 w-4 text-blue-600" />
            </button>
          </div>
          
          <div className="space-y-2 mb-3">
            {poll.options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => updatePollOption(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  maxLength={50}
                />
                {poll.options.length > 2 && (
                  <button
                    onClick={() => removePollOption(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            
            {poll.options.length < 4 && (
              <button
                onClick={addPollOption}
                className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded text-sm"
              >
                <Plus className="h-4 w-4" />
                Add option
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <select
                value={poll.expiresIn}
                onChange={(e) => onPollChange && onPollChange({
                  ...poll,
                  expiresIn: parseInt(e.target.value)
                })}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {pollDurations.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={poll.multiple}
                onChange={(e) => onPollChange && onPollChange({
                  ...poll,
                  multiple: e.target.checked
                })}
                className="rounded"
              />
              <span>Multiple choice</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={poll.hideTotals}
                onChange={(e) => onPollChange && onPollChange({
                  ...poll,
                  hideTotals: e.target.checked
                })}
                className="rounded"
              />
              <span>Hide totals</span>
            </label>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!sensitive && (
            <button
              onClick={handleSensitiveToggle}
              className="flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
              title="Add content warning"
            >
              <AlertTriangle className="h-4 w-4" />
              CW
            </button>
          )}
          
          {!poll && (
            <button
              onClick={createPoll}
              className="flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
              title="Create poll"
            >
              <BarChart3 className="h-4 w-4" />
              Poll
            </button>
          )}
          
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
          >
            Advanced
          </button>
        </div>

        <div className="text-xs text-gray-500">
          {selectedVisibility?.label} • {language.toUpperCase()}
        </div>
      </div>

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {languages.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Mastodon Features Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>• Character limit: {maxLength} characters (instance may vary)</div>
        <div>• Content warnings help create a safer space</div>
        <div>• Polls can have 2-4 options and last up to 1 month</div>
        <div>• Visibility controls who can see your toot</div>
      </div>
    </div>
  );
};