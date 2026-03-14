import { useState, useCallback } from 'react';
import { Calendar, X } from 'lucide-react';

export interface MediaFilters {
  type: 'all' | 'image' | 'video' | 'gif';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  customDateStart?: string;
  customDateEnd?: string;
  sizeRange: 'all' | 'small' | 'medium' | 'large';
  platform?: string;
  sortBy: 'newest' | 'oldest' | 'name' | 'size' | 'mostUsed';
}

interface MediaFiltersProps {
  filters: MediaFilters;
  onFiltersChange: (filters: MediaFilters) => void;
  onClearFilters: () => void;
  platforms: string[];
}

export function MediaFiltersPanel({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  platforms 
}: MediaFiltersProps) {
  const [showCustomDate, setShowCustomDate] = useState(filters.dateRange === 'custom');

  const updateFilter = useCallback((key: keyof MediaFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    if (key === 'dateRange' && value !== 'custom') {
      newFilters.customDateStart = undefined;
      newFilters.customDateEnd = undefined;
      setShowCustomDate(false);
    } else if (key === 'dateRange' && value === 'custom') {
      setShowCustomDate(true);
    }
    
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const hasActiveFilters = 
    filters.type !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.sizeRange !== 'all' ||
    filters.platform ||
    filters.sortBy !== 'newest';

  return (
    <div className="bg-white border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type
          </label>
          <select
            value={filters.type}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Media</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="gif">GIFs</option>
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <select
            value={filters.dateRange}
            onChange={(e) => updateFilter('dateRange', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Size Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Size
          </label>
          <select
            value={filters.sizeRange}
            onChange={(e) => updateFilter('sizeRange', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Sizes</option>
            <option value="small">Small (&lt;1MB)</option>
            <option value="medium">Medium (1-10MB)</option>
            <option value="large">Large (&gt;10MB)</option>
          </select>
        </div>

        {/* Platform Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Platform Used
          </label>
          <select
            value={filters.platform || ''}
            onChange={(e) => updateFilter('platform', e.target.value || undefined)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Range */}
      {showCustomDate && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={filters.customDateStart || ''}
              onChange={(e) => updateFilter('customDateStart', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={filters.customDateEnd || ''}
              onChange={(e) => updateFilter('customDateEnd', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sort By
        </label>
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name A-Z</option>
          <option value="size">Largest First</option>
          <option value="mostUsed">Most Used</option>
        </select>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            {filters.type !== 'all' && (
              <FilterBadge
                label={`Type: ${filters.type}`}
                onRemove={() => updateFilter('type', 'all')}
              />
            )}
            {filters.dateRange !== 'all' && (
              <FilterBadge
                label={`Date: ${filters.dateRange}`}
                onRemove={() => updateFilter('dateRange', 'all')}
              />
            )}
            {filters.sizeRange !== 'all' && (
              <FilterBadge
                label={`Size: ${filters.sizeRange}`}
                onRemove={() => updateFilter('sizeRange', 'all')}
              />
            )}
            {filters.platform && (
              <FilterBadge
                label={`Platform: ${filters.platform}`}
                onRemove={() => updateFilter('platform', undefined)}
              />
            )}
            {filters.sortBy !== 'newest' && (
              <FilterBadge
                label={`Sort: ${filters.sortBy}`}
                onRemove={() => updateFilter('sortBy', 'newest')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-blue-200 rounded-full p-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}