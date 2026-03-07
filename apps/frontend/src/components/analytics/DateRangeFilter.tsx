import { useState } from 'react';

interface DateRangeFilterProps {
  startDate: string | null;
  endDate: string | null;
  onChange: (startDate: string | null, endDate: string | null) => void;
}

export function DateRangeFilter({ startDate, endDate, onChange }: DateRangeFilterProps) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (preset: string) => {
    const end = new Date();
    let start = new Date();

    switch (preset) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case 'all':
        onChange(null, null);
        return;
    }

    onChange(start.toISOString(), end.toISOString());
    setShowCustom(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <button
          onClick={() => handlePreset('7d')}
          className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Last 7 days
        </button>
        <button
          onClick={() => handlePreset('30d')}
          className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Last 30 days
        </button>
        <button
          onClick={() => handlePreset('90d')}
          className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Last 90 days
        </button>
        <button
          onClick={() => handlePreset('all')}
          className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          All time
        </button>
      </div>
    </div>
  );
}
