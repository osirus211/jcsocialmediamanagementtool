/**
 * Google Analytics Integration Component
 * 
 * Handles connecting/disconnecting Google Analytics and displaying integration status
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, ExternalLink, CheckCircle, AlertCircle, Unlink } from 'lucide-react';
import { analyticsService } from '../../services/analytics.service';

interface GoogleAnalyticsConfig {
  isConnected: boolean;
  propertyId?: string;
  propertyName?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

interface GoogleAnalyticsIntegrationProps {
  className?: string;
}

export const GoogleAnalyticsIntegration: React.FC<GoogleAnalyticsIntegrationProps> = ({ className }) => {
  const [config, setConfig] = useState<GoogleAnalyticsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock API call - replace with actual service call
      const response = await fetch('/api/v1/integrations/google-analytics');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        setConfig({ isConnected: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Google Analytics configuration');
      setConfig({ isConnected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      // Redirect to Google OAuth flow
      const authUrl = `/api/v1/integrations/google-analytics/auth?redirect=${encodeURIComponent(window.location.href)}`;
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate Google Analytics connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Analytics? This will stop tracking referral traffic from your social media posts.')) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);

      const response = await fetch('/api/v1/integrations/google-analytics', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Google Analytics');
      }

      setConfig({ isConnected: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Google Analytics');
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading Google Analytics integration...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Google Analytics Integration
          {config?.isConnected ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {config?.isConnected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Property:</span>
                <p className="mt-1">{config.propertyName || config.propertyId}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Connected:</span>
                <p className="mt-1">
                  {config.connectedAt ? new Date(config.connectedAt).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Last Sync:</span>
                <p className="mt-1">
                  {config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => window.open('https://analytics.google.com', '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Google Analytics
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">What's being tracked:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Social media referral traffic from your posts</li>
                <li>• Campaign performance and attribution</li>
                <li>• Link click tracking and conversions</li>
                <li>• User engagement from social platforms</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Connect your Google Analytics account to track how your social media posts drive traffic to your website.
            </p>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Benefits of connecting:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Track referral traffic from social media posts</li>
                <li>• Measure campaign ROI and conversion rates</li>
                <li>• Understand which platforms drive the most valuable traffic</li>
                <li>• Get detailed attribution reports</li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full sm:w-auto"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect Google Analytics
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};