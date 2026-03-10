import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Eye, Trash2 } from 'lucide-react';
import { CompetitorAccount, CompetitorMetrics, competitorService } from '@/services/competitor.service';

interface CompetitorCardProps {
  competitor: CompetitorAccount;
  onRemove: (id: string) => void;
  onViewDetails: (competitor: CompetitorAccount) => void;
}

const PLATFORM_COLORS = {
  twitter: 'bg-blue-500',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-500',
  tiktok: 'bg-black',
};

const PLATFORM_ICONS = {
  twitter: '🐦',
  instagram: '📷',
  facebook: '📘',
  linkedin: '💼',
  youtube: '📺',
  tiktok: '🎵',
};

export function CompetitorCard({ competitor, onRemove, onViewDetails }: CompetitorCardProps) {
  const [metrics, setMetrics] = useState<CompetitorMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    loadLatestMetrics();
  }, [competitor._id]);

  const loadLatestMetrics = async () => {
    try {
      setIsLoading(true);
      const latestMetrics = await competitorService.getLatestMetrics(competitor._id);
      setMetrics(latestMetrics);
    } catch (error) {
      console.error('Failed to load competitor metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    setShowConfirmDelete(false);
    onRemove(competitor._id);
  };

  const getInitials = (handle: string, displayName?: string) => {
    if (displayName) {
      return displayName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }
    return handle.replace('@', '').slice(0, 2).toUpperCase();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const platformColor = PLATFORM_COLORS[competitor.platform as keyof typeof PLATFORM_COLORS] || 'bg-gray-500';
  const platformIcon = PLATFORM_ICONS[competitor.platform as keyof typeof PLATFORM_ICONS] || '📱';

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${platformColor} rounded-full flex items-center justify-center text-white font-bold`}>
            {getInitials(competitor.handle, competitor.displayName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">
                {competitor.displayName || competitor.handle}
              </span>
              <span className="text-lg">{platformIcon}</span>
            </div>
            <p className="text-sm text-gray-600">{competitor.handle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(competitor)}
            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
            title="Remove competitor"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metrics */}
      {metrics ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Followers</span>
            <span className="font-semibold text-gray-900">
              {formatNumber(metrics.followerCount)}
            </span>
          </div>

          {metrics.engagementRate !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Engagement Rate</span>
              <span className="font-semibold text-gray-900">
                {(metrics.engagementRate * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {metrics.avgLikes !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Likes</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(metrics.avgLikes)}
              </span>
            </div>
          )}

          {metrics.avgComments !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Comments</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(metrics.avgComments)}
              </span>
            </div>
          )}

          {/* Growth Trend Placeholder */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">Growth</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-600">+2.3%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No metrics available</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => onViewDetails(competitor)}
          className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          View Details
        </button>
      </div>

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Competitor</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove {competitor.displayName || competitor.handle}? 
              This will delete all historical data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}