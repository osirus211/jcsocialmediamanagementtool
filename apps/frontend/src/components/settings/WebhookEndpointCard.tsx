import { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  RotateCcw, 
  TestTube, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { WebhookEndpoint, webhooksService } from '@/services/webhooks.service';

interface WebhookEndpointCardProps {
  webhook: WebhookEndpoint;
  onEdit: (webhook: WebhookEndpoint) => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  'post.published': 'Post Published',
  'post.failed': 'Post Failed',
  'analytics.updated': 'Analytics Updated',
  'follower.milestone': 'Follower Milestone',
  'engagement.spike': 'Engagement Spike',
  'report.generated': 'Report Generated',
  'competitor.updated': 'Competitor Updated',
};

const EVENT_COLORS: Record<string, string> = {
  'post.published': 'bg-green-100 text-green-800',
  'post.failed': 'bg-red-100 text-red-800',
  'analytics.updated': 'bg-blue-100 text-blue-800',
  'follower.milestone': 'bg-purple-100 text-purple-800',
  'engagement.spike': 'bg-orange-100 text-orange-800',
  'report.generated': 'bg-indigo-100 text-indigo-800',
  'competitor.updated': 'bg-yellow-100 text-yellow-800',
};

export function WebhookEndpointCard({ webhook, onEdit, onDelete, onUpdate }: WebhookEndpointCardProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleRotateSecret = async () => {
    if (isRotating) return;

    setIsRotating(true);
    try {
      const result = await webhooksService.rotateSecret(webhook._id);
      setSecret(result.secret);
      setShowSecret(true);
      onUpdate();
    } catch (error) {
      console.error('Failed to rotate secret:', error);
    } finally {
      setIsRotating(false);
    }
  };

  const handleTest = async () => {
    if (isTesting) return;

    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await webhooksService.testEndpoint(webhook._id);
      setTestResult(result);
    } catch (error: unknown) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (isToggling) return;

    setIsToggling(true);
    try {
      await webhooksService.updateEndpoint(webhook._id, {
        enabled: !webhook.enabled,
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = () => {
    setShowConfirmDelete(false);
    onDelete(webhook._id);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900">
              {webhook.description || 'Webhook Endpoint'}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleEnabled}
                disabled={isToggling}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                  webhook.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    webhook.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-xs text-gray-500">
                {webhook.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-600 font-mono">
            {truncateUrl(webhook.url)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(webhook)}
            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
            title="Edit webhook"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
            title="Delete webhook"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Event badges */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {webhook.events.map((event) => (
            <span
              key={event}
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                EVENT_COLORS[event] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {EVENT_LABELS[event] || event}
            </span>
          ))}
        </div>
      </div>

      {/* Secret section */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Signing Secret</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {(showSecret && secret) && (
              <button
                onClick={() => copyToClipboard(secret)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Copy secret"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleRotateSecret}
              disabled={isRotating}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              title="Rotate secret"
            >
              <RotateCcw className={`h-4 w-4 ${isRotating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="font-mono text-sm text-gray-600">
          {showSecret && secret ? secret : '••••••••••••••••••••••••••••••••'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-center">
        <div>
          <div className="text-lg font-semibold text-green-600">
            {webhook.successCount}
          </div>
          <div className="text-xs text-gray-500">Successful</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-red-600">
            {webhook.failureCount}
          </div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
        <div>
          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(webhook.lastTriggeredAt)}
          </div>
          <div className="text-xs text-gray-500">Last triggered</div>
        </div>
      </div>

      {/* Test section */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={isTesting || !webhook.enabled}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isTesting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Testing...
            </>
          ) : (
            <>
              <TestTube className="h-4 w-4" />
              Test Endpoint
            </>
          )}
        </button>

        {testResult && (
          <div className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${
            testResult.success 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {testResult.success ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Success
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Failed
              </>
            )}
          </div>
        )}
      </div>

      {testResult && !testResult.success && testResult.error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {testResult.error}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Webhook</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this webhook endpoint? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}