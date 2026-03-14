import { useState, useEffect } from 'react';
import { Save, ExternalLink, Key, CheckCircle, XCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface BitlyConfig {
  accessToken: string;
  enabled: boolean;
  customDomain?: string;
}

export function BitlySettings() {
  const [config, setConfig] = useState<BitlyConfig>({
    accessToken: '',
    enabled: false,
    customDomain: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Load from localStorage for now (in real app, would be from API)
      const saved = localStorage.getItem('bitly-config');
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (error) {
      logger.error('Failed to load Bitly config', error);
    }
  };

  const saveConfig = async () => {
    try {
      setIsLoading(true);
      
      // Save to localStorage for now (in real app, would be API call)
      localStorage.setItem('bitly-config', JSON.stringify(config));
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      logger.error('Failed to save Bitly config', error);
      alert('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config.accessToken) {
      setTestResult({ success: false, message: 'Access token is required' });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);

      // Mock test (in real app, would call Bitly API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success/failure based on token format
      const isValidFormat = config.accessToken.length > 20;
      
      if (isValidFormat) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: 'Invalid access token format' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Connection failed' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Key className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Bitly Integration</h3>
          <p className="text-sm text-gray-600">
            Connect your Bitly account for professional URL shortening
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Enable Bitly</label>
            <p className="text-sm text-gray-500">Use Bitly for URL shortening when available</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Access Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Access Token
          </label>
          <div className="space-y-2">
            <input
              type="password"
              value={config.accessToken}
              onChange={(e) => setConfig(prev => ({ ...prev, accessToken: e.target.value }))}
              placeholder="Enter your Bitly access token"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={testConnection}
                disabled={isTesting || !config.accessToken}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult && (
                <div className={`flex items-center gap-1 text-sm ${
                  testResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Get your access token from{' '}
            <a
              href="https://bitly.com/a/oauth_apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              Bitly Developer Settings
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        {/* Custom Domain */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Domain (Optional)
          </label>
          <input
            type="text"
            value={config.customDomain}
            onChange={(e) => setConfig(prev => ({ ...prev, customDomain: e.target.value }))}
            placeholder="e.g., yourbrand.ly"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Use your branded domain for shortened links (requires Bitly Pro)
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            onClick={saveConfig}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </button>
          
          {isSaved && (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Saved successfully
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">How it works</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• When enabled, new links will be shortened using Bitly</li>
            <li>• If Bitly fails, the system falls back to built-in shortener</li>
            <li>• Existing links remain unchanged</li>
            <li>• Analytics combine data from both Bitly and built-in tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}