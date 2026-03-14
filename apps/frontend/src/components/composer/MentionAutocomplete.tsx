import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { User, AtSign, Building2 } from 'lucide-react';

interface MentionSuggestion {
  id: string;
  type: 'user' | 'handle';
  name: string;
  handle: string;
  avatar?: string;
  platform?: string;
}

interface MentionAutocompleteProps {
  isOpen: boolean;
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: MentionSuggestion) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const MentionAutocomplete = memo(function MentionAutocomplete({
  isOpen,
  suggestions,
  selectedIndex,
  onSelect,
  onClose,
  position,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto min-w-64"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
            index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
          }`}
        >
          {/* Avatar */}
          <div className="flex-shrink-0">
            {suggestion.avatar ? (
              <img
                src={suggestion.avatar}
                alt={suggestion.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                {suggestion.type === 'user' ? (
                  <User className="h-4 w-4 text-gray-500" />
                ) : (
                  <Building2 className="h-4 w-4 text-gray-500" />
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">
                {suggestion.name}
              </span>
              {suggestion.platform && (
                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {suggestion.platform}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <AtSign className="h-3 w-3" />
              <span className="truncate">{suggestion.handle}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

export { MentionAutocomplete, type MentionSuggestion };