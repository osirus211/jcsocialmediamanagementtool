import { useState, useEffect, useCallback, useRef } from 'react';
import { MentionSuggestion } from '@/components/composer/MentionAutocomplete';
import { SocialPlatform } from '@/types/composer.types';

interface UseMentionAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  selectedPlatforms: SocialPlatform[];
  onMentionInsert: (mention: string, start: number, end: number) => void;
}

// Mock data - in real app, this would come from API
const MOCK_WORKSPACE_MEMBERS: MentionSuggestion[] = [
  {
    id: '1',
    type: 'user',
    name: 'John Doe',
    handle: 'john.doe',
    avatar: undefined,
  },
  {
    id: '2',
    type: 'user',
    name: 'Jane Smith',
    handle: 'jane.smith',
    avatar: undefined,
  },
  {
    id: '3',
    type: 'user',
    name: 'Mike Johnson',
    handle: 'mike.johnson',
    avatar: undefined,
  },
];

const MOCK_PLATFORM_HANDLES: Record<SocialPlatform, MentionSuggestion[]> = {
  twitter: [
    { id: 'tw1', type: 'handle', name: 'Twitter Support', handle: 'TwitterSupport', platform: 'Twitter' },
    { id: 'tw2', type: 'handle', name: 'Elon Musk', handle: 'elonmusk', platform: 'Twitter' },
  ],
  linkedin: [
    { id: 'li1', type: 'handle', name: 'LinkedIn', handle: 'linkedin', platform: 'LinkedIn' },
    { id: 'li2', type: 'handle', name: 'Microsoft', handle: 'microsoft', platform: 'LinkedIn' },
  ],
  instagram: [
    { id: 'ig1', type: 'handle', name: 'Instagram', handle: 'instagram', platform: 'Instagram' },
  ],
  facebook: [
    { id: 'fb1', type: 'handle', name: 'Facebook', handle: 'facebook', platform: 'Facebook' },
  ],
  threads: [
    { id: 'th1', type: 'handle', name: 'Threads', handle: 'threads', platform: 'Threads' },
  ],
  bluesky: [
    { id: 'bs1', type: 'handle', name: 'Bluesky', handle: 'bsky.app', platform: 'Bluesky' },
  ],
  youtube: [
    { id: 'yt1', type: 'handle', name: 'YouTube', handle: 'youtube', platform: 'YouTube' },
  ],
  'google-business': [
    { id: 'gb1', type: 'handle', name: 'Google', handle: 'google', platform: 'Google Business' },
  ],
  pinterest: [
    { id: 'pt1', type: 'handle', name: 'Pinterest', handle: 'pinterest', platform: 'Pinterest' },
  ],
  tiktok: [
    { id: 'tt1', type: 'handle', name: 'TikTok', handle: 'tiktok', platform: 'TikTok' },
  ],
};

export function useMentionAutocomplete({
  textareaRef,
  selectedPlatforms,
  onMentionInsert,
}: UseMentionAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Get all available suggestions
  const getAllSuggestions = useCallback(() => {
    const platformHandles = selectedPlatforms.flatMap(platform => 
      MOCK_PLATFORM_HANDLES[platform] || []
    );
    return [...MOCK_WORKSPACE_MEMBERS, ...platformHandles];
  }, [selectedPlatforms]);

  // Filter suggestions based on query
  const filterSuggestions = useCallback((query: string) => {
    const allSuggestions = getAllSuggestions();
    if (!query) return allSuggestions.slice(0, 8);

    return allSuggestions
      .filter(suggestion => 
        suggestion.name.toLowerCase().includes(query.toLowerCase()) ||
        suggestion.handle.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8);
  }, [getAllSuggestions]);

  // Calculate cursor position for dropdown
  const calculatePosition = useCallback((textarea: HTMLTextAreaElement, cursorPos: number) => {
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Create a temporary element to measure text width
    const temp = document.createElement('span');
    temp.style.font = window.getComputedStyle(textarea).font;
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.textContent = currentLine;
    document.body.appendChild(temp);
    
    const textWidth = temp.offsetWidth;
    document.body.removeChild(temp);
    
    const rect = textarea.getBoundingClientRect();
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
    
    return {
      top: rect.top + (lines.length - 1) * lineHeight + lineHeight + 4,
      left: rect.left + Math.min(textWidth, rect.width - 200), // Ensure it doesn't overflow
    };
  }, []);

  // Handle textarea input
  const handleTextareaInput = useCallback((value: string, selectionStart: number) => {
    const textBeforeCursor = value.substring(0, selectionStart);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch && textareaRef.current) {
      const query = mentionMatch[1];
      const start = selectionStart - mentionMatch[0].length;
      
      setMentionQuery(query);
      setMentionStart(start);
      setSelectedIndex(0);
      setSuggestions(filterSuggestions(query));
      setPosition(calculatePosition(textareaRef.current, selectionStart));
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [textareaRef, filterSuggestions, calculatePosition]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen || suggestions.length === 0) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return true;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return true;
      
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          handleMentionSelect(suggestions[selectedIndex]);
        }
        return true;
      
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        return true;
      
      default:
        return false;
    }
  }, [isOpen, suggestions, selectedIndex]);

  // Handle mention selection
  const handleMentionSelect = useCallback((suggestion: MentionSuggestion) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const currentValue = textarea.value;
    const mentionEnd = mentionStart + mentionQuery.length + 1; // +1 for @
    
    // Format mention based on platform
    let mentionText = `@${suggestion.handle}`;
    if (suggestion.platform === 'LinkedIn' && suggestion.type === 'handle') {
      mentionText = `@${suggestion.name}`;
    }
    
    onMentionInsert(mentionText, mentionStart, mentionEnd);
    setIsOpen(false);
    
    // Focus back to textarea and position cursor after mention
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = mentionStart + mentionText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [textareaRef, mentionStart, mentionQuery, onMentionInsert]);

  // Close on outside events
  const closeMentions = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    suggestions,
    selectedIndex,
    position,
    handleTextareaInput,
    handleKeyDown,
    handleMentionSelect,
    closeMentions,
  };
}