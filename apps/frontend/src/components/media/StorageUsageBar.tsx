import { useMemo } from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';

interface StorageUsageBarProps {
  usedBytes: number;
  totalBytes: number;
  imageBytes: number;
  videoBytes: number;
  onUpgrade?: () => void;
}

export function StorageUsageBar({
  usedBytes,
  totalBytes,
  imageBytes,
  videoBytes,
  onUpgrade,
}: StorageUsageBarProps) {
  const usage = useMemo(() => {
    const usedGB = usedBytes / (1024 * 1024 * 1024);
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const imageGB = imageBytes / (1024 * 1024 * 1024);
    const videoGB = videoBytes / (1024 * 1024 * 1024);
    const percentage = (usedBytes / totalBytes) * 100;
    
    let color = 'bg-green-500';
    let bgColor = 'bg-green-100';
    
    if (percentage > 80) {
      color = 'bg-red-500';
      bgColor = 'bg-red-100';
    } else if (percentage > 60) {
      color = 'bg-yellow-500';
      bgColor = 'bg-yellow-100';
    }
    
    return {
      usedGB: usedGB.toFixed(2),
      totalGB: totalGB.toFixed(1),
      imageGB: imageGB.toFixed(2),
      videoGB: videoGB.toFixed(2),
      percentage: Math.min(percentage, 100),
      color,
      bgColor,
      isNearLimit: percentage > 80,
      isWarning: percentage > 60,
    };
  }, [usedBytes, totalBytes, imageBytes, videoBytes]);

  return (
    <div className={`p-4 rounded-lg border ${usage.bgColor} ${usage.isNearLimit ? 'border-red-300' : usage.isWarning ? 'border-yellow-300' : 'border-green-300'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HardDrive className={`w-4 h-4 ${usage.isNearLimit ? 'text-red-600' : usage.isWarning ? 'text-yellow-600' : 'text-green-600'}`} />
          <span className="text-sm font-medium text-gray-900">
            Storage Usage
          </span>
          {usage.isNearLimit && (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {usage.usedGB} GB of {usage.totalGB} GB used
          </span>
          {usage.isWarning && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${usage.color}`}
            style={{ width: `${usage.percentage}%` }}
          />
        </div>
        
        {/* Breakdown */}
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full" />
              <span>Images: {usage.imageGB} GB</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full" />
              <span>Videos: {usage.videoGB} GB</span>
            </div>
          </div>
          
          <span className="font-medium">
            {usage.percentage.toFixed(1)}% used
          </span>
        </div>
      </div>

      {/* Warning Messages */}
      {usage.isNearLimit && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <strong>Storage almost full!</strong> Consider upgrading your plan or deleting unused media.
        </div>
      )}
      
      {usage.isWarning && !usage.isNearLimit && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          You're using {usage.percentage.toFixed(0)}% of your storage. Consider upgrading soon.
        </div>
      )}
    </div>
  );
}