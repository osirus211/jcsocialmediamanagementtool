import { useCallback, useRef, useState } from 'react';
import { Upload, X, AlertCircle, Settings } from 'lucide-react';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { CompressionSettings, CompressionOptions } from './CompressionSettings';
import { CompressionPreview } from './CompressionPreview';
import { BulkCompressionModal } from './BulkCompressionModal';

interface MediaUploaderProps {
  onUploadComplete?: (mediaIds: string[]) => void;
  showCompressionSettings?: boolean;
}

/**
 * MediaUploader Component
 * 
 * Drag & drop + click upload interface
 * 
 * Features:
 * - Drag & drop files
 * - Click to browse
 * - Upload progress bars
 * - Optimistic preview
 * - Error display
 * - Multiple file upload
 * 
 * Safety:
 * - File type validation
 * - File size validation
 * - Error handling
 * - No UI freeze
 */
export function MediaUploader({ onUploadComplete, showCompressionSettings = false }: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    quality: 85,
    format: 'auto',
    maxWidth: 2048,
    maxHeight: 2048,
    preserveExif: false,
    lossless: false,
  });
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showBulkCompression, setShowBulkCompression] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  const {
    uploadingFiles,
    uploadedMedia,
    uploadFiles,
    removeUploadingFile,
  } = useMediaUpload();

  /**
   * Handle file selection
   */
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    
    // If compression settings are enabled and we have images, show compression options
    if (showCompressionSettings && fileArray.some(f => f.type.startsWith('image/'))) {
      const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));
      
      if (imageFiles.length === 1) {
        setPreviewFile(imageFiles[0]);
        setShowSettings(true);
        return;
      } else if (imageFiles.length > 1) {
        setPendingFiles(imageFiles);
        setShowBulkCompression(true);
        return;
      }
    }
    
    // Direct upload without compression
    const uploadedMedia = await uploadFiles(fileArray);
    
    if (uploadedMedia.length > 0 && onUploadComplete) {
      onUploadComplete(uploadedMedia.map((m) => m._id));
    }
  }, [uploadFiles, onUploadComplete, showCompressionSettings]);

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  /**
   * Handle click upload
   */
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  return (
    <div className="space-y-4">
      {/* Compression Settings Toggle */}
      {showCompressionSettings && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Upload Settings</h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
          >
            <Settings className="w-4 h-4" />
            Compression
          </button>
        </div>
      )}

      {/* Compression Settings Panel */}
      {showSettings && (
        <CompressionSettings
          options={compressionOptions}
          onOptionsChange={setCompressionOptions}
        />
      )}

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
        
        <p className="text-lg font-medium text-gray-700 mb-1">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        
        <p className="text-sm text-gray-500 mb-4">
          or click to browse
        </p>
        
        <p className="text-xs text-gray-400">
          Supported: JPEG, PNG, GIF, WebP, MP4, MOV, AVI, WebM
          <br />
          Max size: 10MB (images), 100MB (videos)
          {showCompressionSettings && (
            <>
              <br />
              <span className="text-blue-600">✨ Smart compression enabled</span>
            </>
          )}
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/x-msvideo,video/webm"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Single File Compression Preview */}
      {previewFile && (
        <CompressionPreview
          originalFile={previewFile}
          compressionOptions={compressionOptions}
          onCompressionComplete={async (compressedFile, stats) => {
            // Upload the compressed file
            const uploadedMedia = await uploadFiles([compressedFile]);
            if (uploadedMedia.length > 0 && onUploadComplete) {
              onUploadComplete(uploadedMedia.map((m) => m._id));
            }
            setPreviewFile(null);
            setShowSettings(false);
          }}
        />
      )}

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Uploading...</h3>
          
          {uploadingFiles.map((file) => (
            <div key={file.id} className="bg-white border rounded-lg p-3">
              <div className="flex items-center gap-3">
                {/* Preview */}
                <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded overflow-hidden">
                  {file.file.type.startsWith('image/') ? (
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      📹
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.file.name}
                  </p>
                  
                  {file.error ? (
                    <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{file.error}</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {file.progress}%
                      </p>
                    </>
                  )}
                </div>
                
                {/* Remove button */}
                <button
                  onClick={() => removeUploadingFile(file.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Compression Modal */}
      {showBulkCompression && (
        <BulkCompressionModal
          files={pendingFiles}
          onClose={() => {
            setShowBulkCompression(false);
            setPendingFiles([]);
          }}
          onComplete={async (results) => {
            const compressedFiles = results
              .filter(r => r.compressedFile)
              .map(r => r.compressedFile!);
            
            if (compressedFiles.length > 0) {
              const uploadedMedia = await uploadFiles(compressedFiles);
              if (uploadedMedia.length > 0 && onUploadComplete) {
                onUploadComplete(uploadedMedia.map((m) => m._id));
              }
            }
          }}
        />
      )}
    </div>
  );
}


