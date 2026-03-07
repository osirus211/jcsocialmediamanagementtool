import { useState } from 'react';
import { AIAssistant } from './AIAssistant';

interface PostEditorProps {
  value: string;
  onChange: (content: string) => void;
  maxLength?: number;
  platform?: string;
}

export function PostEditor({ value, onChange, maxLength = 280, platform }: PostEditorProps) {
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const characterCount = value.length;
  const isOverLimit = characterCount > maxLength;

  const handleAIInsert = (content: string) => {
    onChange(content);
    setShowAIAssistant(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Post Content
          </label>
          <button
            type="button"
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
          >
            ✨ AI Assistant
          </button>
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What's on your mind?"
          rows={6}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
            isOverLimit ? 'border-red-500' : ''
          }`}
          required
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500">
            Hashtags and mentions will be auto-detected
          </span>
          <span
            className={`text-sm ${
              isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'
            }`}
          >
            {characterCount} / {maxLength}
          </span>
        </div>
      </div>

      {/* AI Assistant Panel */}
      {showAIAssistant && (
        <AIAssistant
          currentContent={value}
          platform={platform}
          onInsert={handleAIInsert}
          onClose={() => setShowAIAssistant(false)}
        />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Media (Optional)
        </label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <p className="text-gray-500 text-sm">
            Media upload coming soon
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Support for images and videos
          </p>
        </div>
      </div>
    </div>
  );
}
