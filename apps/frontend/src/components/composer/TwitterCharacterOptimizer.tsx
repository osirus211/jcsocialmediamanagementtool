import React, { useState, useEffect, useMemo } from 'react';
import { Zap, AlertTriangle, CheckCircle, Lightbulb, Hash, AtSign } from 'lucide-react';

interface TwitterCharacterOptimizerProps {
  content: string;
  onContentChange: (content: string) => void;
  isPremium?: boolean;
  characterLimit?: number;
}

interface OptimizationSuggestion {
  type: 'shorten' | 'hashtag' | 'mention' | 'link' | 'emoji';
  original: string;
  suggestion: string;
  savings: number;
  reason: string;
}

export function TwitterCharacterOptimizer({ 
  content, 
  onContentChange, 
  isPremium = false,
  characterLimit = 280 
}: TwitterCharacterOptimizerProps) {
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [showOptimizer, setShowOptimizer] = useState(false);

  const maxLimit = isPremium ? 25000 : characterLimit;
  const warningThreshold = maxLimit * 0.8;
  const dangerThreshold = maxLimit * 0.9;

  const characterCount = content.length;
  const remaining = maxLimit - characterCount;
  const isOverLimit = characterCount > maxLimit;
  const isNearLimit = characterCount > warningThreshold;

  // Generate optimization suggestions
  const generateSuggestions = useMemo(() => {
    const suggestions: OptimizationSuggestion[] = [];

    // Common word shortenings
    const shortenings = [
      { from: 'because', to: 'bc', savings: 5 },
      { from: 'through', to: 'thru', savings: 3 },
      { from: 'without', to: 'w/o', savings: 4 },
      { from: 'between', to: 'btwn', savings: 3 },
      { from: 'something', to: 'sth', savings: 6 },
      { from: 'someone', to: 'sb', savings: 5 },
      { from: 'tomorrow', to: 'tmrw', savings: 4 },
      { from: 'tonight', to: 'tn', savings: 5 },
      { from: 'before', to: 'b4', savings: 4 },
      { from: 'you are', to: "you're", savings: 3 },
      { from: 'do not', to: "don't", savings: 3 },
      { from: 'cannot', to: "can't", savings: 3 },
      { from: 'will not', to: "won't", savings: 4 },
    ];

    shortenings.forEach(({ from, to, savings }) => {
      const regex = new RegExp(`\\b${from}\\b`, 'gi');
      if (regex.test(content)) {
        suggestions.push({
          type: 'shorten',
          original: from,
          suggestion: to,
          savings,
          reason: `Replace "${from}" with "${to}" to save ${savings} characters`
        });
      }
    });

    // Suggest removing redundant words
    const redundantPhrases = [
      { phrase: 'in order to', replacement: 'to', savings: 9 },
      { phrase: 'due to the fact that', replacement: 'because', savings: 13 },
      { phrase: 'at this point in time', replacement: 'now', savings: 17 },
      { phrase: 'for the purpose of', replacement: 'to', savings: 16 },
    ];

    redundantPhrases.forEach(({ phrase, replacement, savings }) => {
      if (content.toLowerCase().includes(phrase)) {
        suggestions.push({
          type: 'shorten',
          original: phrase,
          suggestion: replacement,
          savings,
          reason: `Replace verbose phrase with simpler alternative`
        });
      }
    });

    // Suggest hashtag optimization
    const hashtagMatches = content.match(/#\w+/g);
    if (hashtagMatches && hashtagMatches.length > 3) {
      suggestions.push({
        type: 'hashtag',
        original: hashtagMatches.join(' '),
        suggestion: hashtagMatches.slice(0, 3).join(' '),
        savings: hashtagMatches.slice(3).join(' ').length,
        reason: 'Use 2-3 hashtags for better engagement'
      });
    }

    // Suggest emoji usage for common words
    const emojiReplacements = [
      { word: 'fire', emoji: '🔥', savings: 3 },
      { word: 'heart', emoji: '❤️', savings: 4 },
      { word: 'star', emoji: '⭐', savings: 3 },
      { word: 'money', emoji: '💰', savings: 4 },
      { word: 'time', emoji: '⏰', savings: 3 },
      { word: 'rocket', emoji: '🚀', savings: 5 },
      { word: 'thumbs up', emoji: '👍', savings: 8 },
    ];

    emojiReplacements.forEach(({ word, emoji, savings }) => {
      if (content.toLowerCase().includes(word)) {
        suggestions.push({
          type: 'emoji',
          original: word,
          suggestion: emoji,
          savings,
          reason: `Replace "${word}" with ${emoji} emoji`
        });
      }
    });

    return suggestions;
  }, [content]);

  useEffect(() => {
    setSuggestions(generateSuggestions);
  }, [generateSuggestions]);

  const applySuggestion = (suggestion: OptimizationSuggestion) => {
    const newContent = content.replace(
      new RegExp(suggestion.original, 'gi'),
      suggestion.suggestion
    );
    onContentChange(newContent);
  };

  const getStatusColor = () => {
    if (isOverLimit) return 'text-red-500';
    if (isNearLimit) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (isOverLimit) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (isNearLimit) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const totalPotentialSavings = suggestions.reduce((total, s) => total + s.savings, 0);

  return (
    <div className="space-y-3">
      {/* Character Counter */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`font-medium ${getStatusColor()}`}>
            {characterCount} / {maxLimit.toLocaleString()}
          </span>
          {isPremium && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              Premium
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          {remaining >= 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over limit`}
        </div>
      </div>

      {/* Character Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            isOverLimit 
              ? 'bg-red-500' 
              : isNearLimit 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
          }`}
          style={{ width: `${Math.min((characterCount / maxLimit) * 100, 100)}%` }}
        />
      </div>

      {/* Optimization Suggestions */}
      {(isNearLimit || suggestions.length > 0) && (
        <div className="border rounded-lg">
          <button
            onClick={() => setShowOptimizer(!showOptimizer)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-gray-700">
                Character Optimizer
              </span>
              {suggestions.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                  {suggestions.length} suggestions
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Save up to {totalPotentialSavings} characters
            </div>
          </button>

          {showOptimizer && (
            <div className="border-t p-3 space-y-3">
              {suggestions.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No optimization suggestions available</p>
                  <p className="text-sm">Your content is already well-optimized!</p>
                </div>
              ) : (
                suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {suggestion.type === 'hashtag' && <Hash className="h-4 w-4 text-blue-500" />}
                      {suggestion.type === 'mention' && <AtSign className="h-4 w-4 text-green-500" />}
                      {suggestion.type === 'shorten' && <Zap className="h-4 w-4 text-purple-500" />}
                      {suggestion.type === 'emoji' && <span className="text-sm">😊</span>}
                      {suggestion.type === 'link' && <span className="text-sm">🔗</span>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 mb-1">{suggestion.reason}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                          {suggestion.original}
                        </span>
                        <span>→</span>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                          {suggestion.suggestion}
                        </span>
                        <span className="text-blue-600 font-medium">
                          -{suggestion.savings} chars
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => applySuggestion(suggestion)}
                      className="flex-shrink-0 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                ))
              )}

              {/* Quick Tips */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-700 mb-2">Quick Tips:</h4>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Use contractions (don't, won't, can't)</li>
                  <li>• Replace common words with emojis</li>
                  <li>• Remove unnecessary adjectives and adverbs</li>
                  <li>• Use abbreviations for common phrases</li>
                  <li>• Break long tweets into threads</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}