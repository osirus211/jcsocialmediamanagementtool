/**
 * Video Metadata Display Component
 * Shows detailed video information and platform compatibility
 */

import React from 'react';
import { MediaFile, SocialPlatform } from '@/types/composer.types';
import { 
  validateVideo, 
  getPlatformRequirements, 
  getVideoQualityLabel, 
  getVideoOrientation 
} from '@/utils/videoValidation';
import { 
  Clock, 
  Monitor, 
  HardDrive, 
  FileType, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Eye
} from 'lucide-react';

interface VideoMetadataDisplayProps {
  media: MediaFile;
  selectedPlatforms: SocialPlatform[];
  className?: string;
}

export const VideoMetadataDisplay: React.FC<VideoMetadataDisplayProps> = ({
  media,
  selectedPlatforms,
  className = '',
}) => {
  if (media.type !== 'video') return null;

  const videoMetadata = {
    size: media.size,
    duration: media.duration || 0,
    width: media.width || 0,
    height: media.height || 0,
    mimeType: media.mimeType,
    fps: media.fps,
    bitrate: media.bitrate,
  };

  const validation = validateVideo(videoMetadata, selectedPlatforms);
  const qualityLabel = getVideoQualityLabel(videoMetadata.width, videoMetadata.height);
  const orientation = getVideoOrientation(videoMetadata.width, videoMetadata.height);

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

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBitrate = (bitrate?: number): string => {
    if (!bitrate) return 'Unknown';
    if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    if (bitrate >= 1000) return `${(bitrate / 1000).toFixed(0)} Kbps`;
    return `${bitrate} bps`;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Eye className="h-5 w-5 text-gray-600" />
        <h3 className="font-medium text-gray-900">Video Details</h3>
      </div>

      {/* Basic metadata */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Duration:</span>
          <span className="text-sm font-medium">{formatDuration(videoMetadata.duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Resolution:</span>
          <span className="text-sm font-medium">
            {videoMetadata.width}×{videoMetadata.height} ({qualityLabel})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Size:</span>
          <span className="text-sm font-medium">{formatFileSize(videoMetadata.size)}</span>
        </div>

        <div className="flex items-center gap-2">
          <FileType className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Format:</span>
          <span className="text-sm font-medium">
            {videoMetadata.mimeType.split('/')[1].toUpperCase()}
          </span>
        </div>

        {videoMetadata.fps && (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Frame Rate:</span>
            <span className="text-sm font-medium">{videoMetadata.fps} FPS</span>
          </div>
        )}

        {videoMetadata.bitrate && (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Bitrate:</span>
            <span className="text-sm font-medium">{formatBitrate(videoMetadata.bitrate)}</span>
          </div>
        )}
      </div>

      {/* Orientation badge */}
      <div className="mb-4">
        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
          orientation === 'portrait' ? 'bg-purple-100 text-purple-800' :
          orientation === 'landscape' ? 'bg-blue-100 text-blue-800' :
          'bg-green-100 text-green-800'
        }`}>
          {orientation === 'portrait' && '📱'} 
          {orientation === 'landscape' && '🖥️'} 
          {orientation === 'square' && '⬜'} 
          {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
        </span>
      </div>

      {/* Platform compatibility */}
      {selectedPlatforms.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Platform Compatibility</h4>
          
          {selectedPlatforms.map(platform => {
            const compatibility = validation.platformCompatibility[platform];
            if (!compatibility) return null;

            return (
              <div key={platform} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium capitalize">{platform}</span>
                  <div className="flex items-center gap-1">
                    {compatibility.compatible ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-xs font-medium ${
                      compatibility.compatible ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {compatibility.compatible ? 'Compatible' : 'Issues Found'}
                    </span>
                  </div>
                </div>

                {/* Issues */}
                {compatibility.issues.length > 0 && (
                  <div className="mb-2">
                    {compatibility.issues.map((issue, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {compatibility.warnings.length > 0 && (
                  <div className="mb-2">
                    {compatibility.warnings.map((warning, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs text-yellow-600">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Platform requirements */}
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    View {platform} requirements
                  </summary>
                  <div className="mt-1 pl-4 border-l-2 border-gray-200">
                    {getPlatformRequirements(platform).map((req, index) => (
                      <div key={index} className="text-xs text-gray-600">
                        • {req}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {/* Global validation summary */}
      {validation.errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">Validation Errors</span>
          </div>
          <div className="space-y-1">
            {validation.errors.slice(0, 3).map((error, index) => (
              <div key={index} className="text-xs text-red-600">• {error}</div>
            ))}
            {validation.errors.length > 3 && (
              <div className="text-xs text-red-500">
                ... and {validation.errors.length - 3} more issues
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing status */}
      {media.metadata?.processing && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-blue-700">Processing Video</span>
          </div>
          <div className="space-y-1 text-xs text-blue-600">
            {media.metadata.processing.transcoding && <div>• Transcoding video...</div>}
            {media.metadata.processing.thumbnailGeneration && <div>• Generating thumbnails...</div>}
            {media.metadata.processing.compression && <div>• Compressing video...</div>}
            {media.metadata.processing.validation && <div>• Validating format...</div>}
          </div>
        </div>
      )}
    </div>
  );
};