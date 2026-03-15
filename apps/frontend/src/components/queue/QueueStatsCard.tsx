/**
 * Queue Stats Card Component
 * 
 * Displays queue statistics and health metrics
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Users,
} from 'lucide-react';
import { QueueStats } from '@/services/queue.service';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QueueStatsCardProps {
  stats: QueueStats;
}

const PLATFORM_COLORS = {
  twitter: 'bg-blue-500',
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-500',
  threads: 'bg-gray-800',
  tiktok: 'bg-black',
  'google-business': 'bg-green-600',
};

const PLATFORM_NAMES = {
  twitter: 'Twitter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  threads: 'Threads',
  tiktok: 'TikTok',
  'google-business': 'Google Business',
};

export function QueueStatsCard({ stats }: QueueStatsCardProps) {
  const getHealthIcon = () => {
    switch (stats.queueHealth) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthColor = () => {
    switch (stats.queueHealth) {
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatInterval = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    } else if (minutes < 1440) {
      return `${Math.round(minutes / 60)}h`;
    } else {
      return `${Math.round(minutes / 1440)}d`;
    }
  };

  const totalPlatformPosts = Object.values(stats.postsByPlatform).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Posts */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Posts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
            </div>
            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Post */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Next Post</p>
              {stats.nextPostTime ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {format(new Date(stats.nextPostTime), 'h:mm a')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(stats.nextPostTime), { addSuffix: true })}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-semibold text-gray-500">None</p>
              )}
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Average Interval */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Interval</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.averageInterval > 0 ? formatInterval(stats.averageInterval) : 'N/A'}
              </p>
            </div>
            <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Health */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Queue Health</p>
              <div className="flex items-center gap-2 mt-1">
                {getHealthIcon()}
                <Badge
                  variant="outline"
                  className={cn('capitalize', getHealthColor())}
                >
                  {stats.queueHealth}
                </Badge>
              </div>
            </div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-gray-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Distribution */}
      {Object.keys(stats.postsByPlatform).length > 0 && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.postsByPlatform).map(([platform, count]) => (
                <div
                  key={platform}
                  className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full',
                      PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || 'bg-gray-400'
                    )}
                  />
                  <span className="text-sm font-medium">
                    {PLATFORM_NAMES[platform as keyof typeof PLATFORM_NAMES] || platform}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {count}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    ({Math.round((count / totalPlatformPosts) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}