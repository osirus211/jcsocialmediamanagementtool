import { useState } from 'react';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PlatformData {
  platform: string;
  followers: number;
  followerGrowth: number;
  posts: number;
  reach: number;
  engagement: number;
  engagementRate: number;
  bestPostingHour: number;
  lastSyncedAt?: Date;
}

interface PlatformComparisonTableProps {
  data: PlatformData[];
  isLoading?: boolean;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  facebook: '📘',
  instagram: '📷',
  linkedin: '💼',
  tiktok: '🎵',
  threads: '@',
  bluesky: '🦋',
};

type SortField = keyof PlatformData;
type SortDirection = 'asc' | 'desc';

export function PlatformComparisonTable({ data, isLoading = false }: PlatformComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('engagement');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const multiplier = sortDirection === 'desc' ? -1 : 1;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * multiplier;
    }
    
    return ((aValue as number) - (bValue as number)) * multiplier;
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatTime = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'desc' 
      ? <TrendingDown className="h-4 w-4 text-blue-600" />
      : <TrendingUp className="h-4 w-4 text-blue-600" />;
  };

  const calculateTotals = () => {
    if (data.length === 0) return null;
    
    return {
      followers: data.reduce((sum, item) => sum + item.followers, 0),
      followerGrowth: data.reduce((sum, item) => sum + item.followerGrowth, 0),
      posts: data.reduce((sum, item) => sum + item.posts, 0),
      reach: data.reduce((sum, item) => sum + item.reach, 0),
      engagement: data.reduce((sum, item) => sum + item.engagement, 0),
      engagementRate: data.reduce((sum, item) => sum + item.engagementRate, 0) / data.length,
    };
  };

  const totals = calculateTotals();

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {Array.from({ length: 8 }).map((_, i) => (
                  <th key={i} className="px-6 py-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No platform data available</h3>
        <p className="text-gray-600">
          Connect your social media accounts to see platform comparison data.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                Platform
              </th>
              {[
                { field: 'followers' as SortField, label: 'Followers' },
                { field: 'followerGrowth' as SortField, label: 'Growth' },
                { field: 'posts' as SortField, label: 'Posts' },
                { field: 'reach' as SortField, label: 'Reach' },
                { field: 'engagement' as SortField, label: 'Engagement' },
                { field: 'engagementRate' as SortField, label: 'Eng. Rate' },
                { field: 'bestPostingHour' as SortField, label: 'Best Time' },
              ].map(({ field, label }) => (
                <th
                  key={field}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort(field)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    {getSortIcon(field)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((platform, index) => (
              <tr key={platform.platform} className="hover:bg-gray-50 transition-colors">
                <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap border-r">
                  <div className="flex items-center gap-3">
                    <span className="text-lg" role="img" aria-label={platform.platform}>
                      {PLATFORM_ICONS[platform.platform] || '📱'}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900 capitalize">
                        {platform.platform}
                      </span>
                      {platform.lastSyncedAt && (
                        <div className="text-xs text-gray-500">
                          Last updated {formatDistanceToNow(new Date(platform.lastSyncedAt), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(platform.followers)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`font-medium ${
                    platform.followerGrowth > 0 
                      ? 'text-green-600' 
                      : platform.followerGrowth < 0 
                      ? 'text-red-600' 
                      : 'text-gray-600'
                  }`}>
                    {platform.followerGrowth > 0 ? '+' : ''}
                    {formatNumber(platform.followerGrowth)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {platform.posts}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(platform.reach)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(platform.engagement)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="font-medium text-blue-600">
                    {platform.engagementRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatTime(platform.bestPostingHour)}
                </td>
              </tr>
            ))}
            
            {/* Totals Row */}
            {totals && (
              <tr className="bg-gray-50 font-medium border-t-2">
                <td className="sticky left-0 bg-gray-50 px-6 py-4 whitespace-nowrap border-r">
                  <span className="text-gray-900">Totals / Averages</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(totals.followers)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {totals.followerGrowth > 0 ? '+' : ''}
                  {formatNumber(totals.followerGrowth)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {totals.posts}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(totals.reach)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(totals.engagement)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                  {totals.engagementRate.toFixed(1)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile scroll hint */}
      <div className="md:hidden p-4 text-center text-sm text-gray-500 border-t">
        ← Scroll horizontally to see all columns →
      </div>

      {/* Screen reader accessible summary */}
      <div className="sr-only">
        <h3>Platform comparison summary</h3>
        <p>
          This table shows performance metrics across {data.length} connected platforms.
          Total followers: {totals ? formatNumber(totals.followers) : 0}.
          Total engagement: {totals ? formatNumber(totals.engagement) : 0}.
          Average engagement rate: {totals ? totals.engagementRate.toFixed(1) : 0}%.
        </p>
      </div>
    </div>
  );
}