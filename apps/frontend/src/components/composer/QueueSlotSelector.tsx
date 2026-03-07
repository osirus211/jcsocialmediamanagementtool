import { useEffect } from 'react';
import { QueueSlot } from '@/types/composer.types';
import { Clock, CheckCircle } from 'lucide-react';

interface QueueSlotSelectorProps {
  slots: QueueSlot[];
  selectedSlot?: QueueSlot;
  onSelect: (slot: QueueSlot) => void;
  onFetchSlots: () => void;
  isLoading?: boolean;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatLongDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export function QueueSlotSelector({
  slots,
  selectedSlot,
  onSelect,
  onFetchSlots,
  isLoading = false,
}: QueueSlotSelectorProps) {
  useEffect(() => {
    // Fetch slots on mount
    onFetchSlots();
  }, [onFetchSlots]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const availableSlots = slots.filter((slot) => slot.isAvailable);
  const allOccupied = availableSlots.length === 0;

  if (allOccupied) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 font-medium">Queue Full</p>
        <p className="text-yellow-700 text-sm mt-1">
          All queue slots are currently occupied. Please try scheduling for a specific time instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Select Queue Slot
      </label>

      <div 
        className="flex gap-3 overflow-x-auto pb-2"
        role="radiogroup"
        aria-label="Available queue slots"
      >
        {slots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          const isDisabled = slot.isOccupied;

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => !isDisabled && onSelect(slot)}
              disabled={isDisabled}
              role="radio"
              aria-checked={isSelected}
              aria-label={`Queue slot ${slot.time} on ${formatLongDate(slot.scheduledAt)}${slot.isOccupied ? ' - Occupied' : ' - Available'}${slot.isDefault ? ' - Next available' : ''}`}
              className={`
                flex-shrink-0 w-32 p-3 rounded-lg border-2 transition-all
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : isDisabled
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-300 hover:border-blue-300 bg-white'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-4 w-4 text-gray-500" />
                {slot.isDefault && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                    Next
                  </span>
                )}
                {isSelected && (
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                )}
              </div>

              <div className="text-left">
                <p className="font-semibold text-gray-900">{slot.time}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(slot.scheduledAt)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {slot.isOccupied ? 'Occupied' : 'Available'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSlot && (
        <p className="text-sm text-gray-600">
          Selected: {selectedSlot.time} on {formatLongDate(selectedSlot.scheduledAt)}
        </p>
      )}
    </div>
  );
}
