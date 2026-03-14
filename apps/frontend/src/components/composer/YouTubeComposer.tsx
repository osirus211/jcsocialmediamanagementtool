import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Calendar, 
  Clock, 
  Settings, 
  Play,
  Info,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';

interface YouTubeComposerProps {
  onSubmit: (data: YouTubePostData) => void;
  isLoading?: boolean;
  initialData?: Partial<YouTubePostData>;
}

export interface YouTubePostData {
  title: string;
  description: string;
  tags: string[];
  category: string;
  privacy: 'public' | 'unlisted' | 'private';
  videoFile: File | null;
  thumbnailFile: File | null;
  scheduledAt?: Date;
  isShort: boolean;
  madeForKids: boolean;
  language: string;
}

const YOUTUBE_CATEGORIES = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
];

export const YouTubeComposer: React.FC<YouTubeComposerProps> = ({
  onSubmit,
  isLoading = false,
  initialData
}) => {
  const [formData, setFormData] = useState<YouTubePostData>({
    title: '',
    description: '',
    tags: [],
    category: '22', // People & Blogs default
    privacy: 'public',
    videoFile: null,
    thumbnailFile: null,
    isShort: false,
    madeForKids: false,
    language: 'en',
    ...initialData
  });

  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-detect if video is a Short based on file properties
  useEffect(() => {
    if (formData.videoFile) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        const aspectRatio = video.videoWidth / video.videoHeight;
        
        // Auto-detect Short: vertical video (aspect ratio < 1) and duration <= 180 seconds
        const isShort = aspectRatio < 1 && duration <= 180;
        
        setFormData(prev => ({ ...prev, isShort }));
        
        // Clean up
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(formData.videoFile);
    }
  }, [formData.videoFile]);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setErrors(prev => ({ ...prev, video: 'Please select a valid video file' }));
        return;
      }

      // Validate file size (512GB max, but warn at 2GB for practical reasons)
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (file.size > maxSize) {
        setErrors(prev => ({ ...prev, video: 'Video file is very large. Upload may take a long time.' }));
      } else {
        setErrors(prev => ({ ...prev, video: '' }));
      }

      setFormData(prev => ({ ...prev, videoFile: file }));
      
      // Create preview
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
    }
  };

  const handleThumbnailUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, thumbnail: 'Please select a valid image file' }));
        return;
      }

      // Validate file size (2MB max for thumbnails)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        setErrors(prev => ({ ...prev, thumbnail: 'Thumbnail must be under 2MB' }));
        return;
      }

      setErrors(prev => ({ ...prev, thumbnail: '' }));
      setFormData(prev => ({ ...prev, thumbnailFile: file }));
      
      // Create preview
      const url = URL.createObjectURL(file);
      setThumbnailPreview(url);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 10) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }

    if (formData.description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less';
    }

    if (!formData.videoFile) {
      newErrors.video = 'Video file is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const remainingTitleChars = 100 - formData.title.length;
  const remainingDescChars = 5000 - formData.description.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-red-600 rounded-full p-2">
          <Play className="w-5 h-5 text-white fill-current" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">YouTube Video</h3>
          <p className="text-sm text-gray-500">Upload and schedule your video content</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Video Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video File *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            {videoPreview ? (
              <div className="space-y-4">
                <video
                  src={videoPreview}
                  controls
                  className="max-w-full h-48 mx-auto rounded-lg"
                />
                <div className="flex items-center justify-center space-x-4">
                  <span className="text-sm text-gray-600">{formData.videoFile?.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, videoFile: null }));
                      setVideoPreview(null);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {formData.isShort && (
                  <div className="flex items-center justify-center space-x-2 text-purple-600 bg-purple-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Detected as YouTube Short</span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500">MP4, MOV, AVI, WebM (max 512GB)</p>
              </div>
            )}
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          {errors.video && (
            <p className="mt-1 text-sm text-red-600 flex items-center space-x-1">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.video}</span>
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter video title..."
            maxLength={100}
          />
          <div className="flex justify-between mt-1">
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title}</p>
            )}
            <p className={`text-xs ml-auto ${remainingTitleChars < 10 ? 'text-red-500' : 'text-gray-500'}`}>
              {remainingTitleChars} characters remaining
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Describe your video..."
            maxLength={5000}
          />
          <div className="flex justify-between mt-1">
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description}</p>
            )}
            <p className={`text-xs ml-auto ${remainingDescChars < 100 ? 'text-red-500' : 'text-gray-500'}`}>
              {remainingDescChars} characters remaining
            </p>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (max 10)
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center space-x-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Add a tag..."
              disabled={formData.tags.length >= 10}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || formData.tags.length >= 10}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        {/* Privacy & Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="privacy" className="block text-sm font-medium text-gray-700 mb-2">
              Privacy
            </label>
            <select
              id="privacy"
              value={formData.privacy}
              onChange={(e) => setFormData(prev => ({ ...prev, privacy: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              {YOUTUBE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
        >
          <Settings className="w-4 h-4" />
          <span>Advanced Settings</span>
        </button>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            {/* Thumbnail Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Thumbnail
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                {thumbnailPreview ? (
                  <div className="space-y-2">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="max-w-full h-32 mx-auto rounded-lg object-cover"
                    />
                    <div className="flex items-center justify-center space-x-4">
                      <span className="text-sm text-gray-600">{formData.thumbnailFile?.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, thumbnailFile: null }));
                          setThumbnailPreview(null);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Upload custom thumbnail</p>
                    <p className="text-xs text-gray-500">JPG, PNG (max 2MB, 1280x720 recommended)</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              {errors.thumbnail && (
                <p className="mt-1 text-sm text-red-600">{errors.thumbnail}</p>
              )}
            </div>

            {/* Language & Made for Kids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  id="language"
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="madeForKids"
                  checked={formData.madeForKids}
                  onChange={(e) => setFormData(prev => ({ ...prev, madeForKids: e.target.checked }))}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <label htmlFor="madeForKids" className="text-sm text-gray-700">
                  Made for kids
                </label>
                <div className="group relative">
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap">
                    Required by COPPA for content directed at children under 13
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule Publication
              </label>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input
                  type="datetime-local"
                  value={formData.scheduledAt ? new Date(formData.scheduledAt.getTime() - formData.scheduledAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    scheduledAt: e.target.value ? new Date(e.target.value) : undefined 
                  }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {formData.scheduledAt && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, scheduledAt: undefined }))}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to publish immediately
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>{formData.scheduledAt ? 'Schedule' : 'Publish'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};