import React, { useState, useCallback } from 'react';
import { Plus, X, BarChart3, Clock, Users } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
}

interface TwitterPollData {
  options: PollOption[];
  durationMinutes: number;
}

interface TwitterPollComposerProps {
  onPollChange: (poll: TwitterPollData) => void;
  maxOptions?: number;
  maxOptionLength?: number;
}

export function TwitterPollComposer({ 
  onPollChange, 
  maxOptions = 4, 
  maxOptionLength = 25 
}: TwitterPollComposerProps) {
  const [options, setOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' }
  ]);
  const [duration, setDuration] = useState<number>(1440); // 24 hours in minutes

  const updatePoll = useCallback(() => {
    onPollChange({
      options: options.filter(opt => opt.text.trim() !== ''),
      durationMinutes: duration
    });
  }, [options, duration, onPollChange]);

  const updateOption = useCallback((id: string, text: string) => {
    const updatedOptions = options.map(option => 
      option.id === id ? { ...option, text } : option
    );
    setOptions(updatedOptions);
    
    // Update poll data
    setTimeout(() => {
      onPollChange({
        options: updatedOptions.filter(opt => opt.text.trim() !== ''),
        durationMinutes: duration
      });
    }, 0);
  }, [options, duration, onPollChange]);

  const addOption = useCallback(() => {
    if (options.length >= maxOptions) return;
    
    const newOption: PollOption = {
      id: Date.now().toString(),
      text: ''
    };
    
    const updatedOptions = [...options, newOption];
    setOptions(updatedOptions);
  }, [options, maxOptions]);

  const removeOption = useCallback((id: string) => {
    if (options.length <= 2) return;
    
    const updatedOptions = options.filter(option => option.id !== id);
    setOptions(updatedOptions);
    
    // Update poll data
    setTimeout(() => {
      onPollChange({
        options: updatedOptions.filter(opt => opt.text.trim() !== ''),
        durationMinutes: duration
      });
    }, 0);
  }, [options, duration, onPollChange]);

  const updateDuration = useCallback((newDuration: number) => {
    setDuration(newDuration);
    onPollChange({
      options: options.filter(opt => opt.text.trim() !== ''),
      durationMinutes: newDuration
    });
  }, [options, onPollChange]);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours`;
    return `${Math.floor(minutes / 1440)} days`;
  };

  const getDurationPresets = () => [
    { label: '5 minutes', value: 5 },
    { label: '1 hour', value: 60 },
    { label: '6 hours', value: 360 },
    { label: '1 day', value: 1440 },
    { label: '3 days', value: 4320 },
    { label: '7 days', value: 10080 }
  ];

  const getValidOptions = () => options.filter(opt => opt.text.trim() !== '');

  return (
    <div className="space-y-4">
      {/* Poll Header */}
      <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
        <BarChart3 className="h-5 w-5 text-purple-600" />
        <h3 className="font-medium text-purple-800">Twitter Poll</h3>
      </div>

      {/* Poll Options */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Poll Options (2-{maxOptions} options)
        </label>
        
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
              {String.fromCharCode(65 + index)}
            </div>
            
            <div className="flex-1">
              <input
                type="text"
                value={option.text}
                onChange={(e) => updateOption(option.id, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                maxLength={maxOptionLength}
              />
              <div className="mt-1 text-xs text-gray-500">
                {option.text.length} / {maxOptionLength} characters
              </div>
            </div>
            
            {options.length > 2 && (
              <button
                onClick={() => removeOption(option.id)}
                className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        
        {/* Add Option Button */}
        {options.length < maxOptions && (
          <button
            onClick={addOption}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Option
          </button>
        )}
      </div>

      {/* Poll Duration */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Poll Duration
        </label>
        
        {/* Duration Presets */}
        <div className="grid grid-cols-3 gap-2">
          {getDurationPresets().map((preset) => (
            <button
              key={preset.value}
              onClick={() => updateDuration(preset.value)}
              className={`p-2 text-sm rounded-lg border transition-colors ${
                duration === preset.value
                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        {/* Custom Duration */}
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-gray-500" />
          <input
            type="range"
            min="5"
            max="10080"
            step="5"
            value={duration}
            onChange={(e) => updateDuration(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm text-gray-600 min-w-0">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Poll Preview */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Poll Preview
        </h4>
        
        <div className="space-y-2">
          {getValidOptions().map((option, index) => (
            <div key={option.id} className="flex items-center gap-3 p-2 bg-white rounded border">
              <div className="w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              </div>
              <span className="text-sm text-gray-700">{option.text || `Option ${index + 1}`}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
          <span>0 votes</span>
          <span>{formatDuration(duration)} remaining</span>
        </div>
      </div>

      {/* Poll Guidelines */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-700 mb-2">Poll Guidelines:</h4>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>• Keep options clear and concise</li>
          <li>• Avoid leading or biased language</li>
          <li>• Consider all possible answers</li>
          <li>• Longer polls get more participation</li>
          <li>• Engage with voters in replies</li>
        </ul>
      </div>
    </div>
  );
}