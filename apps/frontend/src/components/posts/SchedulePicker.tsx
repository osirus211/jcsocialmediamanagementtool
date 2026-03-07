import { useState } from 'react';

interface SchedulePickerProps {
  value?: string;
  onChange: (date: string | undefined) => void;
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [isScheduled, setIsScheduled] = useState(!!value);

  const handleToggle = (scheduled: boolean) => {
    setIsScheduled(scheduled);
    if (!scheduled) {
      onChange(undefined);
    } else {
      // Set default to 1 hour from now
      const defaultDate = new Date();
      defaultDate.setHours(defaultDate.getHours() + 1);
      onChange(defaultDate.toISOString().slice(0, 16));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!isScheduled}
            onChange={() => handleToggle(false)}
            className="w-4 h-4"
          />
          <span>Post Now</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={isScheduled}
            onChange={() => handleToggle(true)}
            className="w-4 h-4"
          />
          <span>Schedule for Later</span>
        </label>
      </div>

      {isScheduled && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Schedule Date & Time
          </label>
          <input
            type="datetime-local"
            value={value?.slice(0, 16) || ''}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}
    </div>
  );
}
