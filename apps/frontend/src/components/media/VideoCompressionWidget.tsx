/**
 * Video Compression Widget
 * Shows compression options when video exceeds platform limits
 */

import React, { useState, useCallback } from 'react';
import { SocialPlatform, PLATFORM_VIDEO_LIMITS } from '@/types/composer.types';
import { Zap, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface VideoCompressionWidgetProps {
  videoFile: File;
  videoSize: number;
  platform: SocialPlatform[];
  onCompressed: (compressedFile: File) => void;
  onClose: () => void;
}

interface CompressionPreset {
  name: string;
  quality: number;
  estimatedReduction: number;
  description: string;
}

export const VideoCompressionWidget: React.FC<VideoCompressionWidgetProps> = ({
  videoFile,
  videoSize,
  platform,
  onCompressed,
  onClose,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<CompressionPreset | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Get the most restrictive platform limit
  const getMinPlatformLimit = useCallback(() => {
    let minLimit = Infinity;
    let restrictivePlatform = '';

    for (const p of platform) {
      const limits = PLATFORM_VIDEO_LIMITS[p];
      if (limits && limits.maxSize < minLimit) {
        minLimit = limits.maxSize;
        restrictivePlatform = p;
      }
    }

    return { limit: minLimit, platform: restrictivePlatform };
  }, [platform]);

  const { limit: platformLimit, platform: restrictivePlatform } = getMinPlatformLimit();

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const compressionPresets: CompressionPreset[] = [
    {
      name: 'High Quality',
      quality: 0.9,
      estimatedReduction: 0.25, // 25% reduction
      description: 'Minimal quality loss, good for professional content',
    },
    {
      name: 'Medium Quality',
      quality: 0.75,
      estimatedReduction: 0.45, // 45% reduction
      description: 'Balanced quality and size, recommended for most content',
    },
    {
      name: 'Low Quality',
      quality: 0.5,
      estimatedReduction: 0.65, // 65% reduction
      description: 'Significant size reduction, suitable for previews',
    },
  ];

  const getEstimatedSize = (preset: CompressionPreset): number => {
    return Math.floor(videoSize * (1 - preset.estimatedReduction));
  };

  const handleCompress = useCallback(async () => {
    if (!selectedPreset) return;

    setIsCompressing(true);
    setError(null);
    setCompressionProgress(0);

    try {
      // Simulate compression progress
      const progressInterval = setInterval(() => {
        setCompressionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      // TODO: Implement actual video compression
      // This would typically involve:
      // 1. Creating a FormData with the video file and compression settings
      // 2. Sending to backend compression endpoint
      // 3. Receiving compressed video file
      
      // For now, simulate compression
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      clearInterval(progressInterval);
      setCompressionProgress(100);

      // Create a mock compressed file (in real implementation, this would be the actual compressed file)
      const estimatedSize = getEstimatedSize(selectedPreset);
      const compressedFile = new File(
        [videoFile.slice(0, estimatedSize)], // Mock compression
        videoFile.name.replace(/\.[^.]+$/, '_compressed.mp4'),
        { type: 'video/mp4' }
      );

      onCompressed(compressedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed');
    } finally {
      setIsCompressing(false);
    }
  }, [selectedPreset, videoFile, videoSize, onCompressed]);

  const isOverLimit = videoSize > platformLimit;
  const exceedsBy = videoSize - platformLimit;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <h3 className="font-medium text-orange-800">Video Size Warning</h3>
        </div>
        <button
          onClick={onClose}
          className="text-orange-400 hover:text-orange-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4">
        <p className="text-sm text-orange-700 mb-2">
          Your video ({formatFileSize(videoSize)}) exceeds the {restrictivePlatform} limit of {formatFileSize(platformLimit)} by {formatFileSize(exceedsBy)}.
        </p>
        <p className="text-sm text-orange-600">
          Choose a compression preset to reduce the file size:
        </p>
      </div>

      {/* Compression Presets */}
      <div className="space-y-3 mb-4">
        {compressionPresets.map((preset) => {
          const estimatedSize = getEstimatedSize(preset);
          const willFitLimit = estimatedSize <= platformLimit;

          return (
            <div
              key={preset.name}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                selectedPreset?.name === preset.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => setSelectedPreset(preset)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={selectedPreset?.name === preset.name}
                    onChange={() => setSelectedPreset(preset)}
                    className="text-blue-600"
                  />
                  <span className="font-medium text-gray-900">{preset.name}</span>
                  {willFitLimit && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatFileSize(estimatedSize)}
                  </div>
                  <div className={`text-xs ${willFitLimit ? 'text-green-600' : 'text-red-600'}`}>
                    {willFitLimit ? 'Within limit' : 'Still over limit'}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 ml-6">{preset.description}</p>
            </div>
          );
        })}
      </div>

      {/* Compression Progress */}
      {isCompressing && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Compressing video...</span>
            <span className="text-sm text-gray-600">{Math.round(compressionProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${compressionProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCompress}
          disabled={!selectedPreset || isCompressing}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="h-4 w-4" />
          {isCompressing ? 'Compressing...' : 'Compress Video'}
        </button>
        
        <button
          onClick={onClose}
          disabled={isCompressing}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Skip Compression
        </button>
      </div>

      {/* Platform Limits Info */}
      <div className="mt-4 pt-3 border-t border-orange-200">
        <p className="text-xs text-orange-600 mb-1">Platform limits for selected networks:</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-orange-700">
          {platform.slice(0, 4).map(p => {
            const limits = PLATFORM_VIDEO_LIMITS[p];
            return limits ? (
              <div key={p} className="flex justify-between">
                <span className="capitalize">{p}:</span>
                <span>{formatFileSize(limits.maxSize)}</span>
              </div>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
};