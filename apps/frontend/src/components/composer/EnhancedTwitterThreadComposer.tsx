import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Plus, X, GripVertical, MessageCircle, BarChart3, Clock, 
  ArrowUp, ArrowDown, Image, Video, Hash, Wand2, Copy, 
  RotateCcw, Settings, Eye, Shuffle, Link2, Timer, Smile
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { EmojiPicker } from './EmojiPicker';
import { useTheme } from '@/hooks/useTheme';

interface Tweet {
  id: string;
  content: string;
  mediaIds: string[];
  altTexts: string[];
  characterCount?: number;
}

interface ThreadOptions {
  autoNumbering: boolean;
  numberingStyle: '1/n' | '1.' | 'none';
  delayBetweenTweets: number;
  connectToTweet?: string;
  enableBluesky: boolean;
  enableMastodon: boolean;
  enableThreads: boolean;
}

interface EnhancedTwitterThreadComposerProps {
  onThreadChange: (tweets: Tweet[]) => void;
  onOptionsChange: (options: ThreadOptions) => void;
  maxTweets?: number;
  characterLimit?: number;
  selectedPlatforms?: string[];
}

const THREAD_TEMPLATES = [
  {
    id: 'story',
    name: 'Story Thread',
    description: 'Tell a compelling story',
    tweets: [
      'Here\'s a story that changed my perspective on...',
      'It started when...',
      'The turning point came when...',
      'What I learned:'
    ]
  },
  {
    id: 'tips',
    name: 'Tips Thread', 
    description: 'Share actionable advice',
    tweets: [
      'Here are X tips for...',
      'Tip 1:',
      'Tip 2:',
      'Tip 3:',
      'Which tip will you try first?'
    ]
  },
  {
    id: 'tutorial',
    name: 'Tutorial Thread',
    description: 'Step-by-step guide',
    tweets: [
      'How to [achieve something] in X steps:',
      'Step 1:',
      'Step 2:', 
      'Step 3:',
      'That\'s it! Let me know if you have questions.'
    ]
  }
];

export function EnhancedTwitterThreadComposer({ 
  onThreadChange, 
  onOptionsChange,
  maxTweets = 25, 
  characterLimit = 280,
  selectedPlatforms = ['twitter']
}: EnhancedTwitterThreadComposerProps) {
  const [tweets, setTweets] = useState<Tweet[]>([
    { id: '1', content: '', mediaIds: [], altTexts: [] }
  ]);
  
  const [options, setOptions] = useState<ThreadOptions>({
    autoNumbering: true,
    numberingStyle: '1/n',
    delayBetweenTweets: 5,
    enableBluesky: selectedPlatforms.includes('bluesky'),
    enableMastodon: selectedPlatforms.includes('mastodon'),
    enableThreads: selectedPlatforms.includes('threads'),
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [longText, setLongText] = useState('');
  const [showAutoSplit, setShowAutoSplit] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const theme = useTheme();

  // Update character counts
  useEffect(() => {
    const updatedTweets = tweets.map(tweet => ({
      ...tweet,
      characterCount: getCharacterCount(tweet.content, tweet.id)
    }));
    setTweets(updatedTweets);
    onThreadChange(updatedTweets);
  }, [tweets.map(t => t.content).join(''), options.autoNumbering, options.numberingStyle]);

  // Notify parent of options changes
  useEffect(() => {
    onOptionsChange(options);
  }, [options, onOptionsChange]);

  const getCharacterCount = (content: string, tweetId: string) => {
    let finalContent = content;
    
    if (options.autoNumbering && tweets.length > 1) {
      const index = tweets.findIndex(t => t.id === tweetId) + 1;
      const total = tweets.length;
      
      if (options.numberingStyle === '1/n') {
        finalContent = `${index}/${total} ${content}`;
      } else if (options.numberingStyle === '1.') {
        finalContent = `${index}. ${content}`;
      }
    }
    
    return finalContent.length;
  };

  const updateTweet = useCallback((id: string, content: string) => {
    const updatedTweets = tweets.map(tweet => 
      tweet.id === id ? { ...tweet, content } : tweet
    );
    setTweets(updatedTweets);
  }, [tweets]);

  const addTweet = useCallback((index?: number) => {
    if (tweets.length >= maxTweets) return;
    
    const newTweet: Tweet = {
      id: Date.now().toString(),
      content: '',
      mediaIds: [],
      altTexts: []
    };
    
    const insertIndex = index !== undefined ? index + 1 : tweets.length;
    const updatedTweets = [...tweets];
    updatedTweets.splice(insertIndex, 0, newTweet);
    setTweets(updatedTweets);
  }, [tweets, maxTweets]);

  const removeTweet = useCallback((id: string) => {
    if (tweets.length <= 1) return;
    
    const updatedTweets = tweets.filter(tweet => tweet.id !== id);
    setTweets(updatedTweets);
  }, [tweets]);

  const duplicateTweet = useCallback((id: string) => {
    const tweetToDuplicate = tweets.find(t => t.id === id);
    if (!tweetToDuplicate || tweets.length >= maxTweets) return;
    
    const newTweet: Tweet = {
      ...tweetToDuplicate,
      id: Date.now().toString(),
    };
    
    const index = tweets.findIndex(t => t.id === id);
    const updatedTweets = [...tweets];
    updatedTweets.splice(index + 1, 0, newTweet);
    setTweets(updatedTweets);
  }, [tweets, maxTweets]);
  // Drag and drop functionality
  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const items = Array.from(tweets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTweets(items);
  }, [tweets]);

  // Auto-split long content into tweets
  const autoSplitContent = useCallback(() => {
    if (!longText.trim()) return;
    
    const sentences = longText.split(/[.!?]+/).filter(s => s.trim());
    const newTweets: Tweet[] = [];
    let currentTweet = '';
    
    sentences.forEach(sentence => {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) return;
      
      const testContent = currentTweet ? `${currentTweet}. ${trimmedSentence}` : trimmedSentence;
      const testLength = getCharacterCount(testContent, 'temp');
      
      if (testLength <= characterLimit - 20) { // Leave buffer for numbering
        currentTweet = testContent;
      } else {
        if (currentTweet) {
          newTweets.push({
            id: Date.now().toString() + Math.random(),
            content: currentTweet,
            mediaIds: [],
            altTexts: []
          });
        }
        currentTweet = trimmedSentence;
      }
    });
    
    if (currentTweet) {
      newTweets.push({
        id: Date.now().toString() + Math.random(),
        content: currentTweet,
        mediaIds: [],
        altTexts: []
      });
    }
    
    if (newTweets.length > 0) {
      setTweets(newTweets);
      setLongText('');
      setShowAutoSplit(false);
    }
  }, [longText, characterLimit]);

  // Apply template
  const applyTemplate = useCallback((template: typeof THREAD_TEMPLATES[0]) => {
    const templateTweets: Tweet[] = template.tweets.map((content, index) => ({
      id: `template-${Date.now()}-${index}`,
      content,
      mediaIds: [],
      altTexts: []
    }));
    
    setTweets(templateTweets);
    setShowTemplates(false);
  }, []);

  // Get stats
  const getTotalCharacters = () => {
    return tweets.reduce((total, tweet, index) => {
      return total + getCharacterCount(tweet.content, tweet.id);
    }, 0);
  };

  const getEstimatedReadTime = () => {
    const totalWords = tweets.reduce((total, tweet) => 
      total + tweet.content.split(' ').length, 0
    );
    return Math.ceil(totalWords / 200);
  };

  const getEstimatedPublishTime = () => {
    if (tweets.length <= 1) return 0;
    return (tweets.length - 1) * options.delayBetweenTweets;
  };

  // Focus management
  const focusNextTweet = useCallback((currentId: string) => {
    const currentIndex = tweets.findIndex(t => t.id === currentId);
    const nextTweet = tweets[currentIndex + 1];
    if (nextTweet && textareaRefs.current[nextTweet.id]) {
      textareaRefs.current[nextTweet.id]?.focus();
    }
  }, [tweets]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, tweetId: string) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const currentIndex = tweets.findIndex(t => t.id === tweetId);
      addTweet(currentIndex);
      setTimeout(() => focusNextTweet(tweetId), 100);
    }
  }, [tweets, addTweet, focusNextTweet]);

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string, tweetId: string) => {
    const textarea = textareaRefs.current[tweetId];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const tweet = tweets.find(t => t.id === tweetId);
    if (!tweet) return;

    const newContent = tweet.content.slice(0, start) + emoji + tweet.content.slice(end);
    updateTweet(tweetId, newContent);
    
    // Restore cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
    
    setShowEmojiPicker(null);
  }, [tweets, updateTweet]);
  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          🧵 Thread Composer
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAutoSplit(!showAutoSplit)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            title="Auto-split long content"
          >
            <Wand2 className="h-4 w-4" />
            Auto-split
          </button>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            title="Use template"
          >
            <Copy className="h-4 w-4" />
            Templates
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            title="Preview thread"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Thread settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Auto-split Panel */}
      {showAutoSplit && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">Auto-split Long Content</h4>
          <textarea
            value={longText}
            onChange={(e) => setLongText(e.target.value)}
            placeholder="Paste your long content here and we'll automatically split it into tweets..."
            className="w-full p-3 border border-purple-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={4}
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-sm text-purple-700">
              {longText.length} characters → ~{Math.ceil(longText.length / (characterLimit - 20))} tweets
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAutoSplit(false)}
                className="px-3 py-1 text-sm text-purple-600 hover:text-purple-800"
              >
                Cancel
              </button>
              <button
                onClick={autoSplitContent}
                disabled={!longText.trim()}
                className="px-4 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Split into Tweets
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3">Thread Templates</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {THREAD_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="p-3 text-left bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-blue-900">{template.name}</div>
                <div className="text-sm text-blue-700 mt-1">{template.description}</div>
                <div className="text-xs text-blue-600 mt-2">{template.tweets.length} tweets</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTemplates(false)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800"
          >
            Close Templates
          </button>
        </div>
      )}
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Thread Settings</h4>
          
          <div className="space-y-4">
            {/* Auto-numbering */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto-numbering</label>
                <p className="text-xs text-gray-500">Add numbers to tweets automatically</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.autoNumbering}
                  onChange={(e) => setOptions(prev => ({ ...prev, autoNumbering: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Numbering Style */}
            {options.autoNumbering && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Numbering Style</label>
                <div className="flex gap-2">
                  {(['1/n', '1.'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setOptions(prev => ({ ...prev, numberingStyle: style }))}
                      className={`px-3 py-1 text-sm rounded border ${
                        options.numberingStyle === style
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {style === '1/n' ? '1/5, 2/5, 3/5...' : '1. 2. 3...'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Delay between tweets */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Delay between tweets: {options.delayBetweenTweets}s
              </label>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={options.delayBetweenTweets}
                onChange={(e) => setOptions(prev => ({ ...prev, delayBetweenTweets: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Instant</span>
                <span>1 minute</span>
              </div>
            </div>

            {/* Multi-platform support */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Cross-platform Publishing</label>
              <div className="space-y-2">
                {[
                  { key: 'enableBluesky', label: 'Bluesky', icon: '🦋' },
                  { key: 'enableMastodon', label: 'Mastodon', icon: '🐘' },
                  { key: 'enableThreads', label: 'Threads', icon: '🧵' },
                ].map(({ key, label, icon }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options[key as keyof ThreadOptions] as boolean}
                      onChange={(e) => setOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{icon} {label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Connect to existing tweet */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Connect to Tweet (Reply Thread)</label>
              <input
                type="text"
                value={options.connectToTweet || ''}
                onChange={(e) => setOptions(prev => ({ ...prev, connectToTweet: e.target.value || undefined }))}
                placeholder="Tweet URL or ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Thread will be posted as replies to this tweet</p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="mt-4 text-sm text-gray-600 hover:text-gray-800"
          >
            Close Settings
          </button>
        </div>
      )}
      {/* Thread Stats */}
      <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <MessageCircle className="h-4 w-4" />
          <span>{tweets.length} tweets</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <BarChart3 className="h-4 w-4" />
          <span>{getTotalCharacters()} characters</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Clock className="h-4 w-4" />
          <span>~{getEstimatedReadTime()} min read</span>
        </div>
        {options.delayBetweenTweets > 0 && tweets.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Timer className="h-4 w-4" />
            <span>~{Math.ceil(getEstimatedPublishTime() / 60)} min to publish</span>
          </div>
        )}
      </div>

      {/* Thread Composer with Drag & Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="tweets">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-3"
            >
              {tweets.map((tweet, index) => (
                <Draggable key={tweet.id} draggableId={tweet.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`relative border rounded-lg p-4 bg-white shadow-sm transition-all ${
                        snapshot.isDragging ? 'shadow-lg rotate-1' : ''
                      }`}
                    >
                      {/* Tweet Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center gap-1 cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4 text-gray-400" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {options.autoNumbering && tweets.length > 1 
                              ? options.numberingStyle === '1/n' 
                                ? `${index + 1}/${tweets.length}`
                                : `${index + 1}.`
                              : `Tweet ${index + 1}`
                            }
                          </span>
                          {index > 0 && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              Reply to tweet {index}
                            </span>
                          )}
                          {options.connectToTweet && index === 0 && (
                            <span className="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded flex items-center gap-1">
                              <Link2 className="h-3 w-3" />
                              Reply thread
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => duplicateTweet(tweet.id)}
                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                            title="Duplicate tweet"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => addTweet(index)}
                            className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                            title="Add tweet after this one"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          {tweets.length > 1 && (
                            <button
                              onClick={() => removeTweet(tweet.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete tweet"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Tweet Content */}
                      <div className="space-y-3">
                        <div className="relative">
                          <textarea
                            ref={(el) => textareaRefs.current[tweet.id] = el}
                            value={tweet.content}
                            onChange={(e) => updateTweet(tweet.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, tweet.id)}
                            placeholder={
                              index === 0 
                                ? options.connectToTweet 
                                  ? "Start your reply thread..."
                                  : "Start your thread..." 
                                : "Continue your thread..."
                            }
                            className="w-full p-3 pr-12 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            maxLength={characterLimit}
                          />
                          
                          {/* Emoji Button */}
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker(showEmojiPicker === tweet.id ? null : tweet.id)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            title="Add emoji"
                          >
                            <Smile className="h-4 w-4" />
                          </button>

                          {/* Emoji Picker */}
                          {showEmojiPicker === tweet.id && (
                            <EmojiPicker
                              isOpen={true}
                              onEmojiSelect={(emoji) => handleEmojiSelect(emoji, tweet.id)}
                              onClose={() => setShowEmojiPicker(null)}
                              theme={theme}
                            />
                          )}
                        </div>
                        
                        {/* Media Upload Placeholder */}
                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-blue-600 border border-gray-300 rounded hover:bg-blue-50 transition-colors"
                            title="Add image"
                          >
                            <Image className="h-4 w-4" />
                            Image
                          </button>
                          <button
                            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-blue-600 border border-gray-300 rounded hover:bg-blue-50 transition-colors"
                            title="Add video"
                          >
                            <Video className="h-4 w-4" />
                            Video
                          </button>
                        </div>
                        
                        {/* Character Count */}
                        <div className="flex justify-between items-center text-sm">
                          <div className="text-gray-500">
                            {getCharacterCount(tweet.content, tweet.id)} / {characterLimit}
                          </div>
                          <div className={`font-medium ${
                            getCharacterCount(tweet.content, tweet.id) > characterLimit * 0.9 
                              ? 'text-red-500' 
                              : getCharacterCount(tweet.content, tweet.id) > characterLimit * 0.8 
                                ? 'text-yellow-500' 
                                : 'text-green-500'
                          }`}>
                            {characterLimit - getCharacterCount(tweet.content, tweet.id)} remaining
                          </div>
                        </div>
                      </div>

                      {/* Thread Connection Indicator */}
                      {index < tweets.length - 1 && (
                        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Tweet Button */}
      {tweets.length < maxTweets && (
        <button
          onClick={() => addTweet()}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Tweet to Thread (Cmd+Enter in any tweet)
        </button>
      )}
      {/* Thread Preview */}
      {showPreview && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Thread Preview
          </h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {tweets.map((tweet, index) => (
              <div key={tweet.id} className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                    U
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">Your Name</span>
                      <span className="text-gray-500 text-sm">@username</span>
                      <span className="text-gray-500 text-sm">·</span>
                      <span className="text-gray-500 text-sm">now</span>
                    </div>
                    <div className="text-gray-900">
                      {options.autoNumbering && tweets.length > 1 && (
                        <span className="text-blue-600 font-medium">
                          {options.numberingStyle === '1/n' 
                            ? `${index + 1}/${tweets.length} `
                            : `${index + 1}. `
                          }
                        </span>
                      )}
                      {tweet.content || <span className="text-gray-400 italic">Empty tweet</span>}
                    </div>
                    {index < tweets.length - 1 && (
                      <div className="mt-2 text-blue-500 text-sm">
                        Show this thread
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowPreview(false)}
            className="mt-3 text-sm text-gray-600 hover:text-gray-800"
          >
            Close Preview
          </button>
        </div>
      )}

      {/* Thread Tips */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Thread Tips:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Start with a hook to grab attention</li>
          <li>• Keep each tweet focused on one idea</li>
          <li>• Use drag & drop to reorder tweets</li>
          <li>• Press Cmd+Enter to add a new tweet</li>
          <li>• End with a call-to-action or question</li>
          <li>• Use templates for common thread structures</li>
        </ul>
      </div>
    </div>
  );
}