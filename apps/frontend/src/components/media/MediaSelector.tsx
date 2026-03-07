import { useState, useEffect, useCallback } from 'react';
import { composerService } from '@/services/composer.service';
import { Media } from '@/types/composer.types';
import { MediaGrid } from './MediaGrid';
import { MediaUploader } from './MediaUploader';
import { X, Image as ImageIcon } from 'lucide-react';

interface MediaSelectorProps {
  selectedMediaIds: string[];
  onSelect: (mediaIds: string[]) => void;
  onClose: () => void;
  maxSelection?: number;
}

/**
 * MediaSelector Component
 * 
 * Modal for selecting media from library or uploading new
 * 
 * Features:
 * - Browse media library
 * - Upload new media
 * - Multi-select
 * - Max selection limit
 * - Prevent duplicates
 * 
 * Usage in Composer:
 * - Select media from library
 * - Attach to draft
 * - Remove from draft
 */
export function MediaSelector({
  selectedMediaIds,
  onSelect,
  onClose,
  maxSelection,
}: MediaSelectorProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localSelection, setLocalSelection] = useState<string[]>(selectedMediaIds);
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');

  /**
   * Fetch media library
   */
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setIsLoading(true);
        const response = await composerService.getMediaLibrary(1, 50);
        setMedia(response.media);
      } catch (error) {
        console.error('Fetch media error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedia();
  }, []);

  /**
   * Handle media selection toggle
   */
  const handleToggleSelection = useCallback((mediaId: string) => {
    setLocalSelection((prev) => {
      if (prev.includes(mediaId)) {
        // Deselect
        return prev.filter((id) => id !== mediaId);
      } else {
        // Select (check max limit)
        if (maxSelection && prev.length >= maxSelection) {
          return prev;
        }
        return [...prev, mediaId];
      }
    });
  }, [maxSelection]);

  /**
   * Handle upload complete
   */
  const handleUploadComplete = useCallback((mediaIds: string[]) => {
    // Add newly uploaded media to selection
    setLocalSelection((prev) => {
      const newSelection = [...prev];
      mediaIds.forEach((id) => {
        if (!newSelection.includes(id)) {
          if (!maxSelection || newSelection.length < maxSelection) {
            newSelection.push(id);
          }
        }
      });
      return newSelection;
    });

    // Refresh media library
    composerService.getMediaLibrary(1, 50).then((response) => {
      setMedia(response.media);
    });

    // Switch to library tab
    setActiveTab('library');
  }, [maxSelection]);

  /**
   * Handle confirm selection
   */
  const handleConfirm = useCallback(() => {
    onSelect(localSelection);
    onClose();
  }, [localSelection, onSelect, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Select Media</h2>
            <p className="text-sm text-gray-600 mt-1">
              {localSelection.length} selected
              {maxSelection && ` (max ${maxSelection})`}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'library'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Media Library
          </button>
          
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload New
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'library' ? (
            <>
              {isLoading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading media...</p>
                </div>
              )}

              {!isLoading && media.length === 0 && (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    No media yet
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Upload your first image or video
                  </p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Upload Media
                  </button>
                </div>
              )}

              {!isLoading && media.length > 0 && (
                <MediaGrid
                  media={media}
                  selectedMediaIds={localSelection}
                  onSelect={handleToggleSelection}
                  selectable
                />
              )}
            </>
          ) : (
            <MediaUploader onUploadComplete={handleUploadComplete} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={localSelection.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select ({localSelection.length})
          </button>
        </div>
      </div>
    </div>
  );
}
