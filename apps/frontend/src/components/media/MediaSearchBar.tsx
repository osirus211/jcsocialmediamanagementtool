import { useState, useCallback, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';

interface MediaSearchBarProps {
  onSearch: (query: string) => void;
  onToggleFilters: () => void;
  showFilters: boolean;
  searchQuery: string;
}

export function MediaSearchBar({ 
  onSearch, 
  onToggleFilters, 
  showFilters, 
  searchQuery 
}: MediaSearchBarProps) {
  const [query, setQuery] = useState(searchQuery);

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    onSearch(value);
  }, [onSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    onSearch('');
  }, [onSearch]);

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by filename or tags..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <button
        onClick={onToggleFilters}
        className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
          showFilters 
            ? 'bg-blue-50 border-blue-300 text-blue-700' 
            : 'border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Filter className="w-4 h-4" />
        Filters
      </button>
    </div>
  );
}