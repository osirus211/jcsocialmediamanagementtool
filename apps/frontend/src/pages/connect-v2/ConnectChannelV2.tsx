/**
 * Connect Channel V2 Page - MILESTONE 1
 * 
 * Minimal implementation for V2 OAuth flow
 * 
 * Features:
 * - Platform list from API
 * - Connect button per platform
 * - OAuth redirect
 * - Callback handling
 * - Basic error/success messages
 * 
 * No UI polish, no animations, no state machine
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';

interface Platform {
  name: string;
  displayName: string;
}

export const ConnectChannelV2Page = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Handle OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const message = searchParams.get('message');
    const platform = searchParams.get('platform');
    const accountId = searchParams.get('account');

    if (success === 'true') {
      setError(null);
      alert(`✅ Success! Connected ${platform} account (ID: ${accountId})`);
      // Clear URL params
      window.history.replaceState({}, '', '/connect-v2');
    } else if (errorParam) {
      setError(`❌ Error: ${message || errorParam}`);
    }
  }, [searchParams]);

  // Fetch available platforms
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/oauth/platforms');
        
        console.log('API Response:', response);
        
        // Check if response has the expected structure
        if (!response || !response.platforms) {
          console.error('Invalid response structure:', response);
          setError('Invalid response from server');
          setLoading(false);
          return;
        }
        
        // Map platform names to display names
        const platformMap: Record<string, string> = {
          twitter: 'Twitter',
          linkedin: 'LinkedIn',
          facebook: 'Facebook',
          instagram: 'Instagram',
        };

        const platformList = response.platforms.map((p: string) => ({
          name: p,
          displayName: platformMap[p] || p,
        }));

        setPlatforms(platformList);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to fetch platforms:', err);
        console.error('Error response:', err.response?.data);
        setError(`Failed to load platforms: ${err.response?.data?.message || err.message}`);
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, []);

  // Handle connect button click
  const handleConnect = async (platform: string) => {
    try {
      setLoading(true);
      // Call authorize endpoint to get authorization URL
      const response = await apiClient.post(`/oauth/${platform}/authorize`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // If backend returns authorizationUrl, redirect to it
      if (response.authorizationUrl) {
        window.location.href = response.authorizationUrl;
      }
    } catch (err: any) {
      console.error('Failed to initiate OAuth:', err);
      setError(`Failed to connect: ${err.response?.data?.message || err.message}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Connect Channel V2</h1>
          <p className="text-gray-600">Loading platforms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Connect Channel V2</h1>
            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
              Milestone 1
            </span>
          </div>
          <p className="text-gray-600">
            Connect your social media accounts using V2 OAuth flow
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-2">Milestone 1: New Accounts Only</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✅ Creates NEW accounts with connectionVersion='v2'</li>
            <li>✅ Uses same encryption as V1</li>
            <li>✅ Compatible with existing workers</li>
            <li>⚠️ Returns error if account already exists (no upgrade yet)</li>
          </ul>
        </div>

        {/* Platform List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Available Platforms</h2>
          
          {platforms.length === 0 ? (
            <p className="text-gray-600">No platforms available</p>
          ) : (
            <div className="space-y-4">
              {platforms.map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">{platform.displayName}</h3>
                    <p className="text-sm text-gray-600">Connect your {platform.displayName} account</p>
                  </div>
                  <button
                    onClick={() => handleConnect(platform.name)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                  >
                    Connect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-100 rounded text-xs text-gray-600">
          <p className="font-semibold mb-2">Debug Info:</p>
          <p>API URL: {import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}</p>
          <p>Platforms loaded: {platforms.length}</p>
        </div>
      </div>
    </div>
  );
};
