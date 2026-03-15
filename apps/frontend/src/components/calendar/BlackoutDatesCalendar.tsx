import React, { useState, useEffect } from 'react';
import { Ban, AlertTriangle, Info } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { blackoutDatesService, CalendarBlackoutDate } from '@/services/blackout-dates.service';
import { useWorkspace } from '@/hooks/useWorkspace';

interface BlackoutDatesCalendarProps {
  currentDate: Date;
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
  className?: string;
}

export const BlackoutDatesCalendar: React.FC<BlackoutDatesCalendarProps> = ({
  currentDate,
  onDateSelect,
  selectedDate,
  className
}) => {
  const { workspace } = useWorkspace();
  const [blackoutDates, setBlackoutDates] = useState<{ [key: string]: CalendarBlackoutDate }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspace?._id) {
      loadBlackoutDates();
    }
  }, [workspace?._id, currentDate]);

  const loadBlackoutDates = async () => {
    try {
      setLoading(true);
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      
      const calendarData = await blackoutDatesService.getBlackoutDatesInRange(
        workspace!._id,
        start.toISOString(),
        end.toISOString()
      );

      const blackoutMap: { [key: string]: CalendarBlackoutDate } = {};
      calendarData.forEach(item => {
        const dateKey = format(parseISO(item.date), 'yyyy-MM-dd');
        blackoutMap[dateKey] = item;
      });
      
      setBlackoutDates(blackoutMap);
    } catch (error) {
      console.error('Failed to load blackout dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'hold':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'reschedule':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'cancel':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'hold':
        return <AlertTriangle className="w-3 h-3" />;
      case 'reschedule':
        return <Info className="w-3 h-3" />;
      case 'cancel':
        return <Ban className="w-3 h-3" />;
      default:
        return <Ban className="w-3 h-3" />;
    }
  };

  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start, end });

  // Add padding days for proper calendar layout
  const startDay = start.getDay();
  const paddingDays = Array.from({ length: startDay }, (_, i) => {
    const paddingDate = new Date(start);
    paddingDate.setDate(paddingDate.getDate() - (startDay - i));
    return paddingDate;
  });

  const endDay = end.getDay();
  const endPaddingDays = Array.from({ length: 6 - endDay }, (_, i) => {
    const paddingDate = new Date(end);
    paddingDate.setDate(paddingDate.getDate() + (i + 1));
    return paddingDate;
  });

  const allDays = [...paddingDays, ...days, ...endPaddingDays];

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-1 p-2 border-b bg-gray-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Body */}
      <div className="grid grid-cols-7 gap-1 p-2">
        {allDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const blackout = blackoutDates[dateKey];
          const isBlackedOut = !!blackout;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isTodayDate = isToday(day);

          return (
            <div
              key={index}
              className={`
                relative p-2 text-center text-sm border rounded cursor-pointer transition-colors
                ${!isCurrentMonth ? 'text-gray-300 bg-gray-50' : ''}
                ${isTodayDate ? 'ring-2 ring-blue-500' : ''}
                ${isSelected ? 'bg-blue-100 border-blue-300' : ''}
                ${isBlackedOut && isCurrentMonth
                  ? getActionColor(blackout.action)
                  : isCurrentMonth
                  ? 'hover:bg-gray-50'
                  : ''
                }
              `}
              onClick={() => onDateSelect?.(day)}
              title={isBlackedOut ? `Blackout: ${blackout.reason} (${blackout.action})` : ''}
            >
              <div className="font-medium">{format(day, 'd')}</div>
              
              {isBlackedOut && isCurrentMonth && (
                <div className="absolute top-1 right-1">
                  {getActionIcon(blackout.action)}
                </div>
              )}
              
              {isTodayDate && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="border-t p-3 bg-gray-50">
        <div className="text-xs text-gray-600 mb-2 font-medium">Blackout Actions:</div>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Hold</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
            <span>Reschedule</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
};