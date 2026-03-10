import React, { useState, useEffect } from 'react';
import { Save, Eye, Palette, Image, Globe, Lock, MessageSquare } from 'lucide-react';
import { clientPortalService, ClientPortalBranding, UpdateBrandingInput } from '@/services/client-portal.service';

interface BrandingSettingsProps {
  onSave?: () => void;
}

export const BrandingSettings: React.FC<BrandingSettingsProps> = ({ onSave }) => {
  const [branding, setBranding] = useState<ClientPortalBranding>({
    enabled: false,
    brandName: '',
    logoUrl: '',
    primaryColor: '#6366f1',
    customDomain: '',
    welcomeMessage: '',
    requirePassword: false,
  });
  const [formData, setFormData] = useState<UpdateBrandingInput>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      setIsLoading(true);
      const response = await clientPortalService.getBranding();
      setBranding(response.branding);
      setFormData(response.branding);
    } catch (err: any) {
      setError(err.message || 'Failed to load branding settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      const response = await clientPortalService.updateBranding(formData);
      setBranding(response.branding);
      onSave?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save branding settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof UpdateBrandingInput, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const previewStyle = {
    '--primary-color': formData.primaryColor || branding.primaryColor || '#6366f1',
  } as React.CSSProperties;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Client Portal</h3>
            <p className="text-gray-600 mt-1">
              Enable white-label client review portal for your workspace
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled ?? branding.enabled}
              onChange={(e) => handleInputChange('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Branding Settings */}
      {(formData.enabled ?? branding.enabled) && (
        <>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Palette className="w-5 h-5 mr-2" />
              Branding
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Brand Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={formData.brandName ?? branding.brandName ?? ''}
                  onChange={(e) => handleInputChange('brandName', e.target.value)}
                  placeholder="Your Company Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={formData.primaryColor ?? branding.primaryColor ?? '#6366f1'}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor ?? branding.primaryColor ?? '#6366f1'}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    placeholder="#6366f1"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </div>

              {/* Logo URL */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Image className="w-4 h-4 mr-1" />
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formData.logoUrl ?? branding.logoUrl ?? ''}
                  onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={500}
                />
              </div>

              {/* Custom Domain */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Globe className="w-4 h-4 mr-1" />
                  Custom Domain (Optional)
                </label>
                <input
                  type="text"
                  value={formData.customDomain ?? branding.customDomain ?? ''}
                  onChange={(e) => handleInputChange('customDomain', e.target.value)}
                  placeholder="reviews.yourcompany.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Configure your DNS to point to our servers for custom domain support
                </p>
              </div>

              {/* Welcome Message */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Welcome Message
                </label>
                <textarea
                  value={formData.welcomeMessage ?? branding.welcomeMessage ?? ''}
                  onChange={(e) => handleInputChange('welcomeMessage', e.target.value)}
                  placeholder="Please review the following posts and provide your feedback."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  maxLength={500}
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {(formData.welcomeMessage ?? branding.welcomeMessage ?? '').length}/500
                </div>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Lock className="w-5 h-5 mr-2" />
              Security
            </h3>

            <div className="space-y-4">
              {/* Require Password */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Require Password
                  </label>
                  <p className="text-xs text-gray-500">
                    Clients will need to enter a password to access reviews
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requirePassword ?? branding.requirePassword}
                    onChange={(e) => {
                      handleInputChange('requirePassword', e.target.checked);
                      if (e.target.checked) {
                        setShowPassword(true);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Portal Password */}
              {(formData.requirePassword ?? branding.requirePassword) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Portal Password
                  </label>
                  <input
                    type="password"
                    value={formData.portalPassword ?? ''}
                    onChange={(e) => handleInputChange('portalPassword', e.target.value)}
                    placeholder="Enter a secure password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum 6 characters. Leave empty to keep current password.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Preview
            </h3>

            <div className="border border-gray-200 rounded-lg overflow-hidden" style={previewStyle}>
              {/* Preview Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center space-x-3">
                  {(formData.logoUrl ?? branding.logoUrl) && (
                    <img
                      src={formData.logoUrl ?? branding.logoUrl}
                      alt="Logo"
                      className="h-8 w-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {formData.brandName ?? branding.brandName ?? 'Your Brand'}
                    </h4>
                    <p className="text-sm text-gray-600">Sample Review</p>
                  </div>
                </div>
              </div>

              {/* Preview Content */}
              <div className="p-4 bg-gray-50">
                <div className="bg-white rounded-lg p-4 mb-4">
                  <p className="text-gray-700">
                    {formData.welcomeMessage ?? branding.welcomeMessage ?? 'Please review the following posts and provide your feedback.'}
                  </p>
                </div>

                <button
                  className="px-4 py-2 text-white rounded-lg transition-colors"
                  style={{ backgroundColor: formData.primaryColor ?? branding.primaryColor ?? '#6366f1' }}
                >
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};