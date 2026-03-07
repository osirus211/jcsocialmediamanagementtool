interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: string;
}

export function KPICard({ title, value, change, icon }: KPICardProps) {
  const hasChange = change !== undefined;
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {hasChange && (
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
        )}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}
