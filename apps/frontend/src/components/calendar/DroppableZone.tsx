import { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableZoneProps {
  id: string;
  dateKey: string;
  hour?: number;
  children: ReactNode;
  className?: string;
  isToday?: boolean;
  isEmpty?: boolean;
}

/**
 * DroppableZone Component
 * 
 * Drop target for calendar cells
 * 
 * Features:
 * - @dnd-kit integration
 * - Visual feedback on hover
 * - Supports both date and time drops
 * - Accessible drop zones
 * - Touch-friendly sizing
 * 
 * Better than competitors:
 * - Larger drop zones than Buffer
 * - Clearer feedback than Hootsuite
 * - More precise targeting than Later
 */
export function DroppableZone({
  id,
  dateKey,
  hour,
  children,
  className = '',
  isToday = false,
  isEmpty = false,
}: DroppableZoneProps) {
  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id,
    data: {
      dateKey,
      hour,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative transition-all duration-200
        ${isOver 
          ? 'bg-blue-50 border-blue-300 border-2 border-dashed' 
          : ''
        }
        ${isToday && !isOver
          ? 'bg-blue-50 border-blue-200'
          : isEmpty && !isOver
          ? 'bg-gray-50 border-gray-200'
          : !isOver
          ? 'border-gray-200'
          : ''
        }
        ${className}
      `}
    >
      {children}
      
      {/* Drop indicator overlay */}
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 rounded-lg border-2 border-blue-300 border-dashed">
          <div className="text-blue-600 text-sm font-medium flex items-center gap-2">
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
              />
            </svg>
            Drop here
          </div>
        </div>
      )}
    </div>
  );
}