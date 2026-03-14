import { useState, useCallback } from 'react';
import { Settings, Zap, Info } from 'lucide-react';

export interface CompressionOptions {
  quality: number; // 1-100
  format: 'auto' | 'jpeg' | 'webp' | 'png';
  maxWidth: number;
  maxHeight: number;
  preserveExif: boolean;
  lossless: boolean;
  platform?: 'instagram' | 'twitter' | 'linkedin' | 'facebook' | 'tiktok' | 'pinterest';
}

interface CompressionSettingsProps {
  options: CompressionOptions;
  onOptionsChange: (options: CompressionOptions) => void;
  originalSize?: number;
  estimatedSize?: number;
  isCompressing?: boolean;
}

const PLATFORM_SPECS = {
  instagram: { maxSize: 8 * 1024 * 1024, recommendedWidth: 1080, recommendedHeight: 1080, name: 'Instagram' },
  twitter: { maxSize: 5 * 1024 * 1024, recommendedWidth: 1200, recommendedHeight: 675, name: 'Twitter' },
  linkedin: { maxSize: 5 * 1024 * 1024, recommendedWidth: 1200, recommendedHeight: 627, name: 'LinkedIn' },
  facebook: { maxSize: 4 * 1024 * 1024, recommendedWidth: 1200, recommendedHeight: 630, name: 'Facebook' },
  tiktok: { maxSize: 72 * 1024 * 1024, recommendedWidth: 1080, recommendedHeight: 1920, name: 'TikTok' },
  pinterest: { maxSize: 20 * 1024 * 1024, recommendedWidth: 1000, recommendedHeight: 1500, name: 'Pinterest' },
};

export function CompressionSettings({
  options,
  onOptionsChange,
  originalSize,
  estimatedSize,
  isCompressing = false,
}: CompressionSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateOption = useCallback((key: keyof CompressionOptions, value: any) => {
    onOptionsChange({ ...options, [key]: value });
  }, [options, onOptionsChange]);

  const applyPlatformPreset = useCallback((platform: keyof typeof PLATFORM_SPECS) => {
    const spec = PLATFORM_SPECS[platform];
    onOptionsChange({
      ...options,
      platform,
      maxWidth: spec.recommendedWidth,
      maxHeight: spec.recommendedHeight,
      quality: platform === 'instagram' ? 95 : 85, // Higher quality for Instagram
      format: 'auto',
    });
  }, [options, onOptionsChange]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const compressionRatio = originalSize && estimatedSize 
    ? Math.round(((originalSize - estimatedSize) / originalSize) * 100)
    : 0;

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900">Compression Settings</h3>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      {/* Platform Presets */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Platform Optimization
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(PLATFORM_SPECS).map(([key, spec]) => (
            <button
              key={key}
              onClick={() => applyPlatformPreset(key as keyof typeof PLATFORM_SPECS)}
              className={`p-2 text-xs border rounded-md transition-colors ${
                options.platform === key
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {spec.name}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Quality
          </label>
          <span className="text-sm text-gray-500">{options.quality}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          value={options.quality}
          onChange={(e) => updateOption('quality', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={isCompressing}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Smaller file</span>
          <span>Better quality</span>
        </div>
      </div>

      {/* Format Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Format
        </label>
        <select
          value={options.format}
          onChange={(e) => updateOption('format', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          disabled={isCompressing}
        >
          <option value="auto">Auto (WebP when supported)</option>
          <option value="webp">WebP (Best compression)</option>
          <option value="jpeg">JPEG (Universal)</option>
          <option value="png">PNG (Lossless)</option>
        </select>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Width
              </label>
              <input
                type="number"
                value={options.maxWidth}
                onChange={(e) => updateOption('maxWidth', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                disabled={isCompressing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Height
              </label>
              <input
                type="number"
                value={options.maxHeight}
                onChange={(e) => updateOption('maxHeight', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                disabled={isCompressing}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.preserveExif}
                onChange={(e) => updateOption('preserveExif', e.target.checked)}
                className="rounded"
                disabled={isCompressing}
              />
              <span className="text-sm text-gray-700">Preserve EXIF data</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.lossless}
                onChange={(e) => updateOption('lossless', e.target.checked)}
                className="rounded"
                disabled={isCompressing}
              />
              <span className="text-sm text-gray-700">Lossless compression</span>
            </label>
          </div>
        </div>
      )}

      {/* Size Comparison */}
      {originalSize && estimatedSize && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Original:</span>
            <span className="font-medium">{formatFileSize(originalSize)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Compressed:</span>
            <span className="font-medium text-green-600">{formatFileSize(estimatedSize)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Reduction:</span>
            <span className="font-medium text-blue-600">{compressionRatio}%</span>
          </div>
        </div>
      )}

      {/* Platform Warning */}
      {options.platform && originalSize && (
        <div className="mt-3">
          {(() => {
            const spec = PLATFORM_SPECS[options.platform];
            const willExceedLimit = (estimatedSize || originalSize) > spec.maxSize;
            
            if (willExceedLimit) {
              return (
                <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <Info className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-yellow-800">
                    File may exceed {spec.name}'s {formatFileSize(spec.maxSize)} limit. 
                    Consider increasing compression.
                  </span>
                </div>
              );
            }
            
            return (
              <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                <Zap className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-green-800">
                  Optimized for {spec.name} ({formatFileSize(spec.maxSize)} limit)
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}