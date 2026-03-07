import { MediaFile } from '@/types/composer.types';
import { X, RefreshCw, AlertCircle } from 'lucide-react';

interface MediaItemProps {
  media: MediaFile;
  onRemove: (mediaId: string) => void;
  onRetry?: (mediaId: string) => void;
}

export function MediaItem({ media, onRemove, onRetry }: MediaItemProps) {
  const isUploading = media.uploadStatus === 'uploading';
  const isError = media.uploadStatus === 'error';
  const isCompleted = media.uploadStatus === 'completed';

  return (
    <div className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden">
      {/* Media Preview */}
      {media.type === 'image' && (
        <img
          src={media.thumbnailUrl || media.url}
          alt={media.filename}
          className="w-full h-full object-cover"
        />
      )}
      
      {media.type === 'video' && (
        <video
          src={media.url}
          className="w-full h-full object-cover"
          muted
        />
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
          <div className="w-3/4 bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${media.uploadProgress || 0}%` }}
            />
          </div>
          <span className="text-white text-sm">
            {media.uploadProgress || 0}%
          </span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="absolute inset-0 bg-red-50 bg-opacity-90 flex flex-col items-center justify-center p-2">
          <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
          <p className="text-xs text-red-600 text-center mb-2">
            {media.errorMessage || 'Upload failed'}
          </p>
          {onRetry && (
            <button
              onClick={() => onRetry(media.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Remove Button */}
      {(isCompleted || isError) && (
        <button
          onClick={() => onRemove(media.id)}
          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
          aria-label="Remove media"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* File Info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-xs truncate">{media.filename}</p>
      </div>
    </div>
  );
}
