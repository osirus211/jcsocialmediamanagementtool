import { X, Trophy, TrendingDown } from 'lucide-react';

interface ComparisonPost {
  postId: string;
  platform: string;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  performanceScore: number;
  content?: string;
}

interface PostComparisonProps {
  posts: ComparisonPost[];
  isOpen: boolean;
  onClose: () => void;
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

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-black text-white',
  facebook: 'bg-blue-600 text-white',
  instagram: 'bg-gradient-to-br from-purple-600 to-pink-500 text-white',
  linkedin: 'bg-blue-700 text-white',
  tiktok: 'bg-black text-white',
  threads: 'bg-black text-white',
  bluesky: 'bg-blue-500 text-white',
};

export function PostComparison({ posts, isOpen, onClose }: PostComparisonProps) {
  if (!isOpen) return null;

  // Validate max 4 posts
  if (posts.length > 4) {
    console.warn('PostComparison: Maximum 4 posts allowed for comparison');
    posts = posts.slice(0, 4);
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };
  // Get winning and losing values for each metric
  const getWinnerLoser = (metric: keyof ComparisonPost) => {
    const values = posts.map(post => post[metric] as number);
    const max = Math.max(...values);
    const min = Math.min(...values);
    return { max, min };
  };

  const metrics = [
    { key: 'platform' as keyof ComparisonPost, label: 'Platform', isNumeric: false },
    { key: 'publishedAt' as keyof ComparisonPost, label: 'Published Date', isNumeric: false },
    { key: 'performanceScore' as keyof ComparisonPost, label: 'Performance Score', isNumeric: true },
    { key: 'engagementRate' as keyof ComparisonPost, label: 'Engagement Rate (%)', isNumeric: true },
    { key: 'reach' as keyof ComparisonPost, label: 'Audience Reached', isNumeric: true },
    { key: 'impressions' as keyof ComparisonPost, label: 'Impressions', isNumeric: true },
    { key: 'likes' as keyof ComparisonPost, label: 'Likes', isNumeric: true },
    { key: 'comments' as keyof ComparisonPost, label: 'Comments', isNumeric: true },
    { key: 'shares' as keyof ComparisonPost, label: 'Shares', isNumeric: true },
    { key: 'saves' as keyof ComparisonPost, label: 'Saves', isNumeric: true },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Compare Posts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close comparison"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Comparison Table */}
        <div className="overflow-auto max-h-[calc(90vh-120px)]" data-testid="post-comparison-view">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metric
                </th>
                {posts.map((post, index) => (
                  <th key={post.postId} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${PLATFORM_COLORS[post.platform] || 'bg-gray-500 text-white'}`}>
                        {PLATFORM_ICONS[post.platform] || '📱'}
                      </div>
                      <span className="capitalize">{post.platform}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.map((metric) => {
                const { max, min } = metric.isNumeric ? getWinnerLoser(metric.key) : { max: null, min: null };
                
                return (
                  <tr key={metric.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {metric.label}
                    </td>
                    {posts.map((post) => {
                      const value = post[metric.key];
                      const numericValue = value as number;
                      const isWinner = metric.isNumeric && numericValue === max && max !== min;
                      const isLoser = metric.isNumeric && numericValue === min && max !== min;
                      
                      let displayValue: string;
                      if (metric.key === 'publishedAt') {
                        displayValue = formatDate(value as string);
                      } else if (metric.key === 'platform') {
                        displayValue = (value as string).charAt(0).toUpperCase() + (value as string).slice(1);
                      } else if (metric.key === 'engagementRate') {
                        displayValue = `${(numericValue).toFixed(1)}%`;
                      } else if (metric.key === 'performanceScore') {
                        displayValue = numericValue.toString();
                      } else if (metric.isNumeric) {
                        displayValue = formatNumber(numericValue);
                      } else {
                        displayValue = value as string;
                      }

                      return (
                        <td 
                          key={post.postId} 
                          className={`px-6 py-4 whitespace-nowrap text-sm text-center ${
                            isWinner ? 'text-green-600 font-semibold bg-green-50' :
                            isLoser ? 'text-gray-400' : 'text-gray-900'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {isWinner && <Trophy className="h-4 w-4 text-green-600" />}
                            {isLoser && <TrendingDown className="h-4 w-4 text-gray-400" />}
                            <span>{displayValue}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}