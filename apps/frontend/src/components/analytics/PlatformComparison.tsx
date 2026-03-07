import { PlatformMetrics } from '@/types/analytics.types';

interface PlatformComparisonProps {
  data: PlatformMetrics[];
}

const platformIcons: Record<string, string> = {
  twitter: '𝕏',
  linkedin: 'in',
  facebook: 'f',
  instagram: '📷',
  youtube: '▶️',
};

const platformColors: Record<string, string> = {
  twitter: 'bg-black',
  linkedin: 'bg-blue-600',
  facebook: 'bg-blue-500',
  instagram: 'bg-gradient-to-br from-purple-600 to-pink-500',
  youtube: 'bg-red-600',
};

export function PlatformComparison({ data }: PlatformComparisonProps) {
  if (data.length === 0) {
    return <div className="text-center text-gray-500 py-8">No data available</div>;
  }

  const maxImpressions = Math.max(...data.map((d) => d.impressions));

  return (
    <div className="space-y-4">
      {data.map((platform) => (
        <div key={platform.platform} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                  platformColors[platform.platform]
                }`}
              >
                {platformIcons[platform.platform]}
              </div>
              <div>
                <div className="font-medium capitalize">{platform.platform}</div>
                <div className="text-sm text-gray-500">{platform.posts} posts</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{platform.impressions.toLocaleString()}</div>
              <div className="text-sm text-gray-500">
                {platform.engagementRate.toFixed(2)}% engagement
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${platformColors[platform.platform]}`}
              style={{
                width: `${(platform.impressions / maxImpressions) * 100}%`,
                minWidth: '2%',
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}
