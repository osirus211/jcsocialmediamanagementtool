import { useState, useRef, memo, useCallback, useMemo } from 'react';
import { MediaFile, FILE_VALIDATION } from '@/types/composer.types';
import { MediaItem } from './MediaItem';
import { DesignImportPanel } from '../media/DesignImportPanel';
import { StockPhotoPanel } from '../media/StockPhotoPanel';
import { Upload, Image, Video, Palette, Search, Eye, AlertCircle, Wand2 } from 'lucide-react';
import { compressImageFile, isImageFile } from '@/utils/imageCompression';

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
  const [isCompressing, setIsCompressing] = useState(false);
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

  const handleFiles = useCallback(async (files: File[]) => {
    // Check max files limit
    if (media.length + files.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`);
      return;
    }

    setIsCompressing(true);
    
    try {
      // Process files with compression for images
      const processedFiles: File[] = [];
      
      for (const file of files) {
        if (isImageFile(file)) {
          try {
            // Compress image files
            const compressedFile = await compressImageFile(file, 2048, 0.85);
            processedFiles.push(compressedFile);
          } catch (error) {
            console.warn('Failed to compress image, using original:', error);
            processedFiles.push(file);
          }
        } else {
          // Keep non-image files as-is
          processedFiles.push(file);
        }
      }

      onUpload(processedFiles);
    } catch (error) {
      console.error('Error processing files:', error);
      // Fallback to original files if processing fails
      onUpload(files);
    } finally {
      setIsCompressing(false);
    }
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

  const handleDesignImport = useCallback(async (file: File) => {
    // Check max files limit
    if (media.length + 1 > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`);
      return;
    }

    setIsCompressing(true);
    
    try {
      let processedFile = file;
      
      if (isImageFile(file)) {
        try {
          processedFile = await compressImageFile(file, 2048, 0.85);
        } catch (error) {
          console.warn('Failed to compress imported image, using original:', error);
        }
      }

      onUpload([processedFile]);
      setShowDesignImport(false);
    } finally {
      setIsCompressing(false);
    }
  }, [media.length, maxFiles, onUpload]);

  const handleStockPhotoImport = useCallback(async (file: File) => {
    // Check max files limit
    if (media.length + 1 > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files`);
      return;
    }

    setIsCompressing(true);
    
    try {
      let processedFile = file;
      
      if (isImageFile(file)) {
        try {
          processedFile = await compressImageFile(file, 2048, 0.85);
        } catch (error) {
          console.warn('Failed to compress stock photo, using original:', error);
        }
      }

      onUpload([processedFile]);
      setShowStockPhotos(false);
    } finally {
      setIsCompressing(false);
    }
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
        
        {isCompressing ? (
          <div className="space-y-2">
            <p className="text-blue-600 font-medium">
              Optimizing images...
            </p>
            <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <p className="text-gray-700 font-medium mb-1">
              Drop files here or click to browse
            </p>
            
            <p className="text-sm text-gray-500 mb-3">
              Upload images or videos
            </p>
          </>
        )}

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
        <>
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

          {/* Accessibility Score */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Accessibility Score</span>
            </div>
            <div className="flex items-center gap-3">
              {(() => {
                const altTextCount = media.filter(item => 
                  item.metadata?.altText || 
                  (item.metadata?.platformAltTexts && Object.values(item.metadata.platformAltTexts).some(text => !!text))
                ).length;
                const score = media.length > 0 ? Math.round((altTextCount / media.length) * 100) : 100;
                const level = score === 100 ? 'excellent' : score >= 50 ? 'good' : 'poor';
                const color = level === 'excellent' ? 'text-green-600' : level === 'good' ? 'text-yellow-600' : 'text-red-600';
                
                return (
                  <>
                    <span className={`text-sm font-medium ${color}`}>
                      {altTextCount}/{media.length} images have alt text
                    </span>
                    <div className={`px-2 py-1 text-xs font-medium rounded ${
                      level === 'excellent' ? 'bg-green-100 text-green-800' :
                      level === 'good' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {score}% ({level})
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Bulk Alt Text Action */}
          {(() => {
            const missingAltText = media.filter(item => 
              !item.metadata?.altText && 
              !(item.metadata?.platformAltTexts && Object.values(item.metadata.platformAltTexts).some(text => !!text))
            );
            
            if (missingAltText.length > 0) {
              return (
                <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-800">
                      {missingAltText.length} image{missingAltText.length > 1 ? 's' : ''} missing alt text
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // TODO: Implement bulk alt text generation
                      console.log('Bulk alt text generation for:', missingAltText);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    <Wand2 className="h-3 w-3" />
                    Add Alt Text to All
                  </button>
                </div>
              );
            }
            return null;
          })()}
        </>
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
