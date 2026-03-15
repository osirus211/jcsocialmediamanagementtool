import { useState, useCallback } from 'react';
import { Media } from '@/types/composer.types';
import { Trash2, Check, Play, Copy, Download, MoreHorizontal, Tag, Folder } from 'lucide-react';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';

interface MediaGridProps {
  media: Media[];
  selectedMediaIds?: string[];
  onSelect?: (mediaId: string) => void;
  onDelete?: (mediaId: string) => void;
  onCopyUrl?: (mediaId: string, url: string) => void;
  onDownload?: (mediaId: string, url: string, filename: string) => void;
  onMoveToFolder?: (mediaIds: string[], folderId?: string) => void;
  onUpdateTags?: (mediaId: string, tags: string[]) => void;
  selectable?: boolean;
  showBulkActions?: boolean;
  allowDragDrop?: boolean;
  showTags?: boolean;
}

/**
 * MediaGrid Component
 * 
 * Grid layout for media items with enhanced folder and tagging support
 * 
 * Features:
 * - Responsive grid
 * - Thumbnail preview
 * - Selection (optional)
 * - Delete action
 * - Video indicator
 * - Drag & drop for folder organization
 * - Tag display and editing
 * 
 * Performance:
 * - Lazy loading images
 * - Efficient re-renders
 * - Memoized callbacks
 */
export function MediaGrid({
  media,
  selectedMediaIds = [],
  onSelect,
  onDelete,
  onCopyUrl,
  onDownload,
  onMoveToFolder,
  onUpdateTags,
  selectable = false,
  showBulkActions = false,
  allowDragDrop = false,
  showTags = false,
}: MediaGridProps) {
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<Media | null>(null);
  const [hoveredMediaId, setHoveredMediaId] = useState<string | null>(null);
  const [draggedMediaIds, setDraggedMediaIds] = useState<string[]>([]);

  /**
   * Handle media selection
   */
  const handleSelect = useCallback((mediaId: string) => {
    if (onSelect) {
      onSelect(mediaId);
    }
  }, [onSelect]);

  /**
   * Handle delete click
   */
  const handleDeleteClick = useCallback((media: Media, e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaToDelete(media);
    setShowDeleteModal(true);
  }, []);

  /**
   * Handle copy URL
   */
  const handleCopyUrl = useCallback(async (media: Media, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopyUrl) {
      onCopyUrl(media._id, media.url);
    } else {
      try {
        await navigator.clipboard.writeText(media.url);
        // Show success toast
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  }, [onCopyUrl]);

  /**
   * Handle download
   */
  const handleDownload = useCallback((media: Media, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(media._id, media.url, media.filename);
    } else {
      const link = document.createElement('a');
      link.href = media.url;
      link.download = media.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [onDownload]);

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((e: React.DragEvent, mediaId: string) => {
    if (!allowDragDrop) return;
    
    // If the dragged item is selected, drag all selected items
    const itemsToDrag = selectedMediaIds.includes(mediaId) 
      ? selectedMediaIds 
      : [mediaId];
    
    setDraggedMediaIds(itemsToDrag);
    e.dataTransfer.setData('application/json', JSON.stringify(itemsToDrag));
    e.dataTransfer.effectAllowed = 'move';
  }, [allowDragDrop, selectedMediaIds]);

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(() => {
    setDraggedMediaIds([]);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!mediaToDelete || !onDelete) return;
    
    setDeletingMediaId(mediaToDelete._id);
    await onDelete(mediaToDelete._id);
    setDeletingMediaId(null);
    setShowDeleteModal(false);
    setMediaToDelete(null);
  }, [mediaToDelete, onDelete]);

  /**
   * Check if media is selected
   */
  const isSelected = useCallback((mediaId: string): boolean => {
    return selectedMediaIds.includes(mediaId);
  }, [selectedMediaIds]);

  /**
   * Check if media is being dragged
   */
  const isDragged = useCallback((mediaId: string): boolean => {
    return draggedMediaIds.includes(mediaId);
  }, [draggedMediaIds]);

  if (media.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {media.map((item) => {
          const selected = isSelected(item._id);
          const dragged = isDragged(item._id);
          const isVideo = item.type === 'VIDEO';
          
          return (
            <div
              key={item._id}
              draggable={allowDragDrop}
              onDragStart={(e) => handleDragStart(e, item._id)}
              onDragEnd={handleDragEnd}
              onClick={() => selectable && handleSelect(item._id)}
              onMouseEnter={() => setHoveredMediaId(item._id)}
              onMouseLeave={() => setHoveredMediaId(null)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                selectable ? 'cursor-pointer' : ''
              } ${allowDragDrop ? 'cursor-move' : ''} ${
                selected
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              } ${dragged ? 'opacity-50 scale-95' : ''}`}
            >
              {/* Thumbnail */}
              <img
                src={item.thumbnails?.medium || item.thumbnailUrl || item.url}
                alt={item.filename}
                loading="lazy"
                className="w-full h-full object-cover"
                draggable={false}
              />
              
              {/* Video indicator */}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <Play className="w-8 h-8 text-white" />
                </div>
              )}
              
              {/* Selection checkbox for bulk actions */}
              {showBulkActions && (
                <div className="absolute top-2 left-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => handleSelect(item._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}
              
              {/* Selection indicator */}
              {selectable && selected && !showBulkActions && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Folder indicator */}
              {item.folderId && (
                <div className="absolute top-2 left-2 p-1 bg-black bg-opacity-70 rounded-full">
                  <Folder className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Action buttons on hover */}
              {hoveredMediaId === item._id && !selectable && (
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={(e) => handleCopyUrl(item, e)}
                    className="p-1.5 bg-black bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-all"
                    title="Copy URL"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDownload(item, e)}
                    className="p-1.5 bg-black bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-all"
                    title="Download"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {onDelete && (
                    <button
                      onClick={(e) => handleDeleteClick(item, e)}
                      className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all group" />
              
              {/* Info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{item.filename}</p>
                <div className="flex items-center justify-between">
                  <p className="text-white text-xs opacity-75">
                    {formatFileSize(item.size)}
                  </p>
                  {showTags && item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-white opacity-75" />
                      <span className="text-white text-xs opacity-75">
                        {item.tags.length}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Tags display */}
                {showTags && item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-block px-1.5 py-0.5 bg-blue-600 bg-opacity-80 text-white text-xs rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="inline-block px-1.5 py-0.5 bg-gray-600 bg-opacity-80 text-white text-xs rounded-full">
                        +{item.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Drag indicator */}
              {allowDragDrop && dragged && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-blue-500 border-dashed rounded-lg flex items-center justify-center">
                  <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                    Moving {draggedMediaIds.length} item{draggedMediaIds.length > 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && mediaToDelete && (
        <ConfirmDeleteModal
          title="Delete Media"
          message="Are you sure you want to delete this media file? This action cannot be undone."
          itemName={mediaToDelete.filename}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setShowDeleteModal(false);
            setMediaToDelete(null);
          }}
          isDeleting={deletingMediaId === mediaToDelete._id}
        />
      )}
    </>
  );
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
