import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { Widget, WidgetSize } from '@/types/dashboard.types';

interface WidgetWrapperProps {
  widget: Widget;
  children: React.ReactNode;
  onSizeChange: (id: string, size: WidgetSize) => void;
  onVisibilityChange: (id: string, isVisible: boolean) => void;
  isDragging?: boolean;
}

export function WidgetWrapper({
  widget,
  children,
  onSizeChange,
  onVisibilityChange,
  isDragging = false,
}: WidgetWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: widget.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getSizeClasses = (size: WidgetSize) => {
    switch (size) {
      case 'small':
        return 'col-span-1';
      case 'medium':
        return 'col-span-2';
      case 'large':
        return 'col-span-3';
      default:
        return 'col-span-2';
    }
  };

  const getSizeButtonClasses = (size: WidgetSize, currentSize: WidgetSize) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded transition-colors';
    if (size === currentSize) {
      return `${baseClasses} bg-blue-100 text-blue-700 border border-blue-300`;
    }
    return `${baseClasses} bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200`;
  };

  if (!widget.isVisible) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${getSizeClasses(widget.size)} ${
        isSortableDragging || isDragging ? 'opacity-50 z-50' : ''
      }`}
    >
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        {/* Title Bar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            
            <h3 className="font-medium text-gray-900">{widget.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Size Selector */}
            <div className="flex gap-1">
              {(['small', 'medium', 'large'] as WidgetSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => onSizeChange(widget.id, size)}
                  className={getSizeButtonClasses(size, widget.size)}
                  title={`Set size to ${size}`}
                >
                  {size.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>

            {/* Hide Button */}
            <button
              onClick={() => onVisibilityChange(widget.id, false)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Hide widget"
            >
              <EyeOff className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Widget Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}