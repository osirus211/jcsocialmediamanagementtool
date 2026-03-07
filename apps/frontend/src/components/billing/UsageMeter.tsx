/**
 * UsageMeter Component
 * Visual progress bar showing usage vs limits with color coding
 */

import { LucideIcon } from 'lucide-react';

interface UsageMeterProps {
  icon: LucideIcon;
  label: string;
  current: number;
  limit: number;
  color?: 'blue' | 'purple' | 'green' | 'orange';
}

export default function UsageMeter({ icon: Icon, label, current, limit, color = 'blue' }: UsageMeterProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      fill: 'bg-blue-600',
      text: 'text-blue-600 dark:text-blue-400',
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/20',
      fill: 'bg-purple-600',
      text: 'text-purple-600 dark:text-purple-400',
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/20',
      fill: 'bg-green-600',
      text: 'text-green-600 dark:text-green-400',
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/20',
      fill: 'bg-orange-600',
      text: 'text-orange-600 dark:text-orange-400',
    },
  };

  const colors = colorClasses[color];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${colors.text}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {current} / {isUnlimited ? '∞' : limit}
        </span>
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-2 rounded-full ${colors.bg} overflow-hidden`}>
        <div
          className={`h-full transition-all duration-300 ${
            isAtLimit ? 'bg-red-600' : isNearLimit ? 'bg-yellow-600' : colors.fill
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Warning Messages */}
      {isAtLimit && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
          Limit reached. Upgrade to continue.
        </p>
      )}
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
          Approaching limit ({Math.round(percentage)}%)
        </p>
      )}
    </div>
  );
}
