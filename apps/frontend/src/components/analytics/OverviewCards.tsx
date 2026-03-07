import { CheckCircle, XCircle, Calendar, TrendingUp } from 'lucide-react';

interface OverviewCardsProps {
  totalPublished: number;
  successRate: number;
  failedCount: number;
  scheduledCount: number;
}

/**
 * OverviewCards Component
 * 
 * Displays key metrics in card format
 * 
 * Features:
 * - Total posts published
 * - Success rate percentage
 * - Failed posts count
 * - Scheduled posts count
 */
export function OverviewCards({
  totalPublished,
  successRate,
  failedCount,
  scheduledCount,
}: OverviewCardsProps) {
  const cards = [
    {
      title: 'Posts Published',
      value: totalPublished.toLocaleString(),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Success Rate',
      value: `${successRate}%`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Failed Posts',
      value: failedCount.toLocaleString(),
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: 'Scheduled',
      value: scheduledCount.toLocaleString(),
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        
        return (
          <div
            key={card.title}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {card.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {card.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
