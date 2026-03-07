import { GrowthMetrics } from '@/types/analytics.types';

interface PerformanceChartProps {
  data: GrowthMetrics[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  if (data.length === 0) {
    return <div className="text-center text-gray-500 py-8">No data available</div>;
  }

  // Simple bar chart visualization
  const maxImpressions = Math.max(...data.map((d) => d.impressions));
  const maxEngagement = Math.max(...data.map((d) => d.engagement));

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Impressions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>Engagement</span>
        </div>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="text-xs text-gray-600">{item.date}</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div
                  className="bg-blue-500 h-6 rounded"
                  style={{
                    width: `${(item.impressions / maxImpressions) * 100}%`,
                    minWidth: '2%',
                  }}
                  title={`${item.impressions} impressions`}
                ></div>
              </div>
              <div className="flex-1">
                <div
                  className="bg-green-500 h-6 rounded"
                  style={{
                    width: `${(item.engagement / maxEngagement) * 100}%`,
                    minWidth: '2%',
                  }}
                  title={`${item.engagement} engagement`}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
