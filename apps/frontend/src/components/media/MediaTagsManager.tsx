import { useState, useCallback, useRef, useEffect } from 'react';
import { Tag, X, Plus, Hash, Search, TrendingUp, Filter } from 'lucide-react';

export interface TagCloudItem {
  tag: string;
  count: number;
  percentage: number;
}

interface MediaTagsManagerProps {
  availableTags: string[];
  selectedTags: string[];
  tagCloud?: TagCloudItem[];
  mostUsedTags?: TagCloudItem[];
  onTagsChange: (tags: string[]) => void;
  onCreateTag?: (tag: string) => void;
  onTagSearch?: (query: string) => Promise<TagCloudItem[]>;
  onTagClick?: (tag: string) => void;
  placeholder?: string;
  maxTags?: number;
  showTagCloud?: boolean;
  showMostUsed?: boolean;
  allowBulkOperations?: boolean;
}

export function MediaTagsManager({
  availableTags,
  selectedTags,
  tagCloud = [],
  mostUsedTags = [],
  onTagsChange,
  onCreateTag,
  onTagSearch,
  onTagClick,
  placeholder = "Add tags...",
  maxTags = 20,
  showTagCloud = false,
  showMostUsed = true,
  allowBulkOperations = false,
}: MediaTagsManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState<TagCloudItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeView, setActiveView] = useState<'input' | 'cloud' | 'popular'>('input');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input and exclude already selected tags
  const suggestions = availableTags
    .filter(tag => 
      tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedTags.includes(tag)
    )
    .slice(0, 10); // Limit suggestions

  // Combine suggestions with search results
  const allSuggestions = searchResults.length > 0 ? searchResults : suggestions.map(tag => ({ tag, count: 0, percentage: 0 }));

  const handleInputChange = useCallback(async (value: string) => {
    setInputValue(value);
    setShowSuggestions(value.length > 0);
    setFocusedIndex(-1);

    if (value.length > 1 && onTagSearch) {
      setIsSearching(true);
      try {
        const results = await onTagSearch(value);
        setSearchResults(results.filter(item => !selectedTags.includes(item.tag)));
      } catch (error) {
        console.error('Tag search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  }, [onTagSearch, selectedTags]);

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
    setSearchResults([]);
  }, [selectedTags, maxTags, onTagsChange, availableTags, onCreateTag]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const newTags = selectedTags.filter(tag => tag !== tagToRemove);
    onTagsChange(newTags);
  }, [selectedTags, onTagsChange]);

  const handleTagClick = useCallback((tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    } else {
      handleAddTag(tag);
    }
  }, [onTagClick, handleAddTag]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && allSuggestions[focusedIndex]) {
        handleAddTag(allSuggestions[focusedIndex].tag);
      } else if (inputValue.trim()) {
        handleAddTag(inputValue.trim());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, allSuggestions.length - 1));
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
  }, [focusedIndex, allSuggestions, inputValue, handleAddTag, selectedTags, handleRemoveTag]);

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

  const getTagSize = (count: number, maxCount: number): string => {
    if (maxCount === 0) return 'text-sm';
    const ratio = count / maxCount;
    if (ratio > 0.8) return 'text-lg font-semibold';
    if (ratio > 0.6) return 'text-base font-medium';
    if (ratio > 0.4) return 'text-sm font-medium';
    return 'text-sm';
  };

  const maxCount = Math.max(...tagCloud.map(t => t.count), ...mostUsedTags.map(t => t.count));

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      {(showTagCloud || showMostUsed) && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setActiveView('input')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeView === 'input' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Tag className="w-4 h-4 inline mr-1" />
            Add Tags
          </button>
          {showMostUsed && (
            <button
              onClick={() => setActiveView('popular')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeView === 'popular' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Popular
            </button>
          )}
          {showTagCloud && (
            <button
              onClick={() => setActiveView('cloud')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeView === 'cloud' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Hash className="w-4 h-4 inline mr-1" />
              Tag Cloud
            </button>
          )}
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm rounded-full"
            >
              <Hash className="w-3 h-3" />
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:bg-blue-200 rounded-full p-0.5 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input View */}
      {activeView === 'input' && (
        <div className="relative">
          <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
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
            {isSearching && (
              <div className="px-3">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
            )}
            {inputValue && !isSearching && (
              <button
                onClick={() => handleAddTag(inputValue)}
                className="p-2 text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && allSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {allSuggestions.map((item, index) => (
                <button
                  key={item.tag}
                  onClick={() => handleAddTag(item.tag)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                    index === focusedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Hash className="w-3 h-3 text-gray-400" />
                    {item.tag}
                  </div>
                  {item.count > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
              
              {/* Create new tag option */}
              {inputValue.trim() && !allSuggestions.some(item => item.tag === inputValue.trim()) && (
                <button
                  onClick={() => handleAddTag(inputValue.trim())}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 ${
                    focusedIndex === allSuggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <Plus className="w-3 h-3 text-gray-400" />
                  Create "{inputValue.trim()}"
                </button>
              )}
            </div>
          )}

          {/* Tag Count */}
          <div className="mt-2 text-xs text-gray-500">
            {selectedTags.length} / {maxTags} tags
          </div>
        </div>
      )}

      {/* Popular Tags View */}
      {activeView === 'popular' && showMostUsed && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Most Used Tags</h4>
          {mostUsedTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mostUsedTags.slice(0, 20).map((item) => (
                <button
                  key={item.tag}
                  onClick={() => handleTagClick(item.tag)}
                  disabled={selectedTags.includes(item.tag)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all hover:scale-105 ${
                    selectedTags.includes(item.tag)
                      ? 'bg-blue-600 text-white cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {item.tag}
                  <span className="text-xs opacity-75 bg-white bg-opacity-20 px-1.5 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No popular tags yet</p>
          )}
        </div>
      )}

      {/* Tag Cloud View */}
      {activeView === 'cloud' && showTagCloud && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Tag Cloud</h4>
          {tagCloud.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tagCloud.slice(0, 50).map((item) => (
                <button
                  key={item.tag}
                  onClick={() => handleTagClick(item.tag)}
                  disabled={selectedTags.includes(item.tag)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full transition-all hover:scale-105 ${
                    selectedTags.includes(item.tag)
                      ? 'bg-blue-600 text-white cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${getTagSize(item.count, maxCount)}`}
                >
                  <Hash className="w-3 h-3" />
                  {item.tag}
                  <span className="text-xs opacity-75">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No tags in your library yet</p>
          )}
        </div>
      )}
    </div>
  );
}