import { PublishMode, QueueSlot } from '@/types/composer.types';
import { QueueSlotSelector } from './QueueSlotSelector';
import { Clock, Send, List } from 'lucide-react';

interface PublishModeSelectorProps {
  mode: PublishMode;
  onChange: (mode: PublishMode) => void;
  scheduledDate?: Date;
  onScheduledDateChange: (date: Date | undefined) => void;
  selectedSlot?: QueueSlot;
  onSlotChange: (slot: QueueSlot | undefined) => void;
  availableSlots: QueueSlot[];
  onFetchSlots: () => void;
  isLoadingSlots?: boolean;
}

export function PublishModeSelector({
  mode,
  onChange,
  scheduledDate,
  onScheduledDateChange,
  selectedSlot,
  onSlotChange,
  availableSlots,
  onFetchSlots,
  isLoadingSlots = false,
}: PublishModeSelectorProps) {
  const handleModeChange = (newMode: PublishMode) => {
    onChange(newMode);
    
    // Clear schedule/queue when switching modes
    if (newMode !== PublishMode.SCHEDULE) {
      onScheduledDateChange(undefined);
    }
    if (newMode !== PublishMode.QUEUE) {
      onSlotChange(undefined);
    }
  };

  const handleDateChange = (dateString: string) => {
    if (!dateString) {
      onScheduledDateChange(undefined);
      return;
    }

    const date = new Date(dateString);
    
    // Validate future date
    if (date <= new Date()) {
      alert('Scheduled date must be in the future');
      return;
    }

    onScheduledDateChange(date);
  };

  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Publish Mode
      </label>

      {/* Mode Selection */}
      <div 
        className="space-y-2" 
        role="radiogroup" 
        aria-label="Publish mode selection"
      >
        {/* Post Now */}
        <button
          type="button"
          onClick={() => handleModeChange(PublishMode.NOW)}
          role="radio"
          aria-checked={mode === PublishMode.NOW}
          aria-label="Post now - Publish immediately"
          className={`
            w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left
            ${
              mode === PublishMode.NOW
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          <div
            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              mode === PublishMode.NOW
                ? 'border-blue-500'
                : 'border-gray-300'
            }`}
          >
            {mode === PublishMode.NOW && (
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            )}
          </div>
          <Send className="h-5 w-5 text-gray-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">Post Now</p>
            <p className="text-sm text-gray-500">Publish immediately</p>
          </div>
        </button>

        {/* Schedule */}
        <button
          type="button"
          onClick={() => handleModeChange(PublishMode.SCHEDULE)}
          role="radio"
          aria-checked={mode === PublishMode.SCHEDULE}
          aria-label="Schedule - Choose a specific date and time"
          className={`
            w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left
            ${
              mode === PublishMode.SCHEDULE
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          <div
            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              mode === PublishMode.SCHEDULE
                ? 'border-blue-500'
                : 'border-gray-300'
            }`}
          >
            {mode === PublishMode.SCHEDULE && (
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            )}
          </div>
          <Clock className="h-5 w-5 text-gray-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">Schedule</p>
            <p className="text-sm text-gray-500">Choose a specific date and time</p>
          </div>
        </button>

        {/* Add to Queue */}
        <button
          type="button"
          onClick={() => handleModeChange(PublishMode.QUEUE)}
          role="radio"
          aria-checked={mode === PublishMode.QUEUE}
          aria-label="Add to queue - Post at next available slot"
          className={`
            w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left
            ${
              mode === PublishMode.QUEUE
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          <div
            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              mode === PublishMode.QUEUE
                ? 'border-blue-500'
                : 'border-gray-300'
            }`}
          >
            {mode === PublishMode.QUEUE && (
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            )}
          </div>
          <List className="h-5 w-5 text-gray-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">Add to Queue</p>
            <p className="text-sm text-gray-500">Post at next available slot</p>
          </div>
        </button>
      </div>

      {/* Schedule Date Picker */}
      {mode === PublishMode.SCHEDULE && (
        <div className="pl-4 sm:pl-8">
          <label htmlFor="schedule-datetime" className="block text-sm font-medium text-gray-700 mb-2">
            Schedule Date & Time
          </label>
          <input
            id="schedule-datetime"
            type="datetime-local"
            value={formatDateForInput(scheduledDate)}
            onChange={(e) => handleDateChange(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            aria-label="Select date and time for scheduled post"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Queue Slot Selector */}
      {mode === PublishMode.QUEUE && (
        <div className="pl-4 sm:pl-8">
          <QueueSlotSelector
            slots={availableSlots}
            selectedSlot={selectedSlot}
            onSelect={onSlotChange}
            onFetchSlots={onFetchSlots}
            isLoading={isLoadingSlots}
          />
        </div>
      )}
    </div>
  );
}
