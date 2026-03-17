import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (startDate: Date, endDate: Date, preset: string) => void;
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(startDate.toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(endDate.toISOString().split('T')[0]);
  const [showCustom, setShowCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreset = (preset: { label: string; days: number }) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - preset.days);
    
    onChange(start, end, preset.label);
    setIsOpen(false);
    setShowCustom(false);
    setError(null);
  };

  const handleCustomRange = () => {
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    
    // Validation
    if (end < start) {
      setError('End date must be after start date');
      return;
    }
    
    if (start > new Date() || end > new Date()) {
      setError('Cannot select future dates');
      return;
    }
    
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      setError('Date range cannot exceed 365 days');
      return;
    }
    
    onChange(start, end, 'Custom range');
    setIsOpen(false);
    setShowCustom(false);
    setError(null);
  };

  const formatDateRange = () => {
    const start = startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: startDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    const end = endDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: endDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    return `${start} – ${end}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        aria-label="Select date range"
      >
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium">{formatDateRange()}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Select Date Range</h3>

              {/* Preset buttons */}
              <div className="space-y-2 mb-4">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePreset(preset)}
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors"
                >
                  Custom range
                </button>
              </div>

              {/* Custom date inputs */}
              {showCustom && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="text-xs text-red-600 mb-3">{error}</div>
                  )}

                  <button
                    onClick={handleCustomRange}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                  >
                    Apply Custom Range
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}