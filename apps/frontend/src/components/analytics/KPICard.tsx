interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: string;
  trend?: string;
  trendColor?: string;
  isLoading?: boolean;
  hasError?: boolean;
}

export function KPICard({ 
  title, 
  value, 
  change, 
  icon, 
  trend, 
  trendColor = 'text-gray-600',
  isLoading = false,
  hasError = false
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg p-6 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 bg-gray-200 rounded"></div>
          <div className="w-12 h-4 bg-gray-200 rounded"></div>
        </div>
        <div className="w-20 h-8 bg-gray-200 rounded mb-1"></div>
        <div className="w-16 h-4 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-white border rounded-lg p-6 text-center">
        <div className="text-2xl mb-2">—</div>
        <div className="text-sm text-gray-500">Error loading data</div>
        <div className="text-xs text-gray-400 mt-1">{title}</div>
      </div>
    );
  }

  const hasChange = change !== undefined;
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl" role="img" aria-label={title}>{icon}</span>
        {hasChange && (
          <div className="flex items-center gap-1">
            <span className={`text-lg ${trendColor}`} aria-label={`Trend ${trend}`}>
              {trend}
            </span>
            <span
              className={`text-sm font-medium ${
                isPositive
                  ? 'text-green-600'
                  : isNegative
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}
            >
              {isPositive && '+'}
              {change.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <div className="text-3xl font-bold mb-1" aria-label={`${title}: ${value}`}>
        {value}
      </div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}
