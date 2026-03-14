import { useState, useCallback, useEffect } from 'react';
import { X, Zap, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { CompressionOptions } from './CompressionSettings';
import { CompressionStats } from './CompressionPreview';

interface BulkCompressionModalProps {
  files: File[];
  onClose: () => void;
  onComplete: (results: CompressionResult[]) => void;
}

interface CompressionResult {
  originalFile: File;
  compressedFile: File | null;
  stats: CompressionStats | null;
  error: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export function BulkCompressionModal({
  files,
  onClose,
  onComplete,
}: BulkCompressionModalProps) {
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    quality: 85,
    format: 'auto',
    maxWidth: 2048,
    maxHeight: 2048,
    preserveExif: false,
    lossless: false,
  });

  const [results, setResults] = useState<CompressionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initialize results
  useEffect(() => {
    setResults(files.map(file => ({
      originalFile: file,
      compressedFile: null,
      stats: null,
      error: null,
      status: 'pending',
    })));
  }, [files]);

  const compressImage = async (file: File, options: CompressionOptions): Promise<{
    compressedFile: File;
    stats: CompressionStats;
  }> => {
    const startTime = Date.now();
    
    // Get original dimensions
    const originalDimensions = await getImageDimensions(file);
    
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
        if (width > options.maxWidth) {
          height = (height * options.maxWidth) / width;
          width = options.maxWidth;
        }
        if (height > options.maxHeight) {
          width = (width * options.maxHeight) / height;
          height = options.maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const outputFormat = options.format === 'auto' ? 'image/webp' : `image/${options.format}`;
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

            const processingTime = Date.now() - startTime;
            const stats: CompressionStats = {
              originalSize: file.size,
              compressedSize: compressedFile.size,
              compressionRatio: Math.round(((file.size - compressedFile.size) / file.size) * 100),
              originalDimensions,
              compressedDimensions: { width, height },
              processingTime,
            };

            resolve({ compressedFile, stats });
          },
          outputFormat,
          options.quality / 100
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

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

  const startCompression = useCallback(async () => {
    setIsProcessing(true);
    setCurrentIndex(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentIndex(i);

      // Update status to processing
      setResults(prev => prev.map((result, index) => 
        index === i ? { ...result, status: 'processing' as const } : result
      ));

      try {
        if (file.type.startsWith('image/')) {
          const { compressedFile, stats } = await compressImage(file, compressionOptions);
          
          // Update with success
          setResults(prev => prev.map((result, index) => 
            index === i ? {
              ...result,
              compressedFile,
              stats,
              status: 'completed' as const,
            } : result
          ));
        } else {
          // Skip non-image files
          setResults(prev => prev.map((result, index) => 
            index === i ? {
              ...result,
              error: 'Not an image file',
              status: 'error' as const,
            } : result
          ));
        }
      } catch (error: any) {
        // Update with error
        setResults(prev => prev.map((result, index) => 
          index === i ? {
            ...result,
            error: error.message,
            status: 'error' as const,
          } : result
        ));
      }

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsProcessing(false);
  }, [files, compressionOptions]);

  const downloadAll = useCallback(() => {
    const successfulResults = results.filter(r => r.compressedFile);
    
    successfulResults.forEach((result, index) => {
      if (result.compressedFile) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(result.compressedFile);
        link.download = `compressed_${result.originalFile.name}`;
        
        // Delay downloads to avoid browser blocking
        setTimeout(() => {
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, index * 100);
      }
    });
  }, [results]);

  const handleComplete = useCallback(() => {
    onComplete(results);
    onClose();
  }, [results, onComplete, onClose]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalOriginalSize = results.reduce((sum, r) => sum + r.originalFile.size, 0);
  const totalCompressedSize = results.reduce((sum, r) => sum + (r.stats?.compressedSize || 0), 0);
  const totalSavings = totalOriginalSize - totalCompressedSize;
  const overallRatio = totalOriginalSize > 0 ? Math.round((totalSavings / totalOriginalSize) * 100) : 0;

  const completedCount = results.filter(r => r.status === 'completed').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Bulk Image Compression</h2>
            <p className="text-sm text-gray-600 mt-1">
              Compress {files.length} images with optimized settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Settings */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quality: {compressionOptions.quality}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={compressionOptions.quality}
                onChange={(e) => setCompressionOptions(prev => ({
                  ...prev,
                  quality: parseInt(e.target.value)
                }))}
                className="w-full"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format
              </label>
              <select
                value={compressionOptions.format}
                onChange={(e) => setCompressionOptions(prev => ({
                  ...prev,
                  format: e.target.value as any
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                disabled={isProcessing}
              >
                <option value="auto">Auto (WebP)</option>
                <option value="webp">WebP</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </div>
          </div>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Processing...</span>
              <span className="text-sm text-gray-600">
                {currentIndex + 1} of {files.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / files.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {result.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {result.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {result.status === 'processing' && (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {result.status === 'pending' && (
                      <div className="w-5 h-5 bg-gray-300 rounded-full" />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.originalFile.name}
                    </p>
                    {result.error && (
                      <p className="text-xs text-red-600">{result.error}</p>
                    )}
                  </div>
                </div>

                <div className="text-right text-sm">
                  {result.stats && (
                    <>
                      <div className="text-gray-900">
                        {formatFileSize(result.stats.compressedSize)}
                      </div>
                      <div className="text-green-600 text-xs">
                        -{result.stats.compressionRatio}%
                      </div>
                    </>
                  )}
                  {!result.stats && result.status !== 'error' && (
                    <div className="text-gray-500">
                      {formatFileSize(result.originalFile.size)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        {completedCount > 0 && (
          <div className="p-6 border-t bg-gray-50">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <div className="text-lg font-semibold text-green-600">
                  {overallRatio}%
                </div>
                <div className="text-xs text-gray-600">Total Reduction</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-600">
                  {formatFileSize(totalSavings)}
                </div>
                <div className="text-xs text-gray-600">Space Saved</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-600">
                  {completedCount}/{files.length}
                </div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t">
          {!isProcessing && completedCount === 0 && (
            <button
              onClick={startCompression}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Zap className="w-4 h-4" />
              Start Compression
            </button>
          )}

          {completedCount > 0 && (
            <>
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Download All
              </button>
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Complete
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {isProcessing ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}