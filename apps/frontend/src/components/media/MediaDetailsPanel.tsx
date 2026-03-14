import { useState, useCallback, useRef } from 'react';
import { 
  X, 
  Edit2, 
  Check, 
  Copy, 
  Download, 
  Trash2, 
  Tag,
  Calendar,
  FileText,
  Image as ImageIcon,
  Play,
  ZoomIn,
  Zap
} from 'lucide-react';
import { Media } from '@/types/composer.types';
import { CompressionSettings, CompressionOptions } from './CompressionSettings';
import { CompressionPreview } from './CompressionPreview';

interface MediaDetailsPanelProps {
  media: Media;
  onClose: () => void;
  onUpdate: (mediaId: string, updates: Partial<Media>) => void;
  onDelete: (mediaId: string) => void;
  usedInPosts?: Array<{
    id: string;
    content: string;
    platform: string;
    scheduledAt?: Date;
  }>;
}

export function MediaDetailsPanel({
  media,
  onClose,
  onUpdate,
  onDelete,
  usedInPosts = [],
}: MediaDetailsPanelProps) {
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [editedFilename, setEditedFilename] = useState(media.filename);
  const [altText, setAltText] = useState(media.altText || '');
  const [tags, setTags] = useState<string[]>(media.tags || []);
  const [newTag, setNewTag] = useState('');
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [showCompression, setShowCompression] = useState(false);
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    quality: 85,
    format: 'auto',
    maxWidth: 2048,
    maxHeight: 2048,
    preserveExif: false,
    lossless: false,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilenameEdit = useCallback(() => {
    setIsEditingFilename(true);
    setEditedFilename(media.filename);
  }, [media.filename]);

  const handleFilenameSave = useCallback(() => {
    if (editedFilename.trim() && editedFilename !== media.filename) {
      onUpdate(media._id, { filename: editedFilename.trim() });
    }
    setIsEditingFilename(false);
  }, [editedFilename, media._id, media.filename, onUpdate]);

  const handleFilenameCancel = useCallback(() => {
    setEditedFilename(media.filename);
    setIsEditingFilename(false);
  }, [media.filename]);

  const handleAltTextSave = useCallback(() => {
    if (altText !== (media.altText || '')) {
      onUpdate(media._id, { altText });
    }
  }, [altText, media._id, media.altText, onUpdate]);

  const handleAddTag = useCallback(() => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      onUpdate(media._id, { tags: updatedTags });
      setNewTag('');
    }
  }, [newTag, tags, media._id, onUpdate]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    onUpdate(media._id, { tags: updatedTags });
  }, [tags, media._id, onUpdate]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(media.url);
      // Show toast notification
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }, [media.url]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = media.url;
    link.download = media.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [media.url, media.filename]);

  const handleCompressAndReplace = useCallback(async (compressedFile: File) => {
    // This would typically upload the compressed file and replace the original
    // For now, we'll just trigger a download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(compressedFile);
    link.download = `compressed_${media.filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowCompression(false);
  }, [media.filename]);

  const fetchMediaFile = useCallback(async (): Promise<File> => {
    try {
      const response = await fetch(media.url);
      const blob = await response.blob();
      return new File([blob], media.filename, { type: media.mimeType || 'image/jpeg' });
    } catch (error) {
      console.error('Failed to fetch media file:', error);
      throw error;
    }
  }, [media.url, media.filename, media.mimeType]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const isVideo = media.type === 'VIDEO' || media.mimeType?.startsWith('video/');
  const isImage = media.type === 'IMAGE' || media.mimeType?.startsWith('image/');

  return (
    <>
      <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-lg z-50 overflow-y-auto">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Media Details</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {isImage ? (
                <div className="relative w-full h-full">
                  <img
                    src={media.thumbnails?.large || media.thumbnailUrl || media.url}
                    alt={media.filename}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setShowImageZoom(true)}
                  />
                  <button
                    onClick={() => setShowImageZoom(true)}
                    className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              ) : isVideo ? (
                <video
                  src={media.url}
                  controls
                  className="w-full h-full object-cover"
                  poster={media.thumbnailUrl}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <FileText className="w-12 h-12" />
                </div>
              )}
            </div>
          </div>

          {/* Filename */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename
            </label>
            {isEditingFilename ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedFilename}
                  onChange={(e) => setEditedFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFilenameSave();
                    if (e.key === 'Escape') handleFilenameCancel();
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  autoFocus
                />
                <button
                  onClick={handleFilenameSave}
                  className="p-2 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleFilenameCancel}
                  className="p-2 text-gray-400 hover:bg-gray-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-900">{media.filename}</span>
                <button
                  onClick={handleFilenameEdit}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Type:</span>
              <span className="text-gray-900">{media.mimeType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Size:</span>
              <span className="text-gray-900">{formatFileSize(media.size)}</span>
            </div>
            {media.width && media.height && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dimensions:</span>
                <span className="text-gray-900">{media.width} × {media.height}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Uploaded:</span>
              <span className="text-gray-900">{formatDate(media.createdAt)}</span>
            </div>
          </div>

          {/* Alt Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alt Text
            </label>
            <textarea
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onBlur={handleAltTextSave}
              placeholder="Describe this image for accessibility..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag();
                }}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          {/* Used in Posts */}
          {usedInPosts.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Used in Posts ({usedInPosts.length})
              </label>
              <div className="space-y-2">
                {usedInPosts.map((post) => (
                  <div key={post.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="text-sm text-gray-900 mb-1">
                      {post.content.substring(0, 100)}
                      {post.content.length > 100 && '...'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{post.platform}</span>
                      {post.scheduledAt && (
                        <>
                          <span>•</span>
                          <span>{formatDate(post.scheduledAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleCopyUrl}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              <Copy className="w-4 h-4" />
              Copy URL
            </button>
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            {isImage && (
              <button
                onClick={() => setShowCompression(!showCompression)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
              >
                <Zap className="w-4 h-4" />
                {showCompression ? 'Hide Compression' : 'Compress Image'}
              </button>
            )}
            <button
              onClick={() => onDelete(media._id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>

          {/* Compression Section */}
          {showCompression && isImage && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Compress Image</h4>
              
              <CompressionSettings
                options={compressionOptions}
                onOptionsChange={setCompressionOptions}
                originalSize={media.size}
              />
              
              <div className="mt-4">
                <CompressionPreview
                  originalFile={null}
                  compressionOptions={compressionOptions}
                  onCompressionComplete={handleCompressAndReplace}
                  mediaUrl={media.url}
                  mediaFilename={media.filename}
                  mediaMimeType={media.mimeType}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {showImageZoom && isImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowImageZoom(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={media.url}
              alt={media.filename}
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setShowImageZoom(false)}
              className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}