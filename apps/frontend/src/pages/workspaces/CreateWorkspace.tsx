import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';

/**
 * Create Workspace Page
 * 
 * Features:
 * - Workspace name input
 * - Auto-generate slug from name
 * - Timezone selection
 * - Industry selection
 * - Validation
 * - Loading states
 * - Success feedback
 * - Auto-switch after creation
 */
export const CreateWorkspacePage = () => {
  const navigate = useNavigate();
  const { createWorkspace, isLoading } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  const industryOptions = [
    { value: '', label: 'Select Industry (Optional)' },
    { value: 'marketing-agency', label: 'Marketing Agency' },
    { value: 'e-commerce', label: 'E-commerce' },
    { value: 'saas', label: 'SaaS' },
    { value: 'media', label: 'Media' },
    { value: 'non-profit', label: 'Non-profit' },
    { value: 'education', label: 'Education' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'other', label: 'Other' },
  ];

  const timezoneOptions = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  ];

  const handleNameChange = (value: string) => {
    setName(value);
    setError('');

    // Auto-generate slug if not manually edited
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(generateSlug(value));
    setSlugManuallyEdited(true);
    setError('');
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Workspace name is required');
      return false;
    }

    if (name.trim().length < 3) {
      setError('Workspace name must be at least 3 characters');
      return false;
    }

    if (!slug.trim()) {
      setError('Workspace slug is required');
      return false;
    }

    if (slug.trim().length < 3) {
      setError('Workspace slug must be at least 3 characters');
      return false;
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Workspace slug can only contain lowercase letters, numbers, and hyphens');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await createWorkspace({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        timezone: timezone || 'UTC',
        industry: industry || undefined,
      });

      // Navigate to dashboard (workspace will be auto-switched)
      navigate('/');
    } catch (error: any) {
      console.error('Failed to create workspace:', error);
      setError(
        error.response?.data?.message ||
        error.message ||
        'Failed to create workspace. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Workspace
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Set up a new workspace for your team
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            )}

            {/* Workspace Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Workspace Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Acme Inc"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                disabled={isLoading}
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                The name of your workspace (can be changed later)
              </p>
            </div>

            {/* Workspace Slug */}
            <div>
              <label
                htmlFor="slug"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Workspace Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  @
                </span>
                <input
                  type="text"
                  id="slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="e.g., acme-inc"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  disabled={isLoading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Unique identifier for your workspace (lowercase, numbers, hyphens only)
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your workspace..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {description.length}/500 characters
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isLoading}
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used for scheduling and analytics
              </p>
            </div>

            {/* Industry */}
            <div>
              <label
                htmlFor="industry"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Industry
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isLoading}
              >
                {industryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Helps us provide relevant features and insights
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  'Create Workspace'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/workspaces')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all workspaces
          </button>
        </div>
      </div>
    </div>
  );
};
