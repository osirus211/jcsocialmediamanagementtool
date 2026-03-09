import { Repeat2 } from 'lucide-react';

interface EvergreenBadgeProps {
  repostInterval: number;
  onClick?: () => void;
}

export function EvergreenBadge({ repostInterval, onClick }: EvergreenBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium hover:bg-green-100 transition-colors"
      title="Click to edit evergreen rule"
    >
      <Repeat2 className="h-3.5 w-3.5" />
      <span>Repeats every {repostInterval} {repostInterval === 1 ? 'day' : 'days'}</span>
    </button>
  );
}
