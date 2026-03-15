/**
 * Enhanced Video Thumbnail Selector Component
 * Allows users to generate thumbnails at multiple time offsets and upload custom thumbnails
 */

import React, { useState, useRef, useCallback } from 'react';
import { MediaFile } from '@/types/composer.types';
import { mediaService } from '@/services/media.service';
import { Upload, Clock, Percent, Image, Check, X, RefreshCw } from 'lucide-react';

interface VideoThumbnailSelectorProps {
  media: MediaFile;
  onThumbnailGenerated: (updatedMedia: MediaFile) => void;
  onClose: () => void;
}

interface ThumbnailFrame {
  time: number;
  url?: string;
  label: string;
  isGenerating?: boolean;
  error?: string;
}

export const VideoThumbnailSelector: React.FC<VideoThumbnailSelectorProps> = ({
  media,
  onThumbnailGenerated,
  onClose,
}) => {
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(
    media.thumbnailUrl || null
  );
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoDuration = media.duration || 60;

  // Generate predefined thumbnail frames
  const [thumbnailFrames, setThumbnailFrames] = useState<ThumbnailFrame[]>(() => {
    const frames: ThumbnailFrame[] = [
      { time: 0, label: '0s' },
      { time: 1, label: '1s' },
      { time: 5, label: '5s' },
      { time: 10, label: '10s' },
      { time: Math.floor(videoDuration * 0.25), label: '25%' },
      { time: Math.floor(videoDuration * 0.5), label: '50%' },
      { time: Math.floor(videoDuration * 0.75), label: '75%' },
    ].filter(frame => frame.time < videoDuration);

    return frames;
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateThumbnail = useCallback(async (frameIndex: number) => {
    const frame = thumbnailFrames[frameIndex];
    if (!media.id || frame.isGenerating) return;

    // Update frame state to show loading
    setThumbnailFrames(prev => prev.map((f, i) => 
      i === frameIndex ? { ...f, isGenerating: true, error: undefined } : f
    ));

    try {
      const result = await mediaService.generateThumbnail(media.id, frame.time);
      
      // Update frame with generated thumbnail
      setThumbnailFrames(prev => prev.map((f, i) => 
        i === frameIndex ? { ...f, url: result.thumbnailUrl, isGenerating: false } : f
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate thumbnail';
      setThumbnailFrames(prev => prev.map((f, i) => 
        i === frameIndex ? { ...f, error: errorMessage, isGenerating: false } : f
      ));
    }
  }, [media.id, thumbnailFrames]);

  const generateAllThumbnails = useCallback(async () => {
    for (let i = 0; i < thumbnailFrames.length; i++) {
      if (!thumbnailFrames[i].url && !thumbnailFrames[i].isGenerating) {
        await generateThumbnail(i);
        // Small delay between generations to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, [thumbnailFrames, generateThumbnail]);

  const handleCustomThumbnailUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('Image file must be smaller than 5MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setCustomThumbnail(previewUrl);

      // TODO: Upload custom thumbnail to server
      // const result = await mediaService.uploadCustomThumbnail(media.id, file);
      // setCustomThumbnail(result.thumbnailUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload thumbnail');
      setCustomThumbnail(null);
    } finally {
      setIsUploading(false);
    }
  }, [media.id]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleCustomThumbnailUpload(file);
    }
  }, [handleCustomThumbnailUpload]);

  const selectThumbnail = useCallback((thumbnailUrl: string) => {
    setSelectedThumbnail(thumbnailUrl);
    setError(null);
  }, []);

  const confirmSelection = useCallback(() => {
    if (!selectedThumbnail) {
      setError('Please select a thumbnail');
      return;
    }

    const updatedMedia: MediaFile = {
      ...media,
      thumbnailUrl: selectedThumbnail,
      metadata: {
        ...media.metadata,
        thumbnails: {
          ...media.metadata?.thumbnails,
          selected: selectedThumbnail,
          auto: thumbnailFrames.filter(f => f.url).map(f => f.url!),
          custom: customThumbnail || undefined,
          frames: thumbnailFrames.map(f => ({
            time: f.time,
            url: f.url || '',
            label: f.label,
          })).filter(f => f.url),
        },
      },
    };

    onThumbnailGenerated(updatedMedia);
    onClose();
  }, [selectedThumbnail, media, thumbnailFrames, customThumbnail, onThumbnailGenerated, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Select Video Thumbnail</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current selection preview */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Current Selection</h4>
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden max-w-sm">
            {selectedThumbnail ? (
              <img
                src={selectedThumbnail}
                alt="Selected thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <span>No thumbnail selected</span>
              </div>
            )}
          </div>
        </div>

        {/* Auto-generated thumbnails */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Auto-Generated Thumbnails</h4>
            <button
              onClick={generateAllThumbnails}
              className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <RefreshCw className="h-3 w-3" />
              Generate All
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {thumbnailFrames.map((frame, index) => (
              <div key={index} className="relative">
                <div 
                  className={`aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                    selectedThumbnail === frame.url ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                  }`}
                  onClick={() => frame.url && selectThumbnail(frame.url)}
                >
                  {frame.isGenerating ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : frame.url ? (
                    <>
                      <img
                        src={frame.url}
                        alt={`Thumbnail at ${frame.label}`}
                        className="w-full h-full object-cover"
                      />
                      {selectedThumbnail === frame.url && (
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                          <Check className="h-6 w-6 text-blue-600" />
                        </div>
                      )}
                    </>
                  ) : frame.error ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                      <X className="h-4 w-4 text-red-500 mb-1" />
                      <span className="text-xs text-red-600 text-center">{frame.error}</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateThumbnail(index);
                      }}
                      className="w-full h-full flex flex-col items-center justify-center hover:bg-gray-50"
                    >
                      <Clock className="h-4 w-4 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-600">Generate</span>
                    </button>
                  )}
                </div>
                <div className="text-center mt-1">
                  <span className="text-xs text-gray-600">{frame.label}</span>
                  {frame.time > 0 && (
                    <div className="text-xs text-gray-500">{formatTime(frame.time)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom thumbnail upload */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Thumbnail</h4>
          <div className="flex gap-4">
            <div 
              className={`aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors w-48 ${
                selectedThumbnail === customThumbnail ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
              }`}
              onClick={() => customThumbnail && selectThumbnail(customThumbnail)}
            >
              {customThumbnail ? (
                <>
                  <img
                    src={customThumbnail}
                    alt="Custom thumbnail"
                    className="w-full h-full object-cover"
                  />
                  {selectedThumbnail === customThumbnail && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                      <Check className="h-6 w-6 text-blue-600" />
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-full flex flex-col items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Upload Image</span>
                    </>
                  )}
                </button>
              )}
            </div>
            
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-2">
                Upload your own thumbnail image for better control over how your video appears.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Recommended: 1280x720 pixels (16:9 ratio)</li>
                <li>• Formats: JPG, PNG</li>
                <li>• Max size: 5MB</li>
              </ul>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={confirmSelection}
            disabled={!selectedThumbnail}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use Selected Thumbnail
          </button>
        </div>
      </div>
    </div>
  );
};