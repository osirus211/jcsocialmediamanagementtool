/**
 * Automation & Integrations Page
 * 
 * Management interface for Zapier and Make.com integrations
 */

import React, { useState, useEffect } from 'react';
import { Zap, ExternalLink, Copy, Trash2, Plus, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { AutomationService, AutomationApiKey, WebhookEndpoint } from '../../services/automation.service';
import { toast } from '@/lib/notifications';

const AutomationPage: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<AutomationApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [keysData, webhooksData] = await Promise.all([
        AutomationService.getAutomationApiKeys(),
        AutomationService.getWebhooks(),
      ]);
      setApiKeys(keysData);
      setWebhooks(webhooksData);
    } catch (error) {
      toast.error('Failed to load automation data');
      console.error('Failed to load automation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    try {
      setCreatingKey(true);
      const result = await AutomationService.createAutomationApiKey('Automation Integration');
      setApiKeys([...apiKeys, result.apiKey]);
      
      // Show the full API key in a toast (only time it's visible)
      toast.success(`API Key Created! Copy this key now - it won't be shown again: ${result.key}`);
    } catch (error) {
      toast.error('Failed to create API key');
      console.error('Failed to create API key:', error);
    } finally {
      setCreatingKey(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      await AutomationService.deleteWebhook(id);
      setWebhooks(webhooks.filter(w => w._id !== id));
      toast.success('Webhook deleted');
    } catch (error) {
      toast.error('Failed to delete webhook');
      console.error('Failed to delete webhook:', error);
    }
  };

  const getWebhookSource = (webhook: WebhookEndpoint): string => {
    if (webhook.url.includes('zapier.com')) return 'Zapier';
    if (webhook.url.includes('make.com') || webhook.url.includes('integromat.com')) return 'Make';
    return 'Custom';
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Zap className="h-8 w-8 text-purple-600" />
          Automations & Integrations
        </h1>
        <p className="mt-2 text-gray-600">
          Connect your social media scheduler to thousands of apps via Zapier and Make.com
        </p>
      </div>

      {/* API Key Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">API Key for Integrations</h2>
          {apiKeys.length === 0 && (
            <button
              onClick={createApiKey}
              disabled={creatingKey}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creatingKey ? 'Creating...' : 'Create API Key'}
            </button>
          )}
        </div>

        {apiKeys.length > 0 ? (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div key={key._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-white px-2 py-1 rounded border">
                      {key.prefix}...
                    </code>
                    <span className="text-sm text-gray-600">{key.name}</span>
                    {key.status === 'active' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Created {new Date(key.createdAt).toLocaleDateString()} • 
                    {key.requestCount} requests • 
                    Last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(key.prefix + '...', 'API Key')}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Copy API Key"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No API key created yet. Create one to start using integrations.</p>
          </div>
        )}
      </div>

      {/* Zapier Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Zap className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Zapier</h2>
              <p className="text-gray-600">Connect to 6,000+ apps via Zapier</p>
            </div>
          </div>
          <a
            href="https://zapier.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <ExternalLink className="h-4 w-4" />
            Connect to Zapier
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Setup Instructions</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              {AutomationService.getZapierInstructions().map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Available Triggers</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {AutomationService.getAvailableTriggers().map((trigger, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{trigger.name}</span>
                      <p className="text-xs text-gray-500">{trigger.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Available Actions</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {AutomationService.getAvailableActions().map((action, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{action.name}</span>
                      <p className="text-xs text-gray-500">{action.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Make.com Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Make.com</h2>
              <p className="text-gray-600">Automate workflows with Make.com</p>
            </div>
          </div>
          <a
            href="https://make.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            Connect to Make
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Setup Instructions</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              {AutomationService.getMakeInstructions().map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Webhook URL</h4>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-white px-2 py-1 rounded border flex-1">
                  {AutomationService.getMakeWebhookUrl()}
                </code>
                <button
                  onClick={() => copyToClipboard(AutomationService.getMakeWebhookUrl(), 'Webhook URL')}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Available Triggers</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {AutomationService.getAvailableTriggers().map((trigger, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{trigger.name}</span>
                      <p className="text-xs text-gray-500">{trigger.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Available Actions</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {AutomationService.getAvailableActions().map((action, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{action.name}</span>
                      <p className="text-xs text-gray-500">{action.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Active Connections */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Connections</h2>
        
        {webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div key={webhook._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      getWebhookSource(webhook) === 'Zapier' 
                        ? 'bg-orange-100 text-orange-800'
                        : getWebhookSource(webhook) === 'Make'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getWebhookSource(webhook)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {webhook.events.join(', ')}
                    </span>
                    {webhook.enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {webhook.successCount} successful • {webhook.failureCount} failed •
                    Last triggered {webhook.lastTriggeredAt ? new Date(webhook.lastTriggeredAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                <button
                  onClick={() => deleteWebhook(webhook._id)}
                  className="p-2 text-red-400 hover:text-red-600"
                  title="Delete webhook"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No active connections yet. Set up Zapier or Make.com integrations to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationPage;