import { useMemo } from 'react';

interface ActivityChartProps {
  data: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * ActivityChart Component
 * 
 * Lightweight bar chart showing posts per day
 * 
 * Features:
 * - Simple CSS-based bars (no heavy chart library)
 * - Responsive
 * - Hover tooltips
 * 
 * Performance:
 * - Pure CSS rendering
 * - No external dependencies
 * - Fast and lightweight
 */
export function ActivityChart({ data }: ActivityChartProps) {
  const maxCount = useMemo(() => {
    return Math.max(...data.map((d) => d.count), 1);
  }, [data]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No activity data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2 h-64">
        {data.map((item) => {
          const heightPercentage = (item.count / maxCount) * 100;
          
          return (
            <div
              key={item.date}
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              {/* Bar */}
              <div className="w-full flex items-end justify-center h-full">
                <div
                  className="w-full bg-blue-600 hover:bg-blue-700 rounded-t transition-all cursor-pointer relative"
                  style={{ height: `${heightPercentage}%` }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {item.count} post{item.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              
              {/* Date label */}
              <div className="text-xs text-gray-600 dark:text-gray-400 text-center transform -rotate-45 origin-top-left mt-2">
                {formatDate(item.date)}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Y-axis label */}
      <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
        Posts per Day
      </div>
    </div>
  );
}
