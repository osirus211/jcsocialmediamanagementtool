import { useState, useCallback, useRef, useEffect } from 'react';
import { Tag, X, Plus, Hash } from 'lucide-react';

interface MediaTagsManagerProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onCreateTag?: (tag: string) => void;
  placeholder?: string;
  maxTags?: number;
}

export function MediaTagsManager({
  availableTags,
  selectedTags,
  onTagsChange,
  onCreateTag,
  placeholder = "Add tags...",
  maxTags = 20,
}: MediaTagsManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input and exclude already selected tags
  const suggestions = availableTags
    .filter(tag => 
      tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedTags.includes(tag)
    )
    .slice(0, 10); // Limit suggestions

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setShowSuggestions(value.length > 0);
    setFocusedIndex(-1);
  }, []);

  const handleAddTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag) && selectedTags.length < maxTags) {
      const newTags = [...selectedTags, trimmedTag];
      onTagsChange(newTags);
      
      // Create new tag if it doesn't exist
      if (!availableTags.includes(trimmedTag) && onCreateTag) {
        onCreateTag(trimmedTag);
      }
    }
    setInputValue('');
    setShowSuggestions(false);
    setFocusedIndex(-1);
  }, [selectedTags, maxTags, onTagsChange, availableTags, onCreateTag]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const newTags = selectedTags.filter(tag => tag !== tagToRemove);
    onTagsChange(newTags);
  }, [selectedTags, onTagsChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && suggestions[focusedIndex]) {
        handleAddTag(suggestions[focusedIndex]);
      } else if (inputValue.trim()) {
        handleAddTag(inputValue.trim());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setFocusedIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      // Remove last tag when backspacing on empty input
      handleRemoveTag(selectedTags[selectedTags.length - 1]);
    }
  }, [focusedIndex, suggestions, inputValue, handleAddTag, selectedTags, handleRemoveTag]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
            >
              <Hash className="w-3 h-3" />
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <div className="flex items-center border border-gray-300 rounded-lg">
          <Tag className="w-4 h-4 text-gray-400 ml-3" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(inputValue.length > 0)}
            placeholder={selectedTags.length >= maxTags ? `Max ${maxTags} tags` : placeholder}
            disabled={selectedTags.length >= maxTags}
            className="flex-1 px-3 py-2 border-0 rounded-lg focus:ring-0 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
          {inputValue && (
            <button
              onClick={() => handleAddTag(inputValue)}
              className="p-2 text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            {suggestions.map((tag, index) => (
              <button
                key={tag}
                onClick={() => handleAddTag(tag)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                  index === focusedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <Hash className="w-3 h-3 text-gray-400" />
                {tag}
              </button>
            ))}
            
            {/* Create new tag option */}
            {inputValue.trim() && !suggestions.includes(inputValue.trim()) && (
              <button
                onClick={() => handleAddTag(inputValue.trim())}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 ${
                  focusedIndex === suggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <Plus className="w-3 h-3 text-gray-400" />
                Create "{inputValue.trim()}"
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tag Count */}
      <div className="mt-2 text-xs text-gray-500">
        {selectedTags.length} / {maxTags} tags
      </div>
    </div>
  );
}