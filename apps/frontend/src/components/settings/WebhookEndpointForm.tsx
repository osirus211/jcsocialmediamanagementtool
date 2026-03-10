import { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { WebhookEndpoint, webhooksService } from '@/services/webhooks.service';

interface WebhookEndpointFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  webhook?: WebhookEndpoint;
}

const WEBHOOK_EVENTS = [
  {
    value: 'post.published',
    label: 'Post Published',
    description: 'When a post is successfully published',
  },
  {
    value: 'post.failed',
    label: 'Post Failed',
    description: 'When a post fails to publish',
  },
  {
    value: 'analytics.updated',
    label: 'Analytics Updated',
    description: 'When post analytics are refreshed',
  },
  {
    value: 'follower.milestone',
    label: 'Follower Milestone',
    description: 'When you hit a follower milestone',
  },
  {
    value: 'engagement.spike',
    label: 'Engagement Spike',
    description: 'When engagement spikes 2x above average',
  },
  {
    value: 'report.generated',
    label: 'Report Generated',
    description: 'When a scheduled report is sent',
  },
  {
    value: 'competitor.updated',
    label: 'Competitor Updated',
    description: 'When competitor data is refreshed',
  },
];

export function WebhookEndpointForm({ isOpen, onClose, onSuccess, webhook }: WebhookEndpointFormProps) {
  const [url, setUrl] = useState(webhook?.url || '');
  const [description, setDescription] = useState(webhook?.description || '');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(webhook?.events || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!webhook;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate URL
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    if (!url.startsWith('https://')) {
      setError('URL must use HTTPS');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Invalid URL format');
      return;
    }

    // Validate events
    if (selectedEvents.length === 0) {
      setError('At least one event must be selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing) {
        await webhooksService.updateEndpoint(webhook._id, {
          url: url.trim(),
          events: selectedEvents,
          description: description.trim() || undefined,
        });
      } else {
        await webhooksService.createEndpoint(
          url.trim(),
          selectedEvents,
          description.trim() || undefined
        );
      }

      onSuccess();
      onClose();
      
      // Reset form if creating new
      if (!isEditing) {
        setUrl('');
        setDescription('');
        setSelectedEvents([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook endpoint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    
    // Reset form
    setUrl(webhook?.url || '');
    setDescription(webhook?.description || '');
    setSelectedEvents(webhook?.events || []);
    setError(null);
    
    onClose();
  };

  const toggleEvent = (eventValue: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventValue)
        ? prev.filter(e => e !== eventValue)
        : [...prev, eventValue]
    );
  };

  const selectAll = () => {
    setSelectedEvents(WEBHOOK_EVENTS.map(e => e.value));
  };

  const deselectAll = () => {
    setSelectedEvents([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Webhook' : 'Add Webhook Endpoint'}
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Must use HTTPS for security
              </p>
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Production webhook for notifications"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Events Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Events <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={isSubmitting}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Select all
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    disabled={isSubmitting}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {WEBHOOK_EVENTS.map((event) => (
                  <label
                    key={event.value}
                    className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event.value)}
                      onChange={() => toggleEvent(event.value)}
                      disabled={isSubmitting}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">
                        {event.label}
                      </div>
                      <div className="text-xs text-gray-600">
                        {event.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              
              <p className="mt-2 text-xs text-gray-500">
                Selected: {selectedEvents.length} of {WEBHOOK_EVENTS.length} events
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedEvents.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {isEditing ? 'Update Webhook' : 'Save Webhook'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}