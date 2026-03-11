/**
 * StockPhotoSearch Component
 * 
 * Search interface for Unsplash and Pexels stock photos
 */

import { useState, useEffect, useCallback } from 'react';
import { stockPhotosService, StockPhoto } from '@/services/stock-photos.service';

interface StockPhotoSearchProps {
  onImport: (file: File) => void;
  onError: (error: string) => void;
  columns?: number;
}

type SourceFilter = 'all' | 'unsplash' | 'pexels';

export function StockPhotoSearch({ onImport, onError, columns = 3 }: StockPhotoSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [importingPhotos, setImportingPhotos] = useState<Set<string>>(new Set());

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load photos when query or source changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      loadPhotos(true);
    } else {
      loadCuratedPhotos(true);
    }
  }, [debouncedQuery, sourceFilter]);

  // Load curated photos on mount
  useEffect(() => {
    loadCuratedPhotos(true);
  }, []);

  const loadPhotos = async (reset = false) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const page = reset ? 1 : currentPage + 1;
      const source = sourceFilter === 'all' ? 'both' : sourceFilter;

      const result = await stockPhotosService.search(debouncedQuery, source, page, 20);

      if (reset) {
        setPhotos(result.photos);
        setCurrentPage(1);
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

  const handleLoadMore = () => {
    if (debouncedQuery.trim()) {
      loadPhotos(false);
    } else {
      loadCuratedPhotos(false);
    }
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

        {/* Source Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'unsplash', label: 'Unsplash' },
            { key: 'pexels', label: 'Pexels' },
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
                
                return (
                  <div
                    key={`${photo.source}-${photo.id}`}
                    className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => !isImporting && handleImportPhoto(photo)}
                  >
                    <img
                      src={photo.url.thumb}
                      alt={photo.alt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                      {isImporting ? (
                        <div className="bg-white rounded-full p-3">
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white rounded-full p-3 shadow-lg">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                        </div>
                      )}
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

      {/* Attribution Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-600 text-center">
          Photos from{' '}
          <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">
            Unsplash
          </a>{' '}
          &{' '}
          <a href="https://pexels.com" target="_blank" rel="noopener noreferrer" className="underline">
            Pexels
          </a>
        </p>
      </div>
    </div>
  );
}