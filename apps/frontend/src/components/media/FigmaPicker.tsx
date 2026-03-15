/**
 * FigmaPicker Component
 * 
 * Advanced design browser for importing designs from Figma
 * Features: OAuth + Personal Token, Search, Pages, Thumbnails, Multiple Export Formats
 */

import { useState, useEffect } from 'react';
import { 
  designIntegrationsService, 
  FigmaFile, 
  FigmaFrame, 
  FigmaPage,
  FigmaExportOptions 
} from '@/services/design-integrations.service';

interface FigmaPickerProps {
  onImport: (file: File) => void;
  onError: (error: string) => void;
}

type ConnectionMethod = 'oauth' | 'token';
type ViewMode = 'files' | 'recent' | 'pages' | 'frames';

export function FigmaPicker({ onImport, onError }: FigmaPickerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('oauth');
  const [personalToken, setPersonalToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Data states
  const [files, setFiles] = useState<FigmaFile[]>([]);
  const [recentFiles, setRecentFiles] = useState<FigmaFile[]>([]);
  const [pages, setPages] = useState<FigmaPage[]>([]);
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  
  // Navigation states
  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [selectedFile, setSelectedFile] = useState<FigmaFile | null>(null);
  const [selectedPage, setSelectedPage] = useState<FigmaPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading and export states
  const [isLoading, setIsLoading] = useState(false);
  const [exportingFrames, setExportingFrames] = useState<Set<string>>(new Set());
  const [showExportOptions, setShowExportOptions] = useState<string | null>(null);
  
  // Export options
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg' | 'pdf'>('png');
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(2);
  const [platformSize, setPlatformSize] = useState<string>('custom');

  // Load initial data when component mounts
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadFiles(),
        loadRecentFiles(),
      ]);
      setIsConnected(true);
    } catch (error: any) {
      console.error('Failed to load initial Figma data:', error);
      if (error.response?.status === 400) {
        setIsConnected(false);
      } else {
        onError('Failed to load data from Figma');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const result = await designIntegrationsService.getFigmaFiles(searchQuery || undefined);
      setFiles(result.files);
    } catch (error) {
      console.error('Failed to load Figma files:', error);
      onError('Failed to load files from Figma');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentFiles = async () => {
    try {
      const result = await designIntegrationsService.getFigmaRecentFiles(10);
      setRecentFiles(result.files);
    } catch (error) {
      console.error('Failed to load recent Figma files:', error);
      // Don't show error for recent files, it's not critical
    }
  };

  const loadPages = async (file: FigmaFile) => {
    try {
      setIsLoading(true);
      setSelectedFile(file);
      const result = await designIntegrationsService.getFigmaPages(file.key);
      setPages(result.pages);
      setViewMode('pages');
    } catch (error) {
      console.error('Failed to load Figma pages:', error);
      onError('Failed to load pages from Figma file');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFrames = async (file: FigmaFile, page?: FigmaPage) => {
    try {
      setIsLoading(true);
      setSelectedFile(file);
      setSelectedPage(page || null);
      const result = await designIntegrationsService.getFigmaFrames(
        file.key, 
        page?.id
      );
      setFrames(result.frames);
      setViewMode('frames');
    } catch (error) {
      console.error('Failed to load Figma frames:', error);
      onError('Failed to load frames from Figma file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (connectionMethod === 'token') {
      await handleTokenConnect();
    } else {
      await handleOAuthConnect();
    }
  };

  const handleTokenConnect = async () => {
    if (!personalToken.trim()) {
      onError('Please enter your Figma personal access token');
      return;
    }

    try {
      setIsConnecting(true);
      await designIntegrationsService.connectFigmaWithToken(personalToken);
      setIsConnected(true);
      await loadInitialData();
    } catch (error) {
      console.error('Failed to connect with token:', error);
      onError('Failed to connect with personal access token. Please check your token.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOAuthConnect = async () => {
    try {
      setIsConnecting(true);
      const authUrl = await designIntegrationsService.getFigmaAuthUrl();
      
      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'figma-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Listen for popup messages
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'FIGMA_OAUTH_SUCCESS') {
          popup?.close();
          setIsConnected(true);
          loadInitialData();
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'FIGMA_OAUTH_ERROR') {
          popup?.close();
          onError('Failed to connect to Figma');
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to connect to Figma:', error);
      onError('Failed to connect to Figma');
      setIsConnecting(false);
    }
  };

  const handleExportFrame = async (frame: FigmaFrame, customOptions?: Partial<FigmaExportOptions>) => {
    if (!selectedFile || exportingFrames.has(frame.id)) return;

    try {
      setExportingFrames(prev => new Set(prev).add(frame.id));

      const exportOptions: FigmaExportOptions = {
        format: exportFormat,
        scale: exportScale,
        platformSize: platformSize === 'custom' ? undefined : platformSize as any,
        ...customOptions,
      };

      // Export frame
      const result = await designIntegrationsService.exportFigmaFrame(
        selectedFile.key,
        frame.id,
        exportOptions
      );
      
      // Download and convert to File
      const extension = exportOptions.format;
      const filename = `${frame.name.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
      const file = await designIntegrationsService.downloadImageAsFile(result.url, filename);
      
      onImport(file);
      setShowExportOptions(null);
    } catch (error) {
      console.error('Failed to export Figma frame:', error);
      onError('Failed to import frame from Figma');
    } finally {
      setExportingFrames(prev => {
        const next = new Set(prev);
        next.delete(frame.id);
        return next;
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await designIntegrationsService.disconnectFigma();
      setIsConnected(false);
      setFiles([]);
      setRecentFiles([]);
      setPages([]);
      setFrames([]);
      setSelectedFile(null);
      setSelectedPage(null);
      setViewMode('files');
      setSearchQuery('');
      setPersonalToken('');
    } catch (error) {
      console.error('Failed to disconnect Figma:', error);
      onError('Failed to disconnect Figma');
    }
  };

  const handleBack = () => {
    if (viewMode === 'frames') {
      if (selectedPage) {
        setViewMode('pages');
        setFrames([]);
        setSelectedPage(null);
      } else {
        setViewMode('files');
        setFrames([]);
        setSelectedFile(null);
      }
    } else if (viewMode === 'pages') {
      setViewMode('files');
      setPages([]);
      setSelectedFile(null);
    }
  };

  const handleSearch = async () => {
    if (viewMode === 'files') {
      await loadFiles();
    }
  };

  const handleQuickExport = (frame: FigmaFrame) => {
    handleExportFrame(frame);
  };

  const handleAdvancedExport = (frame: FigmaFrame) => {
    setShowExportOptions(frame.id);
  };

  const renderExportOptions = (frame: FigmaFrame) => {
    const platformSizes = designIntegrationsService.getPlatformSizes();
    const exportFormats = designIntegrationsService.getFigmaExportFormats();
    const exportScales = designIntegrationsService.getExportScales();

    return (
      <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-10">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full">
          <h3 className="text-lg font-semibold mb-4">Export Options</h3>
          
          {/* Format Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {exportFormats.map(format => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scale Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
            <select
              value={exportScale}
              onChange={(e) => setExportScale(Number(e.target.value) as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {exportScales.map(scale => (
                <option key={scale.value} value={scale.value}>
                  {scale.label}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Size Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Platform Size</label>
            <select
              value={platformSize}
              onChange={(e) => setPlatformSize(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {platformSizes.map(size => (
                <option key={size.value} value={size.value}>
                  {size.label} {size.dimensions !== 'Custom' && `(${size.dimensions})`}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowExportOptions(null)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleExportFrame(frame)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <div className="w-16 h-16 mb-4 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect to Figma</h3>
        <p className="text-gray-600 text-center mb-6 max-w-sm">
          Connect your Figma account to browse and import frames from your design files.
        </p>

        {/* Connection Method Tabs */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setConnectionMethod('oauth')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              connectionMethod === 'oauth'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            OAuth
          </button>
          <button
            onClick={() => setConnectionMethod('token')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              connectionMethod === 'token'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Personal Token
          </button>
        </div>

        {/* Connection Form */}
        {connectionMethod === 'token' && (
          <div className="w-full max-w-sm mb-4">
            <input
              type="password"
              placeholder="Enter your Figma personal access token"
              value={personalToken}
              onChange={(e) => setPersonalToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Get your token from{' '}
              <a
                href="https://www.figma.com/developers/api#access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Figma Settings
              </a>
            </p>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={isConnecting || (connectionMethod === 'token' && !personalToken.trim())}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? 'Connecting...' : 'Connect Figma'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {(viewMode === 'pages' || viewMode === 'frames') && (
            <button
              onClick={handleBack}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {viewMode === 'frames' && selectedFile && selectedPage
                ? `${selectedFile.name} - ${selectedPage.name}`
                : viewMode === 'frames' && selectedFile
                ? `${selectedFile.name} - Frames`
                : viewMode === 'pages' && selectedFile
                ? `${selectedFile.name} - Pages`
                : viewMode === 'recent'
                ? 'Recent Files'
                : 'Import from Figma'
              }
            </h2>
            {viewMode === 'frames' && frames.length > 0 && (
              <p className="text-sm text-gray-500">{frames.length} frames found</p>
            )}
          </div>
        </div>
        
        <button
          onClick={handleDisconnect}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Disconnect
        </button>
      </div>

      {/* Navigation Tabs */}
      {viewMode === 'files' || viewMode === 'recent' ? (
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewMode('files')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'files'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All Files
          </button>
          <button
            onClick={() => setViewMode('recent')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'recent'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Recent
          </button>
        </div>
      ) : null}

      {/* Search Bar */}
      {viewMode === 'files' && (
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  loadFiles();
                }}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'frames' ? (
          // Frames view
          frames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-center">No frames found in this {selectedPage ? 'page' : 'file'}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {frames.map((frame) => {
                const isExporting = exportingFrames.has(frame.id);
                const showingOptions = showExportOptions === frame.id;
                
                return (
                  <div
                    key={frame.id}
                    className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  >
                    {frame.thumbnailUrl ? (
                      <img
                        src={frame.thumbnailUrl}
                        alt={frame.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                      {isExporting ? (
                        <div className="bg-white rounded-full p-2">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button
                            onClick={() => handleQuickExport(frame)}
                            className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-50"
                            title="Quick export (PNG, 2x)"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleAdvancedExport(frame)}
                            className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-50"
                            title="Export options"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                      <p className="text-white text-sm font-medium truncate">{frame.name}</p>
                      {frame.pageName && (
                        <p className="text-white text-xs opacity-75 truncate">{frame.pageName}</p>
                      )}
                    </div>

                    {/* Export Options Modal */}
                    {showingOptions && renderExportOptions(frame)}
                  </div>
                );
              })}
            </div>
          )
        ) : viewMode === 'pages' ? (
          // Pages view
          pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-center">No pages found in this file.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                  onClick={() => selectedFile && loadFrames(selectedFile, page)}
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{page.name}</h3>
                    <p className="text-sm text-gray-500">Page</p>
                  </div>
                  
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          )
        ) : (
          // Files view (both 'files' and 'recent')
          (() => {
            const currentFiles = viewMode === 'recent' ? recentFiles : files;
            
            return currentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500 text-center">
                  {viewMode === 'recent' ? 'No recent files found.' : 'No Figma files found.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentFiles.map((file) => (
                  <div
                    key={file.key}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => loadPages(file)}
                  >
                    {file.thumbnailUrl ? (
                      <img
                        src={file.thumbnailUrl}
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{file.name}</h3>
                      <p className="text-sm text-gray-500">
                        Modified {new Date(file.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadFrames(file);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded border border-blue-200 hover:border-blue-300"
                      >
                        All Frames
                      </button>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}