/**
 * Video Thumbnail Selector Component
 * Allows users to generate thumbnails at specific time offsets
 */

import React, { useState } from 'react';
import { MediaFile } from '@/types/composer.types';
import { mediaService } from '@/services/media.service';

interface VideoThumbnailSelectorProps {
  media: MediaFile;
  onThumbnailGenerated: (updatedMedia: MediaFile) => void;
  onClose: () => void;
}

export const VideoThumbnailSelector: React.FC<VideoThumbnailSelectorProps> = ({
  media,
  onThumbnailGenerated,
  onClose,
}) => {
  const [timeOffset, setTimeOffset] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoDuration = media.duration || 60; // Default to 60 seconds if duration not available

  const handleTimeOffsetChange = (value: number) => {
    setTimeOffset(value);
    setError(null);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateThumbnail = async () => {
    if (!media.id) {
      setError('Media ID is required');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await mediaService.generateThumbnail(media.id, timeOffset);
      const updatedMedia = {
        ...media,
        thumbnailUrl: result.thumbnailUrl,
      };

      setPreviewThumbnail(result.thumbnailUrl || null);
      onThumbnailGenerated(updatedMedia);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate thumbnail');
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmThumbnail = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Generate Video Thumbnail</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Current thumbnail preview */}
        <div className="mb-4">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            {previewThumbnail ? (
              <img
                src={previewThumbnail}
                alt="Generated thumbnail"
                className="w-full h-full object-cover"
              />
            ) : media.thumbnailUrl ? (
              <img
                src={media.thumbnailUrl}
                alt="Current thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <span>No thumbnail</span>
              </div>
            )}
          </div>
        </div>

        {/* Time scrubber */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thumbnail at {formatTime(timeOffset)}
          </label>
          <input
            type="range"
            min="0"
            max={videoDuration}
            step="0.5"
            value={timeOffset}
            onChange={(e) => handleTimeOffsetChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={isGenerating}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0:00</span>
            <span>{formatTime(videoDuration)}</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={generateThumbnail}
            disabled={isGenerating}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Capture at this time'}
          </button>
          
          {previewThumbnail && (
            <button
              onClick={confirmThumbnail}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Use this thumbnail
            </button>
          )}
        </div>
      </div>
    </div>
  );
};