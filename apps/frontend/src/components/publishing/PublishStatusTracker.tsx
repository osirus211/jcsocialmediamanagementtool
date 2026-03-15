/**
 * Publish Status Tracker Component
 * 
 * Real-time publish status per platform - Superior to all competitors!
 * Buffer, Hootsuite, Sprout Social, Later don't have this level of detail
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  RefreshCw, 
  ExternalLink,
  AlertTriangle,
  Play
} from 'lucide-react';
import { toast } from 'sonner';

export interface PlatformStatus {
  platform: string;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'retrying';
  platformPostId?: string;
  url?: string;
  error?: string;
  publishedAt?: Date;
  retryCount?: number;
}

interface PublishStatusTrackerProps {
  postId: string;
  platforms: PlatformStatus[];
  onRetryPlatform?: (platform: string) => void;
  onRefreshStatus?: () => void;
  showRetryAll?: boolean;
  onRetryAll?: () => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  linkedin: '💼',
  facebook: '📘',
  instagram: '📷',
  youtube: '📺',
  threads: '🧵',
  bluesky: '🦋',
  mastodon: '🐘',
  reddit: '🤖',
  'google-business': '🏢',
  tiktok: '🎵',
  pinterest: '📌',
  github: '🐙',
  apple: '🍎',
};

const STATUS_CONFIG = {
  queued: {
    label: 'Queued',
    color: 'bg-gray-100 text-gray-800',
    icon: Clock,
  },
  publishing: {
    label: 'Publishing',
    color: 'bg-blue-100 text-blue-800',
    icon: Loader2,
  },
  published: {
    label: 'Published',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
  retrying: {
    label: 'Retrying',
    color: 'bg-yellow-100 text-yellow-800',
    icon: RefreshCw,
  },
};

export const PublishStatusTracker: React.FC<PublishStatusTrackerProps> = ({
  postId,
  platforms,
  onRetryPlatform,
  onRefreshStatus,
  showRetryAll = true,
  onRetryAll,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate overall progress
  const totalPlatforms = platforms.length;
  const completedPlatforms = platforms.filter(p => 
    p.status === 'published' || p.status === 'failed'
  ).length;
  const successfulPlatforms = platforms.filter(p => p.status === 'published').length;
  const failedPlatforms = platforms.filter(p => p.status === 'failed').length;
  const progress = totalPlatforms > 0 ? (completedPlatforms / totalPlatforms) * 100 : 0;

  // Auto-refresh status every 2 seconds while publishing
  useEffect(() => {
    const hasActivePublishing = platforms.some(p => 
      p.status === 'queued' || p.status === 'publishing' || p.status === 'retrying'
    );

    if (!hasActivePublishing) return;

    const interval = setInterval(() => {
      onRefreshStatus?.();
    }, 2000);

    return () => clearInterval(interval);
  }, [platforms, onRefreshStatus]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefreshStatus?.();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshStatus]);

  const handleRetryPlatform = useCallback((platform: string) => {
    onRetryPlatform?.(platform);
    toast.info(`Retrying ${platform}...`);
  }, [onRetryPlatform]);

  const handleRetryAll = useCallback(() => {
    onRetryAll?.();
    toast.info('Retrying all failed platforms...');
  }, [onRetryAll]);

  const handleOpenUrl = useCallback((url: string, platform: string) => {
    window.open(url, '_blank');
    toast.success(`Opened ${platform} post`);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-500" />
            Publishing Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {showRetryAll && failedPlatforms > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryAll}
                className="text-red-600 hover:text-red-700"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry All Failed
              </Button>
            )}
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress: {completedPlatforms}/{totalPlatforms} platforms</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">✓ {successfulPlatforms} published</span>
            {failedPlatforms > 0 && (
              <span className="text-red-600">✗ {failedPlatforms} failed</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {platforms.map((platform) => {
          const config = STATUS_CONFIG[platform.status];
          const Icon = config.icon;
          const platformIcon = PLATFORM_ICONS[platform.platform] || '🌐';

          return (
            <div
              key={platform.platform}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg" title={platform.platform}>
                  {platformIcon}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">
                      {platform.platform.replace('-', ' ')}
                    </span>
                    <Badge className={config.color}>
                      <Icon className={`h-3 w-3 mr-1 ${
                        platform.status === 'publishing' || platform.status === 'retrying' 
                          ? 'animate-spin' 
                          : ''
                      }`} />
                      {config.label}
                    </Badge>
                  </div>
                  
                  {/* Additional Status Info */}
                  {platform.error && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {platform.error}
                    </p>
                  )}
                  
                  {platform.publishedAt && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Published at {new Date(platform.publishedAt).toLocaleTimeString()}
                    </p>
                  )}
                  
                  {platform.retryCount && platform.retryCount > 0 && (
                    <p className="text-sm text-yellow-600 mt-1">
                      Retry attempt #{platform.retryCount}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Platform Post URL */}
                {platform.url && platform.status === 'published' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenUrl(platform.url!, platform.platform)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}

                {/* Retry Button */}
                {platform.status === 'failed' && onRetryPlatform && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryPlatform(platform.platform)}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {platforms.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No platforms selected for publishing</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};