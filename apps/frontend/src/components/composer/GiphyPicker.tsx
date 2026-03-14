import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, X, Loader2, Sparkles, Sticker, TrendingUp, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { MediaFile } from '@/types/composer.types';
import { debounce } from 'lodash';

interface GiphyResult {
  id: string;
  title: string;
  url: string;
  images: {
    original: {
      url: string;
      width: string;
      height: string;
      size: string;
    };
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_width: {
      url: string;
      width: string;
      height: string;
    };
    preview_gif: {
      url: string;
      width: string;
      height: string;
    };
  };
  type: 'gif' | 'sticker';
  rating: string;
  username?: string;
  source?: string;
}

interface GiphyPickerProps {
  onSelect: (gif: GiphyResult) => void;
  onClose: () => void;
  selectedPlatforms?: string[];
}

type TabType = 'trending' | 'search' | 'stickers' | 'recent';

// Platform support for GIFs
const PLATFORM_SUPPORT = {
  twitter: { supported: true, note: 'Full GIF support' },
  facebook: { supported: true, note: 'Full GIF support' },
  instagram: { supported: false, note: 'Converts to video (MP4)' },
  linkedin: { supported: false, note: 'Shows as static image' },
  tiktok: { supported: false, note: 'Not supported' },
  threads: { supported: false, note: 'Limited support' },
  pinterest: { supported: false, note: 'Static image only' },
  youtube: { supported: false, note: 'Not supported' },
  bluesky: { supported: true, note: 'Full GIF support' },
  mastodon: { supported: true, note: 'Full GIF support' }
};

export function GiphyPicker({ onSelect, onClose, selectedPlatforms = [] }: GiphyPickerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedGif, setSelectedGif] = useState<GiphyResult | null>(null);
  const [recentGifs, setRecentGifs] = useState<GiphyResult[]>([]);
  const [hoveredGif, setHoveredGif] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load recent GIFs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('giphy_recent');
    if (stored) {
      try {
        setRecentGifs(JSON.parse(stored));
      } catch (error) {
        console.warn('Failed to parse recent GIFs:', error);
      }
    }
  }, []);

  // Save recent GIF
  const saveRecentGif = useCallback((gif: GiphyResult) => {
    const updated = [gif, ...recentGifs.filter(g => g.id !== gif.id)].slice(0, 10);
    setRecentGifs(updated);
    localStorage.setItem('giphy_recent', JSON.stringify(updated));
  }, [recentGifs]);

  // API calls
  const fetchGifs = useCallback(async (
    type: 'trending' | 'search' | 'stickers' | 'stickers-trending',
    query?: string,
    loadMore = false
  ) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    const currentOffset = loadMore ? offset : 0;
    
    try {
      let url = '';
      const params = new URLSearchParams({
        limit: '20',
        offset: currentOffset.toString()
      });
      
      if (query) {
        params.append('q', query);
      }
      
      switch (type) {
        case 'trending':
          url = `/api/v1/giphy/trending?${params}`;
          break;
        case 'search':
          url = `/api/v1/giphy/search?${params}`;
          break;
        case 'stickers':
          url = `/api/v1/giphy/stickers?${params}`;
          break;
        case 'stickers-trending':
          url = `/api/v1/giphy/stickers/trending?${params}`;
          break;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch GIFs');
      }
      
      const data = await response.json();
      
      if (loadMore) {
        setGifs(prev => [...prev, ...data.data]);
      } else {
        setGifs(data.data);
      }
      
      setOffset(currentOffset + 20);
      setHasMore(data.data.length === 20);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GIFs');
    } finally {
      setLoading(false);
    }
  }, [loading, offset]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      if (query.trim()) {
        setOffset(0);
        fetchGifs(activeTab === 'stickers' ? 'stickers' : 'search', query);
      }
    }, 300),
    [fetchGifs, activeTab]
  );

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.trim()) {
      setActiveTab('search');
      debouncedSearch(value);
    }
  }, [debouncedSearch]);

  // Handle tab change
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery('');
    setOffset(0);
    setGifs([]);
    
    if (tab === 'trending') {
      fetchGifs('trending');
    } else if (tab === 'stickers') {
      fetchGifs('stickers-trending');
    } else if (tab === 'recent') {
      // Recent tab shows local storage data
    }
  }, [fetchGifs]);

  // Load initial data
  useEffect(() => {
    fetchGifs('trending');
  }, []);

  // Focus search input
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle scroll for infinite loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loading && activeTab !== 'recent') {
      if (activeTab === 'search' && searchQuery.trim()) {
        fetchGifs('search', searchQuery, true);
      } else if (activeTab === 'stickers' && searchQuery.trim()) {
        fetchGifs('stickers', searchQuery, true);
      } else if (activeTab === 'trending') {
        fetchGifs('trending', undefined, true);
      } else if (activeTab === 'stickers') {
        fetchGifs('stickers-trending', undefined, true);
      }
    }
  }, [hasMore, loading, activeTab, searchQuery, fetchGifs]);

  // Handle GIF selection
  const handleGifSelect = useCallback((gif: GiphyResult) => {
    setSelectedGif(gif);
  }, []);

  // Handle add to post
  const handleAddToPost = useCallback(() => {
    if (selectedGif) {
      saveRecentGif(selectedGif);
      onSelect(selectedGif);
      onClose();
    }
  }, [selectedGif, saveRecentGif, onSelect, onClose]);

  // Get platform warnings
  const platformWarnings = useMemo(() => {
    const warnings: string[] = [];
    const unsupported: string[] = [];
    
    selectedPlatforms.forEach(platform => {
      const support = PLATFORM_SUPPORT[platform as keyof typeof PLATFORM_SUPPORT];
      if (support) {
        if (!support.supported) {
          if (platform === 'instagram') {
            warnings.push(`${platform}: ${support.note}`);
          } else {
            unsupported.push(`${platform}: ${support.note}`);
          }
        }
      }
    });
    
    return { warnings, unsupported };
  }, [selectedPlatforms]);

  const displayGifs = activeTab === 'recent' ? recentGifs : gifs;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Choose a GIF</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for GIFs..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => handleTabChange('trending')}
            className={`flex items-center gap-2 px-4 py-2 font-medium ${
              activeTab === 'trending'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </button>
          <button
            onClick={() => handleTabChange('stickers')}
            className={`flex items-center gap-2 px-4 py-2 font-medium ${
              activeTab === 'stickers'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Sticker className="h-4 w-4" />
            Stickers
          </button>
          {recentGifs.length > 0 && (
            <button
              onClick={() => handleTabChange('recent')}
              className={`flex items-center gap-2 px-4 py-2 font-medium ${
                activeTab === 'recent'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Clock className="h-4 w-4" />
              Recent
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* GIF Grid */}
          <div className="flex-1 flex flex-col">
            {error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                  <p className="text-gray-600">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      if (activeTab === 'trending') {
                        fetchGifs('trending');
                      } else if (activeTab === 'stickers') {
                        fetchGifs('stickers-trending');
                      }
                    }}
                    className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : displayGifs.length === 0 && !loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">
                    {activeTab === 'recent' 
                      ? 'No recent GIFs yet'
                      : searchQuery 
                        ? 'No GIFs found for your search'
                        : 'Start searching for GIFs'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div
                ref={gridRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {displayGifs.map((gif) => (
                    <div
                      key={gif.id}
                      onClick={() => handleGifSelect(gif)}
                      onMouseEnter={() => setHoveredGif(gif.id)}
                      onMouseLeave={() => setHoveredGif(null)}
                      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                        selectedGif?.id === gif.id
                          ? 'ring-2 ring-purple-600 ring-offset-2'
                          : 'hover:ring-2 hover:ring-gray-300'
                      }`}
                    >
                      <img
                        src={hoveredGif === gif.id ? gif.images.original.url : gif.images.fixed_height.url}
                        alt={gif.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {selectedGif?.id === gif.id && (
                        <div className="absolute inset-0 bg-purple-600 bg-opacity-20 flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {loading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {selectedGif && (
            <div className="w-80 border-l bg-gray-50 p-4 flex flex-col">
              <h3 className="font-medium mb-3">Preview</h3>
              
              {/* GIF Preview */}
              <div className="bg-white rounded-lg p-3 mb-4">
                <img
                  src={selectedGif.images.original.url}
                  alt={selectedGif.title}
                  className="w-full rounded"
                />
                <div className="mt-2 text-sm text-gray-600">
                  <p className="font-medium truncate">{selectedGif.title}</p>
                  <p className="text-xs">
                    {selectedGif.images.original.width} × {selectedGif.images.original.height}
                  </p>
                </div>
              </div>

              {/* Platform Support */}
              {selectedPlatforms.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Platform Support</h4>
                  <div className="space-y-1">
                    {selectedPlatforms.map(platform => {
                      const support = PLATFORM_SUPPORT[platform as keyof typeof PLATFORM_SUPPORT];
                      if (!support) return null;
                      
                      return (
                        <div key={platform} className="flex items-center gap-2 text-sm">
                          {support.supported ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="capitalize">{platform}</span>
                          <span className="text-gray-500 text-xs">{support.note}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {(platformWarnings.warnings.length > 0 || platformWarnings.unsupported.length > 0) && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      {platformWarnings.warnings.length > 0 && (
                        <p className="text-yellow-800">
                          ⚠️ Will be converted to video for Instagram
                        </p>
                      )}
                      {platformWarnings.unsupported.length > 0 && (
                        <p className="text-yellow-800">
                          ⚠️ Some platforms show as static image
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Add Button */}
              <button
                onClick={handleAddToPost}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Add to Post
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-center text-xs text-gray-500">
            <span>Powered by</span>
            <img
              src="https://giphy.com/static/img/giphy_logo_square_social.png"
              alt="GIPHY"
              className="h-4 w-4 mx-1"
            />
            <span>GIPHY</span>
          </div>
        </div>
      </div>
    </div>
  );
}