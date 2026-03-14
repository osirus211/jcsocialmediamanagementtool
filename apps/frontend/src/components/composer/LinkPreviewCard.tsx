import { useState, memo, useCallback } from 'react';
import { X, ExternalLink, Upload, RefreshCw } from 'lucide-react';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface LinkPreviewCardProps {
  preview: LinkPreview;
  onRemove: () => void;
  onCustomImageUpload?: (file: File) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const LinkPreviewCard = memo(function LinkPreviewCard({
  preview,
  onRemove,
  onCustomImageUpload,
  onRefresh,
  isLoading = false,
}: LinkPreviewCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCustomImageUpload) {
      onCustomImageUpload(file);
    }
  }, [onCustomImageUpload]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <ExternalLink className="h-4 w-4" />
          <span>Link Preview</span>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              title="Refresh preview"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Remove preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-4 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading preview...</span>
          </div>
        </div>
      )}

      {/* Preview Content */}
      {!isLoading && (
        <div className="flex">
          {/* Image */}
          <div className="w-32 h-24 bg-gray-100 flex-shrink-0 relative">
            {preview.image && !imageError ? (
              <img
                src={preview.image}
                alt={preview.title || 'Link preview'}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <ExternalLink className="h-6 w-6 text-gray-400" />
              </div>
            )}
            
            {/* Custom Image Upload */}
            {onCustomImageUpload && (
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="p-2 bg-white rounded-full text-gray-600 hover:bg-gray-100 transition-colors">
                    <Upload className="h-4 w-4" />
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 min-w-0">
            {/* Site Name */}
            {preview.siteName && (
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {preview.siteName}
              </div>
            )}

            {/* Title */}
            <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
              {preview.title || 'No title available'}
            </h3>

            {/* Description */}
            {preview.description && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                {preview.description}
              </p>
            )}

            {/* URL */}
            <div className="text-xs text-gray-500 truncate">
              {preview.url}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export { LinkPreviewCard, type LinkPreview };