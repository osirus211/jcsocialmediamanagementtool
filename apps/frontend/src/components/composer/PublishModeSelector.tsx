import { PublishMode, QueueSlot } from '@/types/composer.types';
import { QueueSlotSelector } from './QueueSlotSelector';
import { OptimalTimeSuggestions } from './OptimalTimeSuggestions';
import { TimezoneAwareDateTimePicker } from '@/components/ui/TimezoneAwareDateTimePicker';
import { Clock, Send, List, TrendingUp } from 'lucide-react';

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
  selectedPlatforms?: string[];
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
  selectedPlatforms = [],
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
        <div className="pl-4 sm:pl-8 space-y-4">
          <TimezoneAwareDateTimePicker
            value={scheduledDate}
            onChange={onScheduledDateChange}
            label="Schedule Date & Time"
            showOptimalTimes={true}
            className="w-full"
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
