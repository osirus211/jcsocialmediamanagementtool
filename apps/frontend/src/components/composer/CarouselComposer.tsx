/**
 * Carousel Composer Component
 * 
 * Full-featured carousel/slideshow builder with:
 * - Simple reordering with up/down buttons
 * - Per-slide captions and alt text
 * - Platform-specific limits
 * - AI generation
 * - Templates
 * - Cover slide selection
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Plus, 
  X, 
  ArrowUp,
  ArrowDown,
  Image, 
  Video, 
  FileText, 
  Wand2, 
  Copy, 
  Eye,
  AlertCircle,
  Upload,
  ChevronLeft,
  ChevronRight,
  Star
} from 'lucide-react';

export interface CarouselItem {
  id: string;
  order: number;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  altText?: string;
  link?: string; // LinkedIn only
  file?: File;
}

interface CarouselComposerProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  items: CarouselItem[];
  onItemsChange: (items: CarouselItem[]) => void;
  selectedPlatforms: string[];
  coverSlideIndex: number;
  onCoverSlideChange: (index: number) => void;
  maxFiles?: number;
}

const PLATFORM_LIMITS = {
  instagram: { max: 20, name: 'Instagram' },
  linkedin: { max: 9, name: 'LinkedIn' },
  facebook: { max: 30, name: 'Facebook' },
  tiktok: { max: 35, name: 'TikTok' },
  twitter: { max: 4, name: 'Twitter' },
};

const CAROUSEL_TEMPLATES = [
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    description: '5 slides highlighting product features',
    slides: 5,
    placeholders: [
      { title: 'Hero Shot', description: 'Main product image' },
      { title: 'Key Features', description: 'Highlight main benefits' },
      { title: 'Use Cases', description: 'Show product in action' },
      { title: 'Testimonials', description: 'Customer reviews' },
      { title: 'Call to Action', description: 'Purchase or learn more' },
    ],
  },
  {
    id: 'tips-list',
    name: 'Tips List',
    description: 'Numbered tips or advice',
    slides: 7,
    placeholders: [
      { title: 'Tip #1', description: 'First actionable tip' },
      { title: 'Tip #2', description: 'Second helpful tip' },
      { title: 'Tip #3', description: 'Third valuable tip' },
      { title: 'Tip #4', description: 'Fourth useful tip' },
      { title: 'Tip #5', description: 'Fifth important tip' },
      { title: 'Bonus Tip', description: 'Extra valuable insight' },
      { title: 'Summary', description: 'Key takeaways' },
    ],
  },
  {
    id: 'before-after',
    name: 'Before & After',
    description: 'Show transformation or progress',
    slides: 2,
    placeholders: [
      { title: 'Before', description: 'Starting point or problem' },
      { title: 'After', description: 'End result or solution' },
    ],
  },
  {
    id: 'step-tutorial',
    name: 'Step-by-Step Tutorial',
    description: 'Educational how-to guide',
    slides: 6,
    placeholders: [
      { title: 'Introduction', description: 'What you\'ll learn' },
      { title: 'Step 1', description: 'First action to take' },
      { title: 'Step 2', description: 'Second step' },
      { title: 'Step 3', description: 'Third step' },
      { title: 'Step 4', description: 'Final step' },
      { title: 'Results', description: 'What you\'ve achieved' },
    ],
  },
];

export const CarouselComposer: React.FC<CarouselComposerProps> = ({
  isEnabled,
  onToggle,
  items,
  onItemsChange,
  selectedPlatforms,
  coverSlideIndex,
  onCoverSlideChange,
  maxFiles = 35,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSlideCount, setAiSlideCount] = useState(5);
  const [aiStyle, setAiStyle] = useState('professional');

  // Calculate platform-specific limits
  const platformLimits = useMemo(() => {
    return selectedPlatforms.map(platform => {
      const limit = PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS];
      return limit ? `${limit.name}: max ${limit.max}` : null;
    }).filter(Boolean);
  }, [selectedPlatforms]);

  const maxAllowedSlides = useMemo(() => {
    if (selectedPlatforms.length === 0) return maxFiles;
    return Math.min(
      maxFiles,
      ...selectedPlatforms.map(platform => {
        const limit = PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS];
        return limit?.max || maxFiles;
      })
    );
  }, [selectedPlatforms, maxFiles]);

  const moveSlide = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= items.length) return;

    const newItems = Array.from(items);
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);

    // Update order numbers
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      order: index,
    }));

    onItemsChange(updatedItems);

    // Adjust cover slide index if needed
    if (coverSlideIndex === fromIndex) {
      onCoverSlideChange(toIndex);
    } else if (coverSlideIndex > fromIndex && coverSlideIndex <= toIndex) {
      onCoverSlideChange(coverSlideIndex - 1);
    } else if (coverSlideIndex < fromIndex && coverSlideIndex >= toIndex) {
      onCoverSlideChange(coverSlideIndex + 1);
    }
  }, [items, coverSlideIndex, onItemsChange, onCoverSlideChange]);

  const addSlide = useCallback(() => {
    if (items.length >= maxAllowedSlides) return;

    const newItem: CarouselItem = {
      id: `slide-${Date.now()}`,
      order: items.length,
      mediaUrl: '',
      mediaType: 'image',
      caption: '',
      altText: '',
    };

    onItemsChange([...items, newItem]);
  }, [items, maxAllowedSlides, onItemsChange]);

  const removeSlide = useCallback((itemId: string) => {
    const newItems = items
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index }));
    
    onItemsChange(newItems);
    
    // Adjust cover slide index if needed
    if (coverSlideIndex >= newItems.length) {
      onCoverSlideChange(Math.max(0, newItems.length - 1));
    }
  }, [items, coverSlideIndex, onItemsChange, onCoverSlideChange]);

  const duplicateSlide = useCallback((itemId: string) => {
    if (items.length >= maxAllowedSlides) return;

    const itemToDuplicate = items.find(item => item.id === itemId);
    if (!itemToDuplicate) return;

    const newItem: CarouselItem = {
      ...itemToDuplicate,
      id: `slide-${Date.now()}`,
      order: itemToDuplicate.order + 1,
    };

    const newItems = [
      ...items.slice(0, itemToDuplicate.order + 1),
      newItem,
      ...items.slice(itemToDuplicate.order + 1),
    ].map((item, index) => ({ ...item, order: index }));

    onItemsChange(newItems);
  }, [items, maxAllowedSlides, onItemsChange]);

  const updateSlide = useCallback((itemId: string, updates: Partial<CarouselItem>) => {
    const newItems = items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const applyTemplate = useCallback((template: typeof CAROUSEL_TEMPLATES[0]) => {
    const newItems: CarouselItem[] = template.placeholders.map((placeholder, index) => ({
      id: `slide-${Date.now()}-${index}`,
      order: index,
      mediaUrl: '',
      mediaType: 'image' as const,
      caption: `${placeholder.title}\n\n${placeholder.description}`,
      altText: placeholder.title,
    }));

    onItemsChange(newItems);
    setShowTemplates(false);
  }, [onItemsChange]);

  const generateWithAI = useCallback(async () => {
    if (!aiTopic.trim()) return;

    // TODO: Implement AI generation API call
    const newItems: CarouselItem[] = Array.from({ length: aiSlideCount }, (_, index) => ({
      id: `ai-slide-${Date.now()}-${index}`,
      order: index,
      mediaUrl: '',
      mediaType: 'image' as const,
      caption: `AI Generated Slide ${index + 1}\n\nTopic: ${aiTopic}\nStyle: ${aiStyle}`,
      altText: `AI generated content about ${aiTopic}`,
    }));

    onItemsChange(newItems);
    setShowAIGenerator(false);
    setAiTopic('');
  }, [aiTopic, aiSlideCount, aiStyle, onItemsChange]);

  const handleFileUpload = useCallback((files: FileList | null, itemId?: string) => {
    if (!files) return;

    const file = files[0];
    if (!file) return;

    if (itemId) {
      // Replace existing slide
      updateSlide(itemId, {
        mediaUrl: URL.createObjectURL(file),
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
        file,
      });
    } else {
      // Add new slide
      if (items.length >= maxAllowedSlides) return;

      const newItem: CarouselItem = {
        id: `slide-${Date.now()}`,
        order: items.length,
        mediaUrl: URL.createObjectURL(file),
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
        file,
        altText: file.name.replace(/\.[^/.]+$/, ''),
      };

      onItemsChange([...items, newItem]);
    }
  }, [items, maxAllowedSlides, onItemsChange, updateSlide]);

  if (!isEnabled) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-gray-600">
            <Image className="h-6 w-6" />
            <span className="font-medium">Create Carousel/Slideshow</span>
          </div>
          <p className="text-sm text-gray-500 max-w-md">
            Upload multiple images or videos to create engaging carousel posts. 
            Perfect for tutorials, product showcases, and storytelling.
          </p>
          <button
            onClick={() => onToggle(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Enable Carousel Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-gray-900">Carousel Builder</span>
          <span className="text-sm text-gray-500">
            ({items.length}/{maxAllowedSlides} slides)
          </span>
        </div>
        <button
          onClick={() => onToggle(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Platform Limits Warning */}
      {platformLimits.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">Platform limits: </span>
            {platformLimits.join(', ')}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={addSlide}
          disabled={items.length >= maxAllowedSlides}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Add Slide
        </button>
        
        <button
          onClick={() => setShowTemplates(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <FileText className="h-4 w-4" />
          Templates
        </button>
        
        <button
          onClick={() => setShowAIGenerator(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Wand2 className="h-4 w-4" />
          AI Generate
        </button>

        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
          <Upload className="h-4 w-4" />
          Upload Files
          <input
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                Array.from(files).forEach(file => {
                  handleFileUpload([file] as any);
                });
              }
            }}
            className="hidden"
          />
        </label>
      </div>

      {/* Slides List */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`
                border rounded-lg p-4 bg-white shadow-sm
                ${coverSlideIndex === index ? 'ring-2 ring-blue-500' : ''}
              `}
            >
              <div className="flex items-start gap-4">
                {/* Order Controls */}
                <div className="flex flex-col items-center gap-2 pt-2">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveSlide(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => moveSlide(index, index + 1)}
                      disabled={index === items.length - 1}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    {index + 1}
                  </span>
                </div>

                {/* Media Preview */}
                <div className="relative">
                  {item.mediaUrl ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                      {item.mediaType === 'video' ? (
                        <video
                          src={item.mediaUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.mediaUrl}
                          alt={item.altText || `Slide ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {item.mediaType === 'video' && (
                        <Video className="absolute top-1 right-1 h-4 w-4 text-white bg-black bg-opacity-50 rounded p-0.5" />
                      )}
                    </div>
                  ) : (
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-gray-400">
                      <Upload className="h-6 w-6 text-gray-400" />
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => handleFileUpload(e.target.files, item.id)}
                        className="hidden"
                      />
                    </label>
                  )}
                  
                  {/* Cover Slide Indicator */}
                  {coverSlideIndex === index && (
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1">
                      <Star className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Slide Content */}
                <div className="flex-1 space-y-3">
                  {/* Caption */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Caption (Optional)
                    </label>
                    <textarea
                      value={item.caption || ''}
                      onChange={(e) => updateSlide(item.id, { caption: e.target.value })}
                      placeholder="Add a caption for this slide..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Alt Text */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Alt Text (Accessibility)
                    </label>
                    <input
                      type="text"
                      value={item.altText || ''}
                      onChange={(e) => updateSlide(item.id, { altText: e.target.value })}
                      placeholder="Describe this image for screen readers..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* LinkedIn Link (if LinkedIn is selected) */}
                  {selectedPlatforms.includes('linkedin') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Link (LinkedIn only)
                      </label>
                      <input
                        type="url"
                        value={item.link || ''}
                        onChange={(e) => updateSlide(item.id, { link: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => onCoverSlideChange(index)}
                    className={`p-2 rounded-lg transition-colors ${
                      coverSlideIndex === index
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Set as cover slide"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => duplicateSlide(item.id)}
                    disabled={items.length >= maxAllowedSlides}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Duplicate slide"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => removeSlide(item.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remove slide"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Carousel Preview */}
      {items.length > 0 && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Carousel Preview
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                disabled={previewIndex === 0}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                {previewIndex + 1} / {items.length}
              </span>
              <button
                onClick={() => setPreviewIndex(Math.min(items.length - 1, previewIndex + 1))}
                disabled={previewIndex === items.length - 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {items[previewIndex] && (
            <div className="bg-white rounded-lg p-4 max-w-md mx-auto">
              {items[previewIndex].mediaUrl && (
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-3">
                  {items[previewIndex].mediaType === 'video' ? (
                    <video
                      src={items[previewIndex].mediaUrl}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img
                      src={items[previewIndex].mediaUrl}
                      alt={items[previewIndex].altText}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
              
              {items[previewIndex].caption && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {items[previewIndex].caption}
                </p>
              )}
              
              {/* Slide indicators */}
              <div className="flex justify-center gap-1 mt-3">
                {items.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setPreviewIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === previewIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Carousel Templates</h3>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAROUSEL_TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  className="border rounded-lg p-4 hover:border-blue-500 cursor-pointer transition-colors"
                  onClick={() => applyTemplate(template)}
                >
                  <h4 className="font-medium text-gray-900 mb-2">{template.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="text-xs text-gray-500">
                    {template.slides} slides
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Generator Modal */}
      {showAIGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">AI Carousel Generator</h3>
              <button
                onClick={() => setShowAIGenerator(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g., Social media marketing tips"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of slides
                </label>
                <select
                  value={aiSlideCount}
                  onChange={(e) => setAiSlideCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num} slides</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Style
                </label>
                <select
                  value={aiStyle}
                  onChange={(e) => setAiStyle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="educational">Educational</option>
                  <option value="inspirational">Inspirational</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAIGenerator(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={generateWithAI}
                  disabled={!aiTopic.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};