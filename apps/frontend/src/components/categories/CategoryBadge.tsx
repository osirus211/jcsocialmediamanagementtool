import React from 'react';
import { X } from 'lucide-react';
import { Category } from '../../services/categories.service';

interface CategoryBadgeProps {
  category: Category;
  size?: 'sm' | 'md';
  onRemove?: () => void;
  className?: string;
}

export default function CategoryBadge({ 
  category, 
  size = 'md', 
  onRemove, 
  className = '' 
}: CategoryBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const dotSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-800 font-medium ${sizeClasses[size]} ${className}`}
    >
      <span
        className={`rounded-full ${dotSizeClasses[size]}`}
        style={{ backgroundColor: category.color }}
      />
      <span>{category.name}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:bg-gray-200 rounded-full p-0.5 transition-colors"
          type="button"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}