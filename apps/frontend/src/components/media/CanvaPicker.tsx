/**
 * CanvaPicker Component
 * 
 * Design browser for importing designs from Canva
 */

import { useState, useEffect, useCallback } from 'react';
import { designIntegrationsService, CanvaDesign, CanvaExportJob } from '@/services/design-integrations.service';

interface CanvaPickerProps {
  onImport: (file: File) => void;
  onError: (error: string) => void;
}

export function CanvaPicker({ onImport, onError }: CanvaPickerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [designs, setDesigns] = useState<CanvaDesign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextPage, setNextPage] = useState<string | undefined>();
  const [exportingDesigns, setExportingDesigns] = useState<Set<string>>(new Set());

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load designs when component mounts or search changes
  useEffect(() => {
    if (isConnected) {
      loadDesigns(true);
    }
  }, [isConnected, debouncedQuery]);

  const loadDesigns = async (reset = false) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const page = reset ? undefined : nextPage;
      const result = await designIntegrationsService.getCanvaDesigns(page, debouncedQuery);

      if (reset) {
        setDesigns(result.designs);
      } else {
        setDesigns(prev => [...prev, ...result.designs]);
      }
      
      setNextPage(result.nextPage);
      setIsConnected(true);
    } catch (error: any) {
      console.error('Failed to load Canva designs:', error);
      if (error.response?.status === 400) {
        setIsConnected(false);
      } else {
        onError('Failed to load designs from Canva');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const authUrl = await designIntegrationsService.getCanvaAuthUrl();
      
      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'canva-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Listen for popup messages
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'CANVA_OAUTH_SUCCESS') {
          popup?.close();
          setIsConnected(true);
          loadDesigns(true);
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'CANVA_OAUTH_ERROR') {
          popup?.close();
          onError('Failed to connect to Canva');
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to connect to Canva:', error);
      onError('Failed to connect to Canva');
    }
  };

  const handleExportDesign = async (design: CanvaDesign) => {
    if (exportingDesigns.has(design.id)) return;

    try {
      setExportingDesigns(prev => new Set(prev).add(design.id));

      // Start export
      const exportJob = await designIntegrationsService.exportCanvaDesign(design.id, 'png');
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 15; // 30 seconds max
      
      const pollStatus = async (): Promise<CanvaExportJob> => {
        const status = await designIntegrationsService.getCanvaExportStatus(exportJob.jobId);
        
        if (status.status === 'completed' && status.url) {
          return status;
        } else if (status.status === 'failed') {
          throw new Error('Export failed');
        } else if (attempts >= maxAttempts) {
          throw new Error('Export timeout');
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
        return pollStatus();
      };

      const completedJob = await pollStatus();
      
      // Download and convert to File
      const filename = `${design.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const file = await designIntegrationsService.downloadImageAsFile(completedJob.url!, filename);
      
      onImport(file);
    } catch (error) {
      console.error('Failed to export Canva design:', error);
      onError('Failed to import design from Canva');
    } finally {
      setExportingDesigns(prev => {
        const next = new Set(prev);
        next.delete(design.id);
        return next;
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await designIntegrationsService.disconnectCanva();
      setIsConnected(false);
      setDesigns([]);
      setNextPage(undefined);
    } catch (error) {
      console.error('Failed to disconnect Canva:', error);
      onError('Failed to disconnect Canva');
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <div className="w-16 h-16 mb-4 bg-purple-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.5 7.5h9v9h-9z"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect to Canva</h3>
        <p className="text-gray-600 text-center mb-6 max-w-sm">
          Connect your Canva account to browse and import your designs directly into your posts.
        </p>
        <button
          onClick={handleConnect}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Connect Canva
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.5 7.5h9v9h-9z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Import from Canva</h2>
        </div>
        
        <button
          onClick={handleDisconnect}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Disconnect
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search designs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Designs Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && designs.length === 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-500 text-center">
              {searchQuery ? 'No designs found matching your search.' : 'No designs found.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {designs.map((design) => {
                const isExporting = exportingDesigns.has(design.id);
                
                return (
                  <div
                    key={design.id}
                    className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => !isExporting && handleExportDesign(design)}
                  >
                    {design.thumbnailUrl ? (
                      <img
                        src={design.thumbnailUrl}
                        alt={design.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.5 7.5h9v9h-9z"/>
                        </svg>
                      </div>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                      {isExporting ? (
                        <div className="bg-white rounded-full p-2">
                          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white rounded-full p-2 shadow-lg">
                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                      <p className="text-white text-sm font-medium truncate">{design.title}</p>
                      <p className="text-white text-xs opacity-75">
                        {new Date(design.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {nextPage && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => loadDesigns(false)}
                  disabled={isLoading}
                  className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}