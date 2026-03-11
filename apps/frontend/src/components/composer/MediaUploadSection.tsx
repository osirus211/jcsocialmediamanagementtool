import { useState, useRef, memo, useCallback, useMemo } from 'react';
import { MediaFile, FILE_VALIDATION } from '@/types/composer.types';
import { MediaItem } from './MediaItem';
import { DesignImportPanel } from '../media/DesignImportPanel';
import { StockPhotoPanel } from '../media/StockPhotoPanel';
import { Upload, Image, Video, Palette, Search } from 'lucide-react';

interface MediaUploadSectionProps {
  media: MediaFile[];
  selectedPlatforms?: string[];
  onUpload: (files: File[]) => void;
  onRemove: (mediaId: string) => void;
  onMediaUpdate?: (mediaId: string, updates: Partial<MediaFile>) => void;
  onMediaReplace?: (oldMediaId: string, newMedia: MediaFile) => void;
  maxFiles?: number;
}

const MediaUploadSection = memo(function MediaUploadSection({
  media,
  selectedPlatforms = [],
  onUpload,
  onRemove,
  onMediaUpdate,
  onMediaReplace,
  maxFiles = 10,
}: MediaUploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showDesignImport, setShowDesignImport] = useState(false);
  const [showStockPhotos, setShowStockPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = useMemo(() => [
    ...FILE_VALIDATION.image.types,
    ...FILE_VALIDATION.video.types,
  ].join(','), []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    // Check max files limit
    if (media.length + files.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`);
      return;
    }

    onUpload(files);
  }, [media.length, maxFiles, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDesignImport = useCallback((file: File) => {
    // Check max files limit
    if (media.length + 1 > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`);
      return;
    }

    onUpload([file]);
    setShowDesignImport(false);
  }, [media.length, maxFiles, onUpload]);

  const handleStockPhotoImport = useCallback((file: File) => {
    // Check max files limit
    if (media.length + 1 > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`);
      return;
    }

    onUpload([file]);
    setShowStockPhotos(false);
  }, [media.length, maxFiles, onUpload]);

  const handleMediaUpdate = useCallback((updatedMedia: MediaFile) => {
    if (onMediaUpdate) {
      onMediaUpdate(updatedMedia.id, updatedMedia);
    }
  }, [onMediaUpdate]);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Media (Optional)
      </label>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload media files"
        />

        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        
        <p className="text-gray-700 font-medium mb-1">
          Drop files here or click to browse
        </p>
        
        <p className="text-sm text-gray-500 mb-3">
          Upload images or videos
        </p>

        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Image className="h-4 w-4" />
            <span>Images: JPG, PNG, GIF, WebP (max 10MB)</span>
          </div>
          <div className="flex items-center gap-1">
            <Video className="h-4 w-4" />
            <span>Videos: MP4, MOV, AVI (max 100MB)</span>
          </div>
        </div>
      </div>

      {/* Design Import Button */}
      <div className="flex justify-center gap-3">
        <button
          onClick={() => setShowDesignImport(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          <Palette className="h-4 w-4" />
          Import from Canva/Figma
        </button>
        
        <button
          onClick={() => setShowStockPhotos(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          <Search className="h-4 w-4" />
          Stock Photos
        </button>
      </div>

      {/* Media Grid */}
      {media.length > 0 && (
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          role="list"
          aria-label="Uploaded media files"
        >
          {media.map((item) => (
            <MediaItem
              key={item.id}
              media={item}
              selectedPlatforms={selectedPlatforms}
              onRemove={onRemove}
              onMediaUpdate={handleMediaUpdate}
              onMediaReplace={onMediaReplace}
            />
          ))}
        </div>
      )}

      {/* File Count */}
      {media.length > 0 && (
        <p className="text-sm text-gray-600">
          {media.length} / {maxFiles} files uploaded
        </p>
      )}

      {/* Design Import Panel */}
      {showDesignImport && (
        <DesignImportPanel
          onImport={handleDesignImport}
          onClose={() => setShowDesignImport(false)}
        />
      )}

      {/* Stock Photo Panel */}
      {showStockPhotos && (
        <StockPhotoPanel
          onImport={handleStockPhotoImport}
          onClose={() => setShowStockPhotos(false)}
        />
      )}
    </div>
  );
});

export { MediaUploadSection };
