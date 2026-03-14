import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { composerService } from '@/services/composer.service';
import { Media } from '@/types/composer.types';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaGrid } from '@/components/media/MediaGrid';
import { MediaSearchBar } from '@/components/media/MediaSearchBar';
import { MediaFiltersPanel, MediaFilters } from '@/components/media/MediaFilters';
import { MediaFolders, MediaFolder } from '@/components/media/MediaFolders';
import { BulkActionBar } from '@/components/media/BulkActionBar';
import { StorageUsageBar } from '@/components/media/StorageUsageBar';
import { RecentlyUsedMedia } from '@/components/media/RecentlyUsedMedia';
import { MediaDetailsPanel } from '@/components/media/MediaDetailsPanel';
import { TagCloudView } from '@/components/media/TagCloudView';
import { AlertCircle, Image as ImageIcon, RefreshCw, Grid, List } from 'lucide-react';
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

  // New state for enhanced features
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MediaFilters>({
    type: 'all',
    dateRange: 'all',
    sizeRange: 'all',
    sortBy: 'newest',
  });
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [recentlyUsedMedia, setRecentlyUsedMedia] = useState<Media[]>([]);
  const [storageUsage, setStorageUsage] = useState({
    used: 0,
    total: 5 * 1024 * 1024 * 1024, // 5GB default
    images: 0,
    videos: 0,
  });
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [platforms] = useState(['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok']);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  /**
   * Fetch media library with filters
   */
  const fetchMedia = useCallback(async (page: number = 1, resetPage: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const searchFilters = {
        search: searchQuery,
        ...filters,
        folderId: currentFolderId,
        page: resetPage ? 1 : page,
        limit: 20,
      };
      
      const response = await composerService.getMediaLibrary(searchFilters);
      
      setMedia(response.media);
      setCurrentPage(response.page);
      setTotalPages(response.totalPages);
      
      if (resetPage) {
        setCurrentPage(1);
      }
    } catch (err: any) {
      console.error('Fetch media error:', err);
      setError(err.response?.data?.message || 'Failed to load media library');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filters, currentFolderId]);

  /**
   * Fetch folders
   */
  const fetchFolders = useCallback(async () => {
    try {
      const response = await composerService.getMediaFolders();
      setFolders(response.folders);
    } catch (err: any) {
      console.error('Fetch folders error:', err);
    }
  }, []);

  /**
   * Fetch recently used media
   */
  const fetchRecentlyUsed = useCallback(async () => {
    try {
      const response = await composerService.getRecentlyUsedMedia();
      setRecentlyUsedMedia(response.media);
    } catch (err: any) {
      console.error('Fetch recently used error:', err);
    }
  }, []);

  /**
   * Fetch storage usage
   */
  const fetchStorageUsage = useCallback(async () => {
    try {
      const response = await composerService.getStorageUsage();
      setStorageUsage(response);
    } catch (err: any) {
      console.error('Fetch storage usage error:', err);
    }
  }, []);

  /**
   * Load on mount and when dependencies change
   */
  useEffect(() => {
    if (currentWorkspace) {
      fetchMedia(1, true);
      fetchFolders();
      fetchRecentlyUsed();
      fetchStorageUsage();
    }
  }, [currentWorkspace, searchQuery, filters, currentFolderId]);

  /**
   * Handle search
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Handle filters change
   */
  const handleFiltersChange = useCallback((newFilters: MediaFilters) => {
    setFilters(newFilters);
  }, []);

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setFilters({
      type: 'all',
      dateRange: 'all',
      sizeRange: 'all',
      sortBy: 'newest',
    });
    setSearchQuery('');
  }, []);

  /**
   * Handle folder operations
   */
  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      await composerService.createMediaFolder(name);
      fetchFolders();
      setSuccessMessage('Folder created successfully!');
      setShowSuccessToast(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create folder');
    }
  }, [fetchFolders]);

  const handleRenameFolder = useCallback(async (folderId: string, newName: string) => {
    try {
      await composerService.renameMediaFolder(folderId, newName);
      fetchFolders();
      setSuccessMessage('Folder renamed successfully!');
      setShowSuccessToast(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to rename folder');
    }
  }, [fetchFolders]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    try {
      await composerService.deleteMediaFolder(folderId);
      fetchFolders();
      fetchMedia(1, true);
      setSuccessMessage('Folder deleted successfully!');
      setShowSuccessToast(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete folder');
    }
  }, [fetchFolders, fetchMedia]);

  /**
   * Handle bulk operations
   */
  const handleBulkDelete = useCallback(async () => {
    try {
      await composerService.bulkDeleteMedia(selectedMediaIds);
      setSelectedMediaIds([]);
      fetchMedia(currentPage);
      setSuccessMessage(`${selectedMediaIds.length} files deleted successfully!`);
      setShowSuccessToast(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete files');
    }
  }, [selectedMediaIds, currentPage, fetchMedia]);

  const handleBulkMove = useCallback(async (folderId?: string) => {
    try {
      await composerService.moveMediaToFolder(selectedMediaIds, folderId);
      setSelectedMediaIds([]);
      fetchMedia(currentPage);
      setSuccessMessage(`${selectedMediaIds.length} files moved successfully!`);
      setShowSuccessToast(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to move files');
    }
  }, [selectedMediaIds, currentPage, fetchMedia]);

  const handleBulkDownload = useCallback(async () => {
    try {
      await composerService.bulkDownloadMedia(selectedMediaIds);
      setSelectedMediaIds([]);
      setSuccessMessage(`${selectedMediaIds.length} files downloaded successfully!`);
      setShowSuccessToast(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to download files');
    }
  }, [selectedMediaIds]);

  /**
   * Handle upload complete
   */
  const handleUploadComplete = useCallback((mediaIds: string[]) => {
    // Refresh media library
    fetchMedia(1, true);
    fetchStorageUsage();
    
    setSuccessMessage(`${mediaIds.length} file(s) uploaded successfully!`);
    setShowSuccessToast(true);
  }, [fetchMedia, fetchStorageUsage]);

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
   * Handle copy URL
   */
  const handleCopyUrl = useCallback(async (mediaId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setSuccessMessage('URL copied to clipboard!');
      setShowSuccessToast(true);
    } catch (err) {
      setError('Failed to copy URL to clipboard');
    }
  }, []);

  /**
   * Handle download
   */
  const handleDownload = useCallback((mediaId: string, url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSuccessMessage('Download started!');
    setShowSuccessToast(true);
  }, []);

  /**
   * Handle media update
   */
  const handleMediaUpdate = useCallback(async (mediaId: string, updates: Partial<Media>) => {
    try {
      await composerService.updateMedia(mediaId, updates);
      
      // Update local state
      setMedia(prev => prev.map(m => 
        m._id === mediaId ? { ...m, ...updates } : m
      ));
      
      setSuccessMessage('Media updated successfully!');
      setShowSuccessToast(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update media');
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
    <div className="flex h-screen bg-gray-50">
      {/* Folders Sidebar */}
      <MediaFolders
        folders={folders}
        currentFolderId={currentFolderId}
        onFolderSelect={setCurrentFolderId}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Media Library</h1>
              <p className="text-gray-600 mt-1">
                Upload and manage your media files
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
                >
                  <List className="w-4 h-4" />
                </button>
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
          </div>

          {/* Storage Usage */}
          <StorageUsageBar
            usedBytes={storageUsage.used}
            totalBytes={storageUsage.total}
            imageBytes={storageUsage.images}
            videoBytes={storageUsage.videos}
          />

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

          {/* Search and Filters */}
          <MediaSearchBar
            onSearch={handleSearch}
            onToggleFilters={() => setShowFilters(!showFilters)}
            showFilters={showFilters}
            searchQuery={searchQuery}
          />

          {showFilters && (
            <MediaFiltersPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
              platforms={platforms}
            />
          )}

          {/* Recently Used */}
          {!searchQuery && !showFilters && currentFolderId === undefined && (
            <RecentlyUsedMedia
              media={recentlyUsedMedia}
              onMediaSelect={setSelectedMedia}
            />
          )}

          {/* Media grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {currentFolderId ? 
                  folders.find(f => f.id === currentFolderId)?.name || 'Folder' :
                  `Your Media (${media.length})`
                }
              </h2>
              
              {media.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={selectedMediaIds.length === media.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMediaIds(media.map(m => m._id));
                        } else {
                          setSelectedMediaIds([]);
                        }
                      }}
                      className="rounded"
                    />
                    Select All
                  </label>
                </div>
              )}
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
                  selectedMediaIds={selectedMediaIds}
                  onSelect={(mediaId) => {
                    setSelectedMediaIds(prev => 
                      prev.includes(mediaId) 
                        ? prev.filter(id => id !== mediaId)
                        : [...prev, mediaId]
                    );
                  }}
                  onDelete={handleDelete}
                  onCopyUrl={handleCopyUrl}
                  onDownload={handleDownload}
                  showBulkActions={true}
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
      </div>

      {/* Media Details Panel */}
      {selectedMedia && (
        <MediaDetailsPanel
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onUpdate={handleMediaUpdate}
          onDelete={(mediaId) => {
            handleDelete(mediaId);
            setSelectedMedia(null);
          }}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedMediaIds.length}
        onClearSelection={() => setSelectedMediaIds([])}
        onBulkDelete={handleBulkDelete}
        onBulkTag={() => {/* TODO: Implement bulk tagging */}}
        onBulkMove={() => {/* TODO: Implement bulk move modal */}}
        onBulkDownload={handleBulkDownload}
      />

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
