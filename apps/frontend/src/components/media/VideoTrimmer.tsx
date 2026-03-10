/**
 * Video Trimmer Component
 * Allows users to trim videos with platform-specific constraints
 */

import React, { useState } from 'react';
import { MediaFile } from '@/types/composer.types';
import { mediaService } from '@/services/media.service';

interface VideoTrimmerProps {
  media: MediaFile;
  selectedPlatforms?: string[];
  onVideoTrimmed: (newMedia: MediaFile) => void;
  onClose: () => void;
}

// Platform-specific video duration limits (in seconds)
const PLATFORM_LIMITS: Record<string, number> = {
  instagram: 90, // Instagram Reels max
  tiktok: 60,    // TikTok max
  twitter: 140,  // Twitter max
  default: 300,  // Default max (5 minutes)
};

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  media,
  selectedPlatforms = [],
  onVideoTrimmed,
  onClose,
}) => {
  const videoDuration = media.duration || 60; // Default to 60 seconds if duration not available
  
  // Determine max duration based on selected platforms
  const getMaxDuration = (): number => {
    if (selectedPlatforms.length === 0) {
      return Math.min(videoDuration, PLATFORM_LIMITS.default);
    }
    
    const platformLimits = selectedPlatforms.map(platform => 
      PLATFORM_LIMITS[platform.toLowerCase()] || PLATFORM_LIMITS.default
    );
    
    return Math.min(videoDuration, Math.min(...platformLimits));
  };

  const maxDuration = getMaxDuration();
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(videoDuration, maxDuration));
  const [isTrimming, setIsTrimming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimeChange = (value: number) => {
    const newStartTime = Math.max(0, Math.min(value, endTime - 1));
    setStartTime(newStartTime);
    setError(null);
  };

  const handleEndTimeChange = (value: number) => {
    const newEndTime = Math.max(startTime + 1, Math.min(value, videoDuration));
    setEndTime(newEndTime);
    setError(null);
  };

  const trimDuration = endTime - startTime;

  const getPlatformConstraints = (): string => {
    if (selectedPlatforms.length === 0) {
      return `Max ${formatTime(PLATFORM_LIMITS.default)}`;
    }

    const constraints = selectedPlatforms.map(platform => {
      const limit = PLATFORM_LIMITS[platform.toLowerCase()] || PLATFORM_LIMITS.default;
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      return `${platformName}: max ${formatTime(limit)}`;
    });

    return constraints.join(' • ');
  };

  const trimVideo = async () => {
    if (!media.id) {
      setError('Media ID is required');
      return;
    }

    if (trimDuration > maxDuration) {
      setError(`Trimmed video exceeds maximum duration of ${formatTime(maxDuration)}`);
      return;
    }

    setIsTrimming(true);
    setError(null);

    try {
      const result = await mediaService.trimVideo(media.id, startTime, endTime);
      const newMedia: MediaFile = {
        id: result._id,
        filename: result.filename,
        url: result.cdnUrl || result.storageUrl,
        thumbnailUrl: result.thumbnailUrl,
        type: 'video',
        size: result.size,
        duration: result.duration,
        uploadStatus: 'completed',
      };

      onVideoTrimmed(newMedia);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trim video');
    } finally {
      setIsTrimming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Trim Video</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Video preview */}
        <div className="mb-4">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <video
              src={media.url}
              className="w-full h-full object-cover"
              controls
            />
          </div>
        </div>

        {/* Platform constraints */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Platform limits:</strong> {getPlatformConstraints()}
          </p>
        </div>

        {/* Time selection */}
        <div className="mb-4">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start time: {formatTime(startTime)}
            </label>
            <input
              type="range"
              min="0"
              max={videoDuration - 1}
              step="0.5"
              value={startTime}
              onChange={(e) => handleStartTimeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isTrimming}
            />
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End time: {formatTime(endTime)}
            </label>
            <input
              type="range"
              min={startTime + 1}
              max={videoDuration}
              step="0.5"
              value={endTime}
              onChange={(e) => handleEndTimeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isTrimming}
            />
          </div>

          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700">
              Selection: {formatTime(startTime)} — {formatTime(endTime)} ({formatTime(trimDuration)})
            </p>
            {trimDuration > maxDuration && (
              <p className="text-sm text-red-600 mt-1">
                Exceeds maximum duration of {formatTime(maxDuration)}
              </p>
            )}
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
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            disabled={isTrimming}
          >
            Cancel
          </button>
          <button
            onClick={trimVideo}
            disabled={isTrimming || trimDuration > maxDuration}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTrimming ? 'Trimming video...' : 'Trim Video'}
          </button>
        </div>
      </div>
    </div>
  );
};