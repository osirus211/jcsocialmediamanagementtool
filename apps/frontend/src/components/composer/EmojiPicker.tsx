import { useState, useRef, useEffect, memo, useCallback } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { X } from 'lucide-react';
import './EmojiPicker.css';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

interface EmojiData {
  id: string;
  name: string;
  native: string;
  unified: string;
  keywords: string[];
  shortcodes: string;
}

const EmojiPicker = memo(function EmojiPicker({ 
  onEmojiSelect, 
  onClose, 
  isOpen, 
  theme = 'light' 
}: EmojiPickerProps) {
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [frequentEmojis, setFrequentEmojis] = useState<Record<string, number>>({});
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load recent and frequent emojis from localStorage
  useEffect(() => {
    const storedRecent = localStorage.getItem('recentEmojis');
    const storedFrequent = localStorage.getItem('frequentEmojis');
    
    if (storedRecent) {
      setRecentEmojis(JSON.parse(storedRecent));
    }
    
    if (storedFrequent) {
      setFrequentEmojis(JSON.parse(storedFrequent));
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleEmojiClick = useCallback((emojiData: EmojiData) => {
    const emoji = emojiData.native;
    onEmojiSelect(emoji);
    
    // Update recent emojis (last 20)
    const newRecent = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 20);
    setRecentEmojis(newRecent);
    localStorage.setItem('recentEmojis', JSON.stringify(newRecent));
    
    // Update frequent emojis count
    const newFrequent = { ...frequentEmojis };
    newFrequent[emoji] = (newFrequent[emoji] || 0) + 1;
    setFrequentEmojis(newFrequent);
    localStorage.setItem('frequentEmojis', JSON.stringify(newFrequent));
    
    onClose();
  }, [onEmojiSelect, recentEmojis, frequentEmojis, onClose]);

  // Get frequently used emojis (top 24 by usage count)
  const getFrequentlyUsed = useCallback(() => {
    return Object.entries(frequentEmojis)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 24)
      .map(([emoji]) => emoji);
  }, [frequentEmojis]);

  if (!isOpen) return null;

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
      style={{ width: '352px' }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900">Choose an emoji</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          title="Close emoji picker"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Emoji Mart Picker */}
      <div className="emoji-picker-container">
        <Picker
          data={data}
          onEmojiSelect={handleEmojiClick}
          theme={theme}
          set="native"
          skin={1}
          skinTonePosition="search"
          previewPosition="none"
          searchPosition="sticky"
          navPosition="bottom"
          perLine={8}
          maxFrequentRows={3}
          categories={[
            'frequent',
            'people', 
            'nature', 
            'foods', 
            'activity', 
            'places', 
            'objects', 
            'symbols', 
            'flags'
          ]}
          categoryIcons={{
            frequent: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
            },
            people: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
            },
            nature: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20m0-20C8 2 5 5 5 9s3 7 7 7 7-3 7-7-3-7-7-7z"></path></svg>'
            },
            foods: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>'
            },
            activity: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10,8 16,12 10,16 10,8"></polygon></svg>'
            },
            places: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
            },
            objects: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>'
            },
            symbols: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
            },
            flags: {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>'
            }
          }}
          custom={[
            {
              id: 'recent',
              name: 'Recently Used',
              emojis: recentEmojis.map(emoji => ({
                id: emoji,
                name: emoji,
                keywords: [],
                skins: [{ native: emoji }]
              }))
            },
            {
              id: 'frequent',
              name: 'Frequently Used',
              emojis: getFrequentlyUsed().map(emoji => ({
                id: emoji,
                name: emoji,
                keywords: [],
                skins: [{ native: emoji }]
              }))
            }
          ]}
        />
      </div>
    </div>
  );
});

export { EmojiPicker };