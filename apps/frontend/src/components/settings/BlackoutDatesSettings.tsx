import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Edit, Trash2, AlertTriangle, Clock, Ban, RotateCcw } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { blackoutDatesService, BlackoutDate, CreateBlackoutDateRequest, BlackoutConflict } from '@/services/blackout-dates.service';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

interface BlackoutDatesSettingsProps {
  className?: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const ACTION_OPTIONS = [
  { value: 'hold', label: 'Hold and publish after blackout ends', icon: Clock, color: 'text-yellow-600' },
  { value: 'reschedule', label: 'Reschedule to next available slot', icon: RotateCcw, color: 'text-blue-600' },
  { value: 'cancel', label: 'Cancel posts silently', icon: Ban, color: 'text-red-600' },
];

export const BlackoutDatesSettings: React.FC<BlackoutDatesSettingsProps> = ({ className }) => {
  const { workspace } = useWorkspace();
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [conflicts, setConflicts] = useState<BlackoutConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState<BlackoutDate | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarBlackouts, setCalendarBlackouts] = useState<{ [key: string]: { reason: string; action: string } }>({});

  // Form state
  const [formData, setFormData] = useState<CreateBlackoutDateRequest>({
    startDate: '',
    endDate: '',
    reason: '',
    recurring: false,
    action: 'hold',
  });

  useEffect(() => {
    if (workspace?._id) {
      loadBlackoutDates();
      loadConflicts();
      loadCalendarBlackouts();
    }
  }, [workspace?._id, currentMonth]);

  const loadBlackoutDates = async () => {
    try {
      const dates = await blackoutDatesService.getBlackoutDates(workspace!._id, {
        isActive: true,
      });
      setBlackoutDates(dates);
    } catch (error) {
      console.error('Failed to load blackout dates:', error);
      toast.error('Failed to load blackout dates');
    }
  };

  const loadConflicts = async () => {
    try {
      const conflictData = await blackoutDatesService.findConflictingPosts(workspace!._id);
      setConflicts(conflictData);
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  };

  const loadCalendarBlackouts = async () => {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const calendarData = await blackoutDatesService.getBlackoutDatesInRange(
        workspace!._id,
        start.toISOString(),
        end.toISOString()
      );

      const blackoutMap: { [key: string]: { reason: string; action: string } } = {};
      calendarData.forEach(item => {
        const dateKey = format(parseISO(item.date), 'yyyy-MM-dd');
        blackoutMap[dateKey] = { reason: item.reason, action: item.action };
      });
      
      setCalendarBlackouts(blackoutMap);
    } catch (error) {
      console.error('Failed to load calendar blackouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingDate) {
        await blackoutDatesService.updateBlackoutDate(workspace!._id, editingDate._id, formData);
        toast.success('Blackout date updated successfully');
      } else {
        await blackoutDatesService.createBlackoutDate(workspace!._id, formData);
        toast.success('Blackout date created successfully');
      }
      
      setShowForm(false);
      setEditingDate(null);
      resetForm();
      loadBlackoutDates();
      loadCalendarBlackouts();
      loadConflicts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save blackout date');
    }
  };

  const handleEdit = (date: BlackoutDate) => {
    setEditingDate(date);
    setFormData({
      startDate: format(parseISO(date.startDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(date.endDate), 'yyyy-MM-dd'),
      reason: date.reason,
      recurring: date.recurring,
      recurringPattern: date.recurringPattern,
      action: date.action,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blackout date?')) return;
    
    try {
      await blackoutDatesService.deleteBlackoutDate(workspace!._id, id);
      toast.success('Blackout date deleted successfully');
      loadBlackoutDates();
      loadCalendarBlackouts();
      loadConflicts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete blackout date');
    }
  };

  const resetForm = () => {
    setFormData({
      startDate: '',
      endDate: '',
      reason: '',
      recurring: false,
      action: 'hold',
    });
  };

  const renderCalendar = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Calendar View</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 hover:bg-gray-100 rounded"
            >
              ←
            </button>
            <span className="font-medium">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 hover:bg-gray-100 rounded"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_OF_WEEK.map(day => (
            <div key={day.value} className="p-2 text-center text-sm font-medium text-gray-500">
              {day.label.slice(0, 3)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const blackout = calendarBlackouts[dateKey];
            const isBlackedOut = !!blackout;
            
            return (
              <div
                key={dateKey}
                className={`
                  p-2 text-center text-sm border rounded cursor-pointer
                  ${isToday(day) ? 'ring-2 ring-blue-500' : ''}
                  ${isBlackedOut 
                    ? 'bg-red-100 border-red-300 text-red-800' 
                    : 'hover:bg-gray-50'
                  }
                `}
                title={isBlackedOut ? `Blackout: ${blackout.reason}` : ''}
              >
                <div className="font-medium">{format(day, 'd')}</div>
                {isBlackedOut && (
                  <div className="text-xs mt-1">
                    <Ban className="w-3 h-3 mx-auto" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Blackout Dates</h2>
          <p className="text-gray-600 mt-1">
            Manage dates when posts should not be published
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Blackout Date
        </button>
      </div>

      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">
              {conflicts.length} post{conflicts.length !== 1 ? 's' : ''} scheduled during blackout periods
            </span>
          </div>
          <p className="text-yellow-700 text-sm">
            These posts will be handled according to your blackout date settings.
          </p>
        </div>
      )}

      {/* Calendar View */}
      {renderCalendar()}

      {/* Blackout Dates List */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Active Blackout Dates</h3>
        </div>
        
        {blackoutDates.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No blackout dates configured</p>
            <p className="text-sm">Add blackout dates to prevent posts from being published on specific days.</p>
          </div>
        ) : (
          <div className="divide-y">
            {blackoutDates.map(date => {
              const ActionIcon = ACTION_OPTIONS.find(opt => opt.value === date.action)?.icon || Clock;
              const actionColor = ACTION_OPTIONS.find(opt => opt.value === date.action)?.color || 'text-gray-600';
              
              return (
                <div key={date._id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{date.reason}</h4>
                        {date.recurring && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            Recurring
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <strong>Date:</strong> {format(parseISO(date.startDate), 'MMM d, yyyy')}
                          {date.startDate !== date.endDate && (
                            <> - {format(parseISO(date.endDate), 'MMM d, yyyy')}</>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <ActionIcon className={`w-4 h-4 ${actionColor}`} />
                          <span>
                            <strong>Action:</strong> {ACTION_OPTIONS.find(opt => opt.value === date.action)?.label}
                          </span>
                        </div>
                        
                        {date.recurring && date.recurringPattern && (
                          <div>
                            <strong>Pattern:</strong> {date.recurringPattern.type}
                            {date.recurringPattern.type === 'weekly' && date.recurringPattern.daysOfWeek && (
                              <span> on {date.recurringPattern.daysOfWeek.map(day => 
                                DAYS_OF_WEEK.find(d => d.value === day)?.label
                              ).join(', ')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(date)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(date._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingDate ? 'Edit Blackout Date' : 'Add Blackout Date'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Holiday, Maintenance, Company Event"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action during blackout
                </label>
                <select
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ACTION_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                  Recurring blackout
                </label>
              </div>

              {formData.recurring && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recurrence Type
                    </label>
                    <select
                      value={formData.recurringPattern?.type || 'weekly'}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurringPattern: {
                          ...formData.recurringPattern,
                          type: e.target.value as any
                        }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {formData.recurringPattern?.type === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Days of Week
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {DAYS_OF_WEEK.map(day => (
                          <label key={day.value} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.recurringPattern?.daysOfWeek?.includes(day.value) || false}
                              onChange={(e) => {
                                const currentDays = formData.recurringPattern?.daysOfWeek || [];
                                const newDays = e.target.checked
                                  ? [...currentDays, day.value]
                                  : currentDays.filter(d => d !== day.value);
                                
                                setFormData({
                                  ...formData,
                                  recurringPattern: {
                                    ...formData.recurringPattern,
                                    type: 'weekly',
                                    daysOfWeek: newDays
                                  }
                                });
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{day.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingDate(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingDate ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};