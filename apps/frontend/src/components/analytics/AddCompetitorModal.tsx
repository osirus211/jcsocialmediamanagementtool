import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { competitorService } from '@/services/competitor.service';

interface AddCompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter', icon: '🐦' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'youtube', label: 'YouTube', icon: '📺' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
];

export function AddCompetitorModal({ isOpen, onClose, onSuccess }: AddCompetitorModalProps) {
  const [platform, setPlatform] = useState('twitter');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate handle
    const cleanHandle = handle.trim();
    if (!cleanHandle) {
      setError('Handle is required');
      return;
    }

    // Ensure handle starts with @
    const formattedHandle = cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`;

    // Validate handle format (no spaces, valid characters)
    if (!/^@[a-zA-Z0-9_.-]+$/.test(formattedHandle)) {
      setError('Handle must contain only letters, numbers, underscores, dots, and hyphens');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await competitorService.addCompetitor(
        platform,
        formattedHandle,
        displayName.trim() || undefined
      );

      // Reset form
      setPlatform('twitter');
      setHandle('');
      setDisplayName('');
      
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('This competitor is already being tracked');
      } else if (err.response?.status === 404) {
        setError('Handle not found on this platform');
      } else {
        setError('Failed to add competitor. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    
    // Reset form
    setPlatform('twitter');
    setHandle('');
    setDisplayName('');
    setError(null);
    
    onClose();
  };

  const handleHandleChange = (value: string) => {
    setError(null);
    setHandle(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Add Competitor</h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Platform Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.icon} {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Handle Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Handle <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => handleHandleChange(e.target.value)}
                  placeholder="username"
                  disabled={isSubmitting}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  required
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  @
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter the username without the @ symbol
              </p>
            </div>

            {/* Display Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Company or person name"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500">
                A friendly name to display instead of the handle
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
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
                disabled={isSubmitting || !handle.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Competitor
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