/**
 * DesignIntegrationsSettings Component
 * 
 * Settings page for managing Canva and Figma integrations
 */

import { useState, useEffect } from 'react';
import { designIntegrationsService } from '@/services/design-integrations.service';

interface IntegrationStatus {
  canva: {
    connected: boolean;
    displayName?: string;
  };
  figma: {
    connected: boolean;
    displayName?: string;
  };
}

export function DesignIntegrationsSettings() {
  const [status, setStatus] = useState<IntegrationStatus>({
    canva: { connected: false },
    figma: { connected: false },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      // Try to fetch designs/files to check if connected
      const canvaConnected = await designIntegrationsService.getCanvaDesigns()
        .then(() => true)
        .catch(() => false);
      
      const figmaConnected = await designIntegrationsService.getFigmaFiles()
        .then(() => true)
        .catch(() => false);

      setStatus({
        canva: { connected: canvaConnected },
        figma: { connected: figmaConnected },
      });
    } catch (error) {
      console.error('Failed to check connection status:', error);
    }
  };

  const handleCanvaConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
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
          setStatus(prev => ({
            ...prev,
            canva: { connected: true, displayName: event.data.displayName },
          }));
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'CANVA_OAUTH_ERROR') {
          popup?.close();
          setError('Failed to connect to Canva');
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
      setError('Failed to connect to Canva');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCanvaDisconnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await designIntegrationsService.disconnectCanva();
      setStatus(prev => ({
        ...prev,
        canva: { connected: false },
      }));
    } catch (error) {
      console.error('Failed to disconnect Canva:', error);
      setError('Failed to disconnect Canva');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFigmaConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
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
          setStatus(prev => ({
            ...prev,
            figma: { connected: true, displayName: event.data.displayName },
          }));
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'FIGMA_OAUTH_ERROR') {
          popup?.close();
          setError('Failed to connect to Figma');
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
      setError('Failed to connect to Figma');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFigmaDisconnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await designIntegrationsService.disconnectFigma();
      setStatus(prev => ({
        ...prev,
        figma: { connected: false },
      }));
    } catch (error) {
      console.error('Failed to disconnect Figma:', error);
      setError('Failed to disconnect Figma');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Design Integrations</h1>
        <p className="text-gray-600">
          Connect your design tools to import designs directly into your posts.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center justify-between">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Canva Integration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.5 7.5h9v9h-9z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Canva</h3>
                <p className="text-gray-600 text-sm">
                  Import designs from your Canva account
                </p>
                {status.canva.connected && status.canva.displayName && (
                  <p className="text-sm text-green-600 mt-1">
                    Connected as {status.canva.displayName}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {status.canva.connected ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Not Connected
                </span>
              )}
              
              {status.canva.connected ? (
                <button
                  onClick={handleCanvaDisconnect}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleCanvaConnect}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Figma Integration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Figma</h3>
                <p className="text-gray-600 text-sm">
                  Import frames from your Figma files
                </p>
                {status.figma.connected && status.figma.displayName && (
                  <p className="text-sm text-green-600 mt-1">
                    Connected as {status.figma.displayName}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {status.figma.connected ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Not Connected
                </span>
              )}
              
              {status.figma.connected ? (
                <button
                  onClick={handleFigmaDisconnect}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleFigmaConnect}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">How it works</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Canva:</strong> Connect your Canva account to browse and import your designs. 
            You can search through your designs and import them directly as images.
          </p>
          <p>
            <strong>Figma:</strong> Connect your Figma account to access your design files. 
            Browse through your files and import individual frames as images.
          </p>
          <p>
            <strong>Privacy:</strong> We only access your designs when you explicitly choose to import them. 
            Your design files remain private and secure.
          </p>
        </div>
      </div>
    </div>
  );
}