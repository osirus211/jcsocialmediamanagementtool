/**
 * FigmaPicker Component
 * 
 * Design browser for importing designs from Figma
 */

import { useState, useEffect } from 'react';
import { designIntegrationsService, FigmaFile, FigmaFrame } from '@/services/design-integrations.service';

interface FigmaPickerProps {
  onImport: (file: File) => void;
  onError: (error: string) => void;
}

export function FigmaPicker({ onImport, onError }: FigmaPickerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [files, setFiles] = useState<FigmaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<FigmaFile | null>(null);
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingFrames, setExportingFrames] = useState<Set<string>>(new Set());

  // Load files when component mounts
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const result = await designIntegrationsService.getFigmaFiles();
      setFiles(result.files);
      setIsConnected(true);
    } catch (error: any) {
      console.error('Failed to load Figma files:', error);
      if (error.response?.status === 400) {
        setIsConnected(false);
      } else {
        onError('Failed to load files from Figma');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadFrames = async (file: FigmaFile) => {
    try {
      setIsLoading(true);
      setSelectedFile(file);
      const result = await designIntegrationsService.getFigmaFrames(file.key);
      setFrames(result.frames);
    } catch (error) {
      console.error('Failed to load Figma frames:', error);
      onError('Failed to load frames from Figma file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
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
          loadFiles();
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
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to connect to Figma:', error);
      onError('Failed to connect to Figma');
    }
  };

  const handleExportFrame = async (frame: FigmaFrame) => {
    if (!selectedFile || exportingFrames.has(frame.id)) return;

    try {
      setExportingFrames(prev => new Set(prev).add(frame.id));

      // Export frame
      const result = await designIntegrationsService.exportFigmaFrame(
        selectedFile.key,
        frame.id,
        'png'
      );
      
      // Download and convert to File
      const filename = `${frame.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const file = await designIntegrationsService.downloadImageAsFile(result.url, filename);
      
      onImport(file);
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
      setSelectedFile(null);
      setFrames([]);
    } catch (error) {
      console.error('Failed to disconnect Figma:', error);
      onError('Failed to disconnect Figma');
    }
  };

  const handleBack = () => {
    setSelectedFile(null);
    setFrames([]);
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
        <button
          onClick={handleConnect}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect Figma
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {selectedFile && (
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
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedFile ? `${selectedFile.name} - Frames` : 'Import from Figma'}
          </h2>
        </div>
        
        <button
          onClick={handleDisconnect}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Disconnect
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : selectedFile ? (
          // Frames view
          frames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-center">No frames found in this file.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {frames.map((frame) => {
                const isExporting = exportingFrames.has(frame.id);
                
                return (
                  <div
                    key={frame.id}
                    className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => !isExporting && handleExportFrame(frame)}
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
                      <p className="text-white text-sm font-medium truncate">{frame.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // Files view
          files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-center">No Figma files found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.key}
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                  onClick={() => loadFrames(file)}
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
                  
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}