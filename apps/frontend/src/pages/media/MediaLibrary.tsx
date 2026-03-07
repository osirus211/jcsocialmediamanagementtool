import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { composerService } from '@/services/composer.service';
import { Media } from '@/types/composer.types';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaGrid } from '@/components/media/MediaGrid';
import { AlertCircle, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { SuccessToast } from '@/components/feedback/SuccessToast';

/**
 * MediaLibraryPage Component
 * 
 * Complete media library with upload, browse, and delete
 * 
 * Features:
 * - Upload media (drag & drop + click)
 * - Browse media (grid layout)
 * - Delete media
 * - Pagination
 * - Loading/empty states
 * 
 * Performance:
 * - Lazy loading
 * - Pagination (20 per page)
 * - Efficient re-renders
 * 
 * Safety:
 * - File validation
 * - Error handling
 * - No UI freeze
 */
export function MediaLibraryPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Fetch media library
   */
  const fetchMedia = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await composerService.getMediaLibrary(page, 20);
      
      setMedia(response.media);
      setCurrentPage(response.page);
      setTotalPages(response.totalPages);
    } catch (err: any) {
      console.error('Fetch media error:', err);
      setError(err.response?.data?.message || 'Failed to load media library');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load on mount
   */
  useEffect(() => {
    if (currentWorkspace) {
      fetchMedia();
    }
  }, [currentWorkspace, fetchMedia]);

  /**
   * Handle upload complete
   */
  const handleUploadComplete = useCallback((mediaIds: string[]) => {
    // Refresh media library
    fetchMedia(1);
    
    setSuccessMessage(`${mediaIds.length} file(s) uploaded successfully!`);
    setShowSuccessToast(true);
  }, [fetchMedia]);

  /**
   * Handle delete media
   */
  const handleDelete = useCallback(async (mediaId: string) => {
    try {
      await composerService.deleteMedia(mediaId);
      
      // Remove from list
      setMedia((prev) => prev.filter((m) => m._id !== mediaId));
      
      setSuccessMessage('Media deleted successfully!');
      setShowSuccessToast(true);
    } catch (err: any) {
      console.error('Delete media error:', err);
      setError(err.response?.data?.message || 'Failed to delete media');
    }
  }, []);

  /**
   * Handle page change
   */
  const handlePageChange = useCallback((page: number) => {
    fetchMedia(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchMedia]);

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Please select a workspace first
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Media Library</h1>
            <p className="text-gray-600 mt-1">
              Upload and manage your media files
            </p>
          </div>
          
          <button
            onClick={() => fetchMedia(currentPage)}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Upload section */}
        <div className="mb-8">
          <MediaUploader onUploadComplete={handleUploadComplete} />
        </div>

        {/* Media grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Your Media ({media.length})
            </h2>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading media...</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && media.length === 0 && (
            <div className="text-center py-12 bg-white border rounded-lg">
              <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No media yet
              </h3>
              <p className="text-gray-600 mb-4">
                Upload your first image or video to get started
              </p>
            </div>
          )}

          {/* Media grid */}
          {!isLoading && media.length > 0 && (
            <>
              <MediaGrid
                media={media}
                onDelete={handleDelete}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Success toast */}
      {showSuccessToast && (
        <SuccessToast
          message={successMessage}
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
}
