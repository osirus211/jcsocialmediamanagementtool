import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';

interface WorkspaceMember {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

interface MentionSuggestion {
  id: string;
  name: string;
  username: string;
  avatar?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Write a comment...',
  disabled = false,
  maxLength = 2000,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const { members, fetchMembers, currentWorkspaceId } = useWorkspaceStore();

  // Debounced member search
  useEffect(() => {
    if (!mentionQuery) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      const filtered = members
        .filter(member => {
          const user = member.userId;
          if (typeof user === 'string') return false;
          
          const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
          const firstName = user.firstName.toLowerCase();
          const lastName = user.lastName.toLowerCase();
          const query = mentionQuery.toLowerCase();
          
          return fullName.includes(query) || firstName.includes(query) || lastName.includes(query);
        })
        .slice(0, 8) // Show more suggestions
        .map(member => {
          const user = member.userId as any;
          return {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            username: `${user.firstName}${user.lastName}`,
            avatar: user.avatar,
          };
        });

      setSuggestions(filtered);
      setSelectedIndex(0);
    }, 200); // Faster response

    return () => clearTimeout(timeoutId);
  }, [mentionQuery, members]);

  // Load members on mount
  useEffect(() => {
    if (currentWorkspaceId) {
      fetchMembers(currentWorkspaceId);
    }
  }, [fetchMembers, currentWorkspaceId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);

    // Check for @ mention
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionStart(cursorPos - mentionMatch[0].length);
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
      setMentionStart(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const selectSuggestion = (suggestion: MentionSuggestion) => {
    if (mentionStart === -1) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(textarea.selectionStart);
    const newValue = `${beforeMention}@${suggestion.username} ${afterMention}`;
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery('');
    setMentionStart(-1);

    // Set cursor position after the mention
    setTimeout(() => {
      const newCursorPos = mentionStart + suggestion.username.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleSuggestionClick = (suggestion: MentionSuggestion) => {
    selectSuggestion(suggestion);
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const remainingChars = maxLength - value.length;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ minHeight: '40px', maxHeight: '120px' }}
      />
      
      {/* Character counter */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-500">
        <span className={remainingChars < 100 ? 'text-orange-500' : remainingChars < 0 ? 'text-red-500' : ''}>
          {remainingChars}
        </span>
      </div>

      {/* Mention suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
              }`}
            >
              <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                {suggestion.avatar ? (
                  <img
                    src={suggestion.avatar}
                    alt={suggestion.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-600">
                    {suggestion.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{suggestion.name}</div>
                <div className="text-xs text-gray-500">@{suggestion.username}</div>
              </div>
              {index === selectedIndex && (
                <div className="text-blue-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};