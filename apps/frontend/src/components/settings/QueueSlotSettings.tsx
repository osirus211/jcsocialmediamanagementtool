import { useState, useEffect } from 'react';
import { queueSlotService, QueueSlot, CreateQueueSlotRequest } from '@/services/queueSlot.service';
import { Clock, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { logger } from '@/lib/logger';

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function QueueSlotSettings() {
  const [slots, setSlots] = useState<QueueSlot[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSlot, setNewSlot] = useState({ dayOfWeek: 0, time: '09:00' });

  useEffect(() => {
    loadSlots();
  }, [selectedPlatform]);

  const loadSlots = async () => {
    try {
      setIsLoading(true);
      const data = await queueSlotService.getSlots(selectedPlatform);
      setSlots(data);
    } catch (error) {
      logger.error('Failed to load queue slots', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSlot = async () => {
    try {
      setIsAdding(true);
      const data: CreateQueueSlotRequest = {
        platform: selectedPlatform,
        dayOfWeek: newSlot.dayOfWeek,
        time: newSlot.time,
        timezone,
      };
      await queueSlotService.createSlot(data);
      setShowAddDialog(false);
      setNewSlot({ dayOfWeek: 0, time: '09:00' });
      await loadSlots();
    } catch (error) {
      logger.error('Failed to create queue slot', error);
      alert('Failed to create slot. It may already exist.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Delete this queue slot?')) return;
    try {
      await queueSlotService.deleteSlot(slotId);
      await loadSlots();
    } catch (error) {
      logger.error('Failed to delete queue slot', error);
    }
  };

  const handleToggleActive = async (slot: QueueSlot) => {
    try {
      await queueSlotService.updateSlot(slot.id, { isActive: !slot.isActive });
      await loadSlots();
    } catch (error) {
      logger.error('Failed to toggle queue slot', error);
    }
  };

  const slotsByDay = DAYS.map((_, dayIndex) => {
    return slots.filter((s) => s.dayOfWeek === dayIndex).sort((a, b) => a.time.localeCompare(b.time));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Queue Slots</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure fixed posting times for queue-based scheduling
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Slot
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <label className="text-sm font-medium text-gray-700">Platform:</label>
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium text-gray-700 ml-4">Timezone:</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          placeholder="America/New_York"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {DAYS.map((day, dayIndex) => {
            const daySlots = slotsByDay[dayIndex];
            return (
              <div key={day} className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">{day}</h3>
                {daySlots.length === 0 ? (
                  <p className="text-sm text-gray-500">No slots configured</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                          slot.isActive ? 'bg-white border-gray-300' : 'bg-gray-50 border-gray-200 opacity-60'
                        }`}
                      >
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">{slot.time}</span>
                        <button
                          onClick={() => handleToggleActive(slot)}
                          className="ml-2 text-gray-500 hover:text-gray-700"
                          title={slot.isActive ? 'Disable' : 'Enable'}
                        >
                          {slot.isActive ? (
                            <Power className="h-4 w-4 text-green-600" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="ml-1 text-red-500 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add Queue Slot</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select
                  value={newSlot.dayOfWeek}
                  onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {DAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={newSlot.time}
                  onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddDialog(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={isAdding}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSlot}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isAdding}
              >
                {isAdding ? 'Adding...' : 'Add Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
