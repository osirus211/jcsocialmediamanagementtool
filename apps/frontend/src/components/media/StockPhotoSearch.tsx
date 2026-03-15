/**
 * StockPhotoSearch Component
 * 
 * Advanced search interface for Unsplash, Pexels, and Pixabay stock photos
 * Features: filters, lightbox, multiple selection, search history, save to library
 */

import { useState, useEffect, useCallback } from 'react';
import { stockPhotosService, StockPhoto, StockPhotoFilters } from '@/services/stock-photos.service';
import { ImageLightbox } from './ImageLightbox';

interface StockPhotoSearchProps {
  onImport: (file: File) => void;
  onError: (error: string) => void;
  columns?: number;
}

type SourceFilter = 'all' | 'unsplash' | 'pexels' | 'pixabay';

const PIXABAY_CATEGORIES = [
  'backgrounds', 'fashion', 'nature', 'science', 'education', 'feelings', 
  'health', 'people', 'religion', 'places', 'animals', 'industry', 
  'computer', 'food', 'sports', 'transportation', 'travel', 'buildings', 
  'business', 'music'
];

const PIXABAY_COLORS = [
  'grayscale', 'transparent', 'red', 'orange', 'yellow', 'green', 
  'turquoise', 'blue', 'lilac', 'pink', 'white', 'gray', 'black', 'brown'
];

export function StockPhotoSearch({ onImport, onError, columns = 3 }: StockPhotoSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [filters, setFilters] = useState<StockPhotoFilters>({
    orientation: 'all',
    category: '',
    colors: '',
  });
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [importingPhotos, setImportingPhotos] = useState<Set<string>>(new Set());
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<StockPhoto | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('stockPhotoSearchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = (query: string) => {
    if (!query.trim()) return;
    
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('stockPhotoSearchHistory', JSON.stringify(newHistory));
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery.trim()) {
        saveSearchHistory(searchQuery.trim());
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load photos when query, source, or filters change
  useEffect(() => {
    if (debouncedQuery.trim()) {
      loadPhotos(true);
    } else {
      loadCuratedPhotos(true);
    }
  }, [debouncedQuery, sourceFilter, filters]);

  // Load curated photos on mount
  useEffect(() => {
    loadCuratedPhotos(true);
  }, []);

  const loadPhotos = async (reset = false) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const page = reset ? 1 : currentPage + 1;

      const result = await stockPhotosService.search(
        debouncedQuery, 
        sourceFilter === 'all' ? 'all' : sourceFilter, 
        page, 
        20,
        filters
      );

      if (reset) {
        setPhotos(result.photos);
        setCurrentPage(1);
        setSelectedPhotos(new Set());
      } else {
        setPhotos(prev => [...prev, ...result.photos]);
        setCurrentPage(page);
      }

      setHasMore(page < result.totalPages);
    } catch (error) {
      console.error('Failed to load photos:', error);
      onError('Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCuratedPhotos = async (reset = false) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const page = reset ? 1 : currentPage + 1;

      const result = await stockPhotosService.getCurated(page, 20);

      if (reset) {
        setPhotos(result.photos);
        setCurrentPage(1);
        setSelectedPhotos(new Set());
      } else {
        setPhotos(prev => [...prev, ...result.photos]);
        setCurrentPage(page);
      }

      setHasMore(page < result.totalPages);
    } catch (error) {
      console.error('Failed to load curated photos:', error);
      onError('Failed to load curated photos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportPhoto = async (photo: StockPhoto) => {
    if (importingPhotos.has(photo.id)) return;

    try {
      setImportingPhotos(prev => new Set(prev).add(photo.id));

      const file = await stockPhotosService.downloadAsFile(photo);
      onImport(file);
    } catch (error) {
      console.error('Failed to import photo:', error);
      onError('Failed to import photo');
    } finally {
      setImportingPhotos(prev => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
    }
  };

  const handleImportSelected = async () => {
    const selectedPhotoObjects = photos.filter(photo => selectedPhotos.has(photo.id));
    
    for (const photo of selectedPhotoObjects) {
      await handleImportPhoto(photo);
    }
    
    setSelectedPhotos(new Set());
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const handleLoadMore = () => {
    if (debouncedQuery.trim()) {
      loadPhotos(false);
    } else {
      loadCuratedPhotos(false);
    }
  };

  const updateFilter = (key: keyof StockPhotoFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      orientation: 'all',
      category: '',
      colors: '',
    });
  };

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns] || 'grid-cols-3';

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search for photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && !searchQuery && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">Recent:</span>
            {searchHistory.slice(0, 5).map((query, index) => (
              <button
                key={index}
                onClick={() => setSearchQuery(query)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
              >
                {query}
              </button>
            ))}
          </div>
        )}

        {/* Source Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'unsplash', label: 'Unsplash' },
            { key: 'pexels', label: 'Pexels' },
            { key: 'pixabay', label: 'Pixabay' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSourceFilter(key as SourceFilter)}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                sourceFilter === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
            </svg>
            Filters
            {(filters.orientation !== 'all' || filters.category || filters.colors) && (
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </button>

          {selectedPhotos.size > 0 && (
            <button
              onClick={handleImportSelected}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Import {selectedPhotos.size} Selected
            </button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Orientation Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orientation
                </label>
                <select
                  value={filters.orientation}
                  onChange={(e) => updateFilter('orientation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="horizontal">Landscape</option>
                  <option value="vertical">Portrait</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {PIXABAY_CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <select
                  value={filters.colors}
                  onChange={(e) => updateFilter('colors', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Colors</option>
                  {PIXABAY_COLORS.map(color => (
                    <option key={color} value={color}>
                      {color.charAt(0).toUpperCase() + color.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Photos Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && photos.length === 0 ? (
          <div className={`grid ${gridCols} gap-4`}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 text-center">
              {searchQuery ? 'No photos found for your search.' : 'No photos available.'}
            </p>
          </div>
        ) : (
          <>
            <div className={`grid ${gridCols} gap-4`}>
              {photos.map((photo) => {
                const isImporting = importingPhotos.has(photo.id);
                const isSelected = selectedPhotos.has(photo.id);
                
                return (
                  <div
                    key={`${photo.source}-${photo.id}`}
                    className={`group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <img
                      src={photo.url.thumb}
                      alt={photo.alt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onClick={() => setLightboxPhoto(photo)}
                    />
                    
                    {/* Selection Checkbox */}
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePhotoSelection(photo.id)}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Import Button */}
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImportPhoto(photo);
                        }}
                        disabled={isImporting}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        {isImporting ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* Attribution */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                      <p className="text-white text-xs">
                        Photo by{' '}
                        <a
                          href={photo.photographerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {photo.photographer}
                        </a>
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-white text-xs opacity-75 capitalize">
                          {photo.source}
                        </span>
                        {photo.views && (
                          <span className="text-white text-xs opacity-75">
                            {photo.views.toLocaleString()} views
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <ImageLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onImport={handleImportPhoto}
        />
      )}

      {/* Attribution Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-600 text-center">
          Photos from{' '}
          <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">
            Unsplash
          </a>
          ,{' '}
          <a href="https://pexels.com" target="_blank" rel="noopener noreferrer" className="underline">
            Pexels
          </a>
          {' '}& {' '}
          <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer" className="underline">
            Pixabay
          </a>
        </p>
      </div>
    </div>
  );
}