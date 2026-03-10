import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Webhook, ExternalLink, Info } from 'lucide-react';
import { WebhookEndpoint, webhooksService } from '@/services/webhooks.service';
import { WebhookEndpointCard } from '@/components/settings/WebhookEndpointCard';
import { WebhookEndpointForm } from '@/components/settings/WebhookEndpointForm';

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await webhooksService.listEndpoints();
      setWebhooks(data);
    } catch (err: any) {
      console.error('Failed to load webhooks:', err);
      setError('Failed to load webhook endpoints');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadWebhooks();
    } catch (err) {
      console.error('Failed to refresh webhooks:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await webhooksService.deleteEndpoint(id);
      setWebhooks(prev => prev.filter(w => w._id !== id));
    } catch (err: any) {
      console.error('Failed to delete webhook:', err);
      setError('Failed to delete webhook endpoint');
    }
  };

  const handleEdit = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    loadWebhooks();
    setEditingWebhook(undefined);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingWebhook(undefined);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Webhook className="h-8 w-8" />
            Webhooks
          </h1>
          <p className="mt-2 text-gray-600">
            Receive real-time notifications when events occur in your workspace
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Endpoint
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 mb-1">
              How Webhooks Work
            </h3>
            <p className="text-blue-800 text-sm mb-3">
              Webhooks send HTTP POST requests to your endpoints when events occur. 
              All requests are signed with HMAC-SHA256 for security verification.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <a
                href="#"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View Documentation
              </a>
              <a
                href="#"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Signature Verification
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-6">
            <Webhook className="h-full w-full" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No webhook endpoints yet
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Add your first webhook endpoint to start receiving real-time notifications 
            when events occur in your workspace.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Your First Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {webhooks.map((webhook) => (
            <WebhookEndpointCard
              key={webhook._id}
              webhook={webhook}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUpdate={loadWebhooks}
            />
          ))}
        </div>
      )}

      {/* Webhook Form Modal */}
      <WebhookEndpointForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        webhook={editingWebhook}
      />
    </div>
  );
}