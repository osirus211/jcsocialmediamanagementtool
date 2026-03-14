import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Search, Smile, Heart, Zap, Coffee, Car, Flag, Music } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'recent',
    name: 'Recent',
    icon: <Smile className="h-4 w-4" />,
    emojis: [], // Will be populated from localStorage
  },
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: <Smile className="h-4 w-4" />,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒',
      '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕',
      '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
      '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩',
      '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
    ],
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: <Heart className="h-4 w-4" />,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵',
      '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
      '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎',
      '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅',
      '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖',
      '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢'
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: <Coffee className="h-4 w-4" />,
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
      '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐',
      '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭',
      '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜',
      '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
      '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯'
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: <Zap className="h-4 w-4" />,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿',
      '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺',
      '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️',
      '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆',
      '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🤹‍♀️', '🤹‍♂️', '🎭', '🩰', '🎨'
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: <Car className="h-4 w-4" />,
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵',
      '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🪂', '💺', '🚀', '🛰️', '🚉', '🚊', '🚝', '🚞',
      '🚋', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '🚁', '🚟', '🚠',
      '🚡', '⛴️', '🚤', '🛥️', '🛳️', '⛵', '🚣', '🚣‍♀️', '🚣‍♂️', '🏊', '🏊‍♀️', '🏊‍♂️', '⚓', '🪝', '⛽', '🚨',
      '🚥', '🚦', '🛑', '🚧', '⚠️', '🚸', '⛔', '🚫', '🚳', '🚭', '🚯', '🚱', '🚷', '📵', '🔞', '☢️'
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: <Music className="h-4 w-4" />,
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼',
      '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
      '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸',
      '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️',
      '🪓', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️'
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: <Flag className="h-4 w-4" />,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
      '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴',
      '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲'
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: <Flag className="h-4 w-4" />,
    emojis: [
      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮',
      '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯',
      '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨',
      '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮'
    ],
  },
];

const EmojiPicker = memo(function EmojiPicker({ onEmojiSelect, onClose, isOpen }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load recent emojis from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentEmojis');
    if (stored) {
      setRecentEmojis(JSON.parse(stored));
    }
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

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

  const handleEmojiClick = useCallback((emoji: string) => {
    onEmojiSelect(emoji);
    
    // Add to recent emojis
    const newRecent = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 24);
    setRecentEmojis(newRecent);
    localStorage.setItem('recentEmojis', JSON.stringify(newRecent));
    
    onClose();
  }, [onEmojiSelect, recentEmojis, onClose]);

  // Filter emojis based on search
  const getFilteredEmojis = useCallback((category: EmojiCategory) => {
    if (category.id === 'recent') {
      return recentEmojis;
    }

    if (!searchQuery) {
      return category.emojis;
    }

    // Simple emoji search by common names
    const emojiNames: Record<string, string[]> = {
      '😀': ['grinning', 'smile', 'happy'],
      '😃': ['smiley', 'smile', 'happy'],
      '😄': ['smile', 'happy', 'joy'],
      '😁': ['grin', 'smile', 'happy'],
      '😆': ['laughing', 'satisfied', 'happy'],
      '😅': ['sweat_smile', 'happy', 'relief'],
      '🤣': ['rofl', 'laughing', 'funny'],
      '😂': ['joy', 'tears', 'laughing'],
      '❤️': ['heart', 'love', 'red'],
      '💙': ['blue_heart', 'love', 'blue'],
      '💚': ['green_heart', 'love', 'green'],
      '💛': ['yellow_heart', 'love', 'yellow'],
      '💜': ['purple_heart', 'love', 'purple'],
      '🔥': ['fire', 'hot', 'flame'],
      '💯': ['hundred', '100', 'perfect'],
      '👍': ['thumbs_up', 'like', 'good'],
      '👎': ['thumbs_down', 'dislike', 'bad'],
      '🎉': ['party', 'celebration', 'confetti'],
      '🚀': ['rocket', 'space', 'launch'],
    };

    return category.emojis.filter(emoji => {
      const names = emojiNames[emoji] || [];
      return names.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [searchQuery, recentEmojis]);

  // Update recent category with actual recent emojis
  const categoriesWithRecent = EMOJI_CATEGORIES.map(cat => 
    cat.id === 'recent' ? { ...cat, emojis: recentEmojis } : cat
  );

  if (!isOpen) return null;

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full mb-2 left-0 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {categoriesWithRecent.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`flex-shrink-0 p-2 border-b-2 transition-colors ${
              activeCategory === category.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            title={category.name}
          >
            {category.icon}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="h-64 overflow-y-auto p-2">
        {(() => {
          const activecat = categoriesWithRecent.find(cat => cat.id === activeCategory);
          if (!activecat) return null;
          
          const filteredEmojis = getFilteredEmojis(activecat);
          
          if (filteredEmojis.length === 0) {
            return (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                {activeCategory === 'recent' ? 'No recent emojis' : 'No emojis found'}
              </div>
            );
          }

          return (
            <div className="grid grid-cols-8 gap-1">
              {filteredEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
});

export { EmojiPicker };