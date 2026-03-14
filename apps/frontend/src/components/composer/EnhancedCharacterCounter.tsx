import React from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { 
  getPlatformCharacterCount, 
  getPlatformLimit, 
  getCharacterStatus, 
  getCharacterThresholds,
  getWorstCaseCount,
  getPlatformWarnings
} from '@/utils/characterCount';
import { SocialPlatform } from '@/types/composer.types';

interface EnhancedCharacterCounterProps {
  content: string;
  platforms: SocialPlatform[];
  activePlatform?: SocialPlatform | null;
  showMultiPlatform?: boolean;
  className?: string;
}

export function EnhancedCharacterCounter({
  content,
  platforms,
  activePlatform,
  showMultiPlatform = false,
  className = ''
}: EnhancedCharacterCounterProps) {
  // Determine which platform to show
  const targetPlatform = activePlatform || platforms[0];
  
  // Calculate character counts
  const singlePlatformCount = targetPlatform 
    ? getPlatformCharacterCount(content, targetPlatform)
    : content.length;
  
  const singlePlatformLimit = targetPlatform 
    ? getPlatformLimit(targetPlatform) 
    : 280;

  // Multi-platform worst case
  const worstCase = showMultiPlatform && platforms.length > 1
    ? getWorstCaseCount(content, platforms)
    : null;

  // Use worst case if showing multi-platform, otherwise single platform
  const displayCount = worstCase ? worstCase.count : singlePlatformCount;
  const displayLimit = worstCase ? worstCase.limit : singlePlatformLimit;
  const displayPlatform = worstCase ? worstCase.platform : targetPlatform;

  // Get status and thresholds
  const status = getCharacterStatus(displayCount, displayLimit);
  const thresholds = getCharacterThresholds(displayLimit);
  const remaining = displayLimit - displayCount;
  const isOverLimit = displayCount > displayLimit;

  // Get platform-specific warnings
  const warnings = displayPlatform 
    ? getPlatformWarnings(displayPlatform, displayCount, displayLimit)
    : [];

  // Progress bar percentage (capped at 100%)
  const progressPercentage = Math.min((displayCount / displayLimit) * 100, 100);

  // Status icon
  const StatusIcon = () => {
    switch (status.severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  // Color classes based on status
  const getColorClasses = (type: 'text' | 'bg' | 'border') => {
    const colorMap = {
      red: {
        text: 'text-red-600',
        bg: 'bg-red-500',
        border: 'border-red-500'
      },
      yellow: {
        text: 'text-yellow-600',
        bg: 'bg-yellow-500',
        border: 'border-yellow-500'
      },
      green: {
        text: 'text-green-600',
        bg: 'bg-green-500',
        border: 'border-green-500'
      }
    };
    
    return colorMap[status.color as keyof typeof colorMap][type];
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main Counter Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon />
          <span className={`font-medium ${getColorClasses('text')}`}>
            {displayCount.toLocaleString()} / {displayLimit.toLocaleString()}
          </span>
          {worstCase && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Worst case: {displayPlatform}
            </span>
          )}
        </div>
        
        <div className={`text-sm ${getColorClasses('text')}`}>
          {remaining >= 0 ? (
            <span>{remaining.toLocaleString()} remaining</span>
          ) : (
            <span className="font-semibold">
              {Math.abs(remaining).toLocaleString()} over limit
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all du
ration-300 ${getColorClasses('bg')}`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Threshold Indicators */}
      <div className="flex justify-between text-xs text-gray-400 relative">
        <span>0</span>
        <div className="absolute left-0 w-full flex justify-between pointer-events-none">
          <div 
            className="w-px h-2 bg-yellow-300" 
            style={{ left: `${(thresholds.warning / displayLimit) * 100}%` }}
            title={`Warning at ${thresholds.warning} characters`}
          />
          <div 
            className="w-px h-2 bg-red-300" 
            style={{ left: `${(thresholds.danger / displayLimit) * 100}%` }}
            title={`Danger at ${thresholds.danger} characters`}
          />
        </div>
        <span>{displayLimit.toLocaleString()}</span>
      </div>

      {/* Platform-Specific Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning, index) => (
            <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <Info className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <span className="text-yellow-800">{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Multi-Platform Breakdown */}
      {showMultiPlatform && platforms.length > 1 && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Platform Breakdown</h4>
          <div className="space-y-1">
            {platforms.map(platform => {
              const count = getPlatformCharacterCount(content, platform);
              const limit = getPlatformLimit(platform);
              const platformStatus = getCharacterStatus(count, limit);
              
              return (
                <div key={platform} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600">{platform}</span>
                  <span className={`font-medium ${
                    platformStatus.severity === 'error' ? 'text-red-600' :
                    platformStatus.severity === 'warning' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {count} / {limit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Over Limit Warning */}
      {isOverLimit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Content exceeds character limit
              </p>
              <p className="text-sm text-red-700 mt-1">
                {worstCase 
                  ? `Reduce by ${Math.abs(remaining)} characters to post to ${displayPlatform}`
                  : `Reduce by ${Math.abs(remaining)} characters to post`
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}