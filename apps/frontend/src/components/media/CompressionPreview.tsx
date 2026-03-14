import { useState, useEffect, useCallback } from 'react';
import { Eye, Download, RotateCcw, Zap } from 'lucide-react';
import { CompressionOptions } from './CompressionSettings';

interface CompressionPreviewProps {
  originalFile: File | null;
  compressionOptions: CompressionOptions;
  onCompressionComplete?: (compressedFile: File, stats: CompressionStats) => void;
  mediaUrl?: string;
  mediaFilename?: string;
  mediaMimeType?: string;
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalDimensions: { width: number; height: number };
  compressedDimensions: { width: number; height: number };
  processingTime: number;
}

export function CompressionPreview({
  originalFile,
  compressionOptions,
  onCompressionComplete,
  mediaUrl,
  mediaFilename,
  mediaMimeType,
}: CompressionPreviewProps) {
  const [originalPreview, setOriginalPreview] = useState<string>('');
  const [compressedPreview, setCompressedPreview] = useState<string>('');
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [stats, setStats] = useState<CompressionStats | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [actualFile, setActualFile] = useState<File | null>(originalFile);

  // Fetch file if not provided
  useEffect(() => {
    if (!originalFile && mediaUrl && mediaFilename && mediaMimeType) {
      const fetchFile = async () => {
        try {
          const response = await fetch(mediaUrl);
          const blob = await response.blob();
          const file = new File([blob], mediaFilename, { type: mediaMimeType });
          setActualFile(file);
        } catch (error) {
          console.error('Failed to fetch media file:', error);
        }
      };
      fetchFile();
    } else if (originalFile) {
      setActualFile(originalFile);
    }
  }, [originalFile, mediaUrl, mediaFilename, mediaMimeType]);

  // Create original preview
  useEffect(() => {
    if (actualFile) {
      const url = URL.createObjectURL(actualFile);
      setOriginalPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [actualFile]);

  // Compress image when options change
  useEffect(() => {
    if (actualFile) {
      compressImage();
    }
  }, [compressionOptions, actualFile]);

  const compressImage = useCallback(async () => {
    if (!actualFile || !actualFile.type.startsWith('image/')) return;

    setIsCompressing(true);
    const startTime = Date.now();

    try {
      // Get original dimensions
      const originalDimensions = await getImageDimensions(actualFile);
      
      // Compress using Canvas API
      const compressed = await compressImageFile(
        actualFile,
        compressionOptions.maxWidth,
        compressionOptions.quality / 100,
        compressionOptions.format === 'auto' ? 'webp' : compressionOptions.format
      );

      // Get compressed dimensions
      const compressedDimensions = await getImageDimensions(compressed);
      
      // Create preview
      const compressedUrl = URL.createObjectURL(compressed);
      setCompressedPreview(compressedUrl);
      setCompressedFile(compressed);

      // Calculate stats
      const processingTime = Date.now() - startTime;
      const compressionStats: CompressionStats = {
        originalSize: actualFile.size,
        compressedSize: compressed.size,
        compressionRatio: Math.round(((actualFile.size - compressed.size) / actualFile.size) * 100),
        originalDimensions,
        compressedDimensions,
        processingTime,
      };

      setStats(compressionStats);
      onCompressionComplete?.(compressed, compressionStats);

    } catch (error) {
      console.error('Compression failed:', error);
    } finally {
      setIsCompressing(false);
    }
  }, [actualFile, compressionOptions, onCompressionComplete]);

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const compressImageFile = async (
    file: File,
    maxWidth: number,
    quality: number,
    format: string
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > compressionOptions.maxHeight) {
          width = (width * compressionOptions.maxHeight) / height;
          height = compressionOptions.maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        const outputFormat = format === 'auto' ? 'image/webp' : `image/${format}`;
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: blob.type,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          outputFormat,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadCompressed = () => {
    if (!compressedFile) return;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(compressedFile);
    link.download = `compressed_${actualFile?.name || 'image'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Compression Preview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            <Eye className="w-4 h-4" />
            {showComparison ? 'Hide' : 'Compare'}
          </button>
          {compressedFile && (
            <button
              onClick={downloadCompressed}
              className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
        </div>
      </div>

      {/* Preview Images */}
      <div className={`grid gap-4 mb-4 ${showComparison ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Original */}
        {showComparison && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Original</h4>
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {originalPreview && (
                <img
                  src={originalPreview}
                  alt="Original"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            {stats && (
              <div className="mt-2 text-xs text-gray-600">
                <div>{formatFileSize(stats.originalSize)}</div>
                <div>{stats.originalDimensions.width} × {stats.originalDimensions.height}</div>
              </div>
            )}
          </div>
        )}

        {/* Compressed */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {showComparison ? 'Compressed' : 'Preview'}
          </h4>
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
            {isCompressing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Compressing...
                </div>
              </div>
            )}
            {compressedPreview && (
              <img
                src={compressedPreview}
                alt="Compressed"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          {stats && (
            <div className="mt-2 text-xs text-gray-600">
              <div className="text-green-600 font-medium">{formatFileSize(stats.compressedSize)}</div>
              <div>{stats.compressedDimensions.width} × {stats.compressedDimensions.height}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-green-600">
                {stats.compressionRatio}%
              </div>
              <div className="text-xs text-gray-600">Size Reduction</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {formatFileSize(stats.originalSize - stats.compressedSize)}
              </div>
              <div className="text-xs text-gray-600">Space Saved</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-600">
                {stats.processingTime}ms
              </div>
              <div className="text-xs text-gray-600">Processing Time</div>
            </div>
          </div>
        </div>
      )}

      {/* Quality Assessment */}
      {stats && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-green-500" />
          <span className="text-gray-600">
            {stats.compressionRatio > 70 ? 'Excellent' : 
             stats.compressionRatio > 50 ? 'Good' : 
             stats.compressionRatio > 30 ? 'Moderate' : 'Light'} compression
          </span>
        </div>
      )}
    </div>
  );
}