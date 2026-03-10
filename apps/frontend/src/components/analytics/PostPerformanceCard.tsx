import { useState } from 'react';
import { analyticsService, PostPerformanceSummary } from '@/services/analytics.service';
import { logger } from '@/lib/logger';

interface PostPerformanceCardProps {
  postId: string;
  initialData?: PostPerformanceSummary;
  onUpdate?: () => void;
}

export function PostPerformanceCard({ postId, initialData, onUpdate }: PostPerformanceCardProps) {
  const [data, setData] = useState<PostPerformanceSummary | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [isROIExpanded, setIsROIExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adSpend, setAdSpend] = useState<string>('');
  const [estimatedRevenue, setEstimatedRevenue] = useState<string>('');

  // Load data if not provided initially
  useState(() => {
    if (!initialData) {
      loadData();
    } else {
      setAdSpend(initialData.analytics?.adSpend?.toString() || '');
      setEstimatedRevenue(initialData.analytics?.estimatedRevenue?.toString() || '');
    }
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const performance = await analyticsService.getPostPerformance(postId);
      setData(performance);
      setAdSpend(performance.analytics?.adSpend?.toString() || '');
      setEstimatedRevenue(performance.analytics?.estimatedRevenue?.toString() || '');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load post performance';
      logger.error('Post performance fetch error:', { error: err });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveROI = async () => {
    if (!data) return;

    try {
      setIsSaving(true);
      setError(null);

      const adSpendValue = adSpend ? parseFloat(adSpend) : undefined;
      const revenueValue = estimatedRevenue ? parseFloat(estimatedRevenue) : undefined;

      await analyticsService.updatePostROI(postId, adSpendValue, revenueValue);
      
      // Reload data to get updated calculations
      await loadData();
      onUpdate?.();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save ROI data';
      logger.error('ROI save error:', { error: err });
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      twitter: '🐦',
      facebook: '📘',
      instagram: '📷',
      linkedin: '💼',
      tiktok: '🎵',
      threads: '@',
      bluesky: '🦋',
    };
    return icons[platform] || '📱';
  };

  const getROIColor = (roi?: number) => {
    if (roi === undefined) return 'text-gray-500 bg-gray-100';
    if (roi > 0) return 'text-green-700 bg-green-100';
    return 'text-red-700 bg-red-100';
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-4">
          <div className="text-red-600 mb-2">⚠️ Error loading post data</div>
          <div className="text-sm text-gray-500">{error}</div>
          <button
            onClick={loadData}
            className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-4">
          <div className="text-gray-600">No data available</div>
        </div>
      </div>
    );
  }

  const { post, analytics } = data;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      {/* Post Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="text-2xl">{getPlatformIcon(post.platform)}</div>
        <div className="flex-1">
          <div className="text-sm text-gray-900 line-clamp-2">
            {post.content.length > 100 ? `${post.content.substring(0, 100)}...` : post.content}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(post.publishedAt).toLocaleDateString()} • {post.platform}
          </div>
        </div>
      </div>

      {analytics ? (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {analytics.impressions.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Impressions</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {analytics.likes.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Likes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {analytics.comments.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Comments</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {analytics.shares.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Shares</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {(analytics.clicks + analytics.linkClicks).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Clicks</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {analytics.clickThroughRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">CTR</div>
            </div>
          </div>

          {/* ROI Section */}
          <div className="border-t pt-4">
            <button
              onClick={() => setIsROIExpanded(!isROIExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="font-medium text-gray-900">ROI Analysis</span>
              <span className="text-gray-400">{isROIExpanded ? '−' : '+'}</span>
            </button>

            {isROIExpanded && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ad Spend ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={adSpend}
                      onChange={(e) => setAdSpend(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Revenue ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={estimatedRevenue}
                      onChange={(e) => setEstimatedRevenue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getROIColor(analytics.roi)}`}>
                      {analytics.roi !== undefined ? `${analytics.roi.toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">ROI</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(analytics.costPerClick)}
                    </div>
                    <div className="text-xs text-gray-500">Cost per Click</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {analytics.linkClicks.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Link Clicks</div>
                  </div>
                </div>

                <button
                  onClick={handleSaveROI}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save ROI Data'}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No analytics data available for this post
        </div>
      )}
    </div>
  );
}