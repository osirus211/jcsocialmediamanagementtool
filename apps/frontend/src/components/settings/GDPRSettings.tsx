/**
 * GDPR Settings Component
 * 
 * Provides GDPR compliance features for users
 */

import { useState, useEffect } from 'react';
import { 
  Shield, 
  Download, 
  Eye, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  Trash2,
} from 'lucide-react';
import { GDPRService, type GDPRRequest, type DataSummary, type ConsentPreferences } from '@/services/gdpr.service';
import { toast } from '@/lib/notifications';

export function GDPRSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [gdprRequests, setGdprRequests] = useState<GDPRRequest[]>([]);
  const [consentPreferences, setConsentPreferences] = useState<ConsentPreferences>({
    marketingEmails: false,
    analyticsTracking: false,
    functionalCookies: true,
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'consent'>('overview');

  useEffect(() => {
    loadGDPRData();
  }, []);

  const loadGDPRData = async () => {
    try {
      setIsLoading(true);
      const [summary, requests] = await Promise.all([
        GDPRService.getDataSummary(),
        GDPRService.getGDPRRequests(),
      ]);
      
      setDataSummary(summary);
      setGdprRequests(requests.requests);
    } catch (error: any) {
      console.error('Failed to load GDPR data:', error);
      toast.error('Failed to load GDPR information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      setIsLoading(true);
      await GDPRService.downloadExportedData(format);
      toast.success(`Data exported as ${format.toUpperCase()}`);
      loadGDPRData(); // Refresh to show new request
    } catch (error: any) {
      toast.error(`Failed to export data: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConsent = async () => {
    try {
      setIsLoading(true);
      await GDPRService.updateConsent(consentPreferences);
      toast.success('Consent preferences updated');
      loadGDPRData(); // Refresh to show new request
    } catch (error: any) {
      toast.error(`Failed to update consent: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'data_export':
        return 'Data Export';
      case 'data_deletion':
        return 'Account Deletion';
      case 'data_access':
        return 'Data Access';
      case 'data_rectification':
        return 'Data Correction';
      case 'consent_withdrawal':
        return 'Consent Update';
      default:
        return type;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Data Overview', icon: Eye },
    { id: 'requests', label: 'My Requests', icon: FileText },
    { id: 'consent', label: 'Consent Settings', icon: Settings },
  ];

  if (isLoading && !dataSummary) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GDPR information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Data Protection & Privacy</h1>
        </div>
        <p className="text-gray-600">
          Manage your data, privacy settings, and exercise your GDPR rights
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Data Overview Tab */}
        {activeTab === 'overview' && dataSummary && (
          <div className="space-y-6">
            {/* Account Summary */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Account Data</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Account Created</p>
                  <p className="font-semibold text-blue-900">
                    {new Date(dataSummary.user.accountCreated).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Email Verified</p>
                  <p className="font-semibold text-green-900">
                    {dataSummary.user.emailVerified ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600">2FA Enabled</p>
                  <p className="font-semibold text-purple-900">
                    {dataSummary.user.twoFactorEnabled ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Data Counts */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{dataSummary.dataCounts.workspaces}</p>
                  <p className="text-sm text-gray-600">Workspaces</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{dataSummary.dataCounts.posts}</p>
                  <p className="text-sm text-gray-600">Posts</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{dataSummary.dataCounts.socialAccounts}</p>
                  <p className="text-sm text-gray-600">Social Accounts</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{dataSummary.dataCounts.analytics}</p>
                  <p className="text-sm text-gray-600">Analytics Records</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{dataSummary.dataCounts.loginHistory}</p>
                  <p className="text-sm text-gray-600">Login Records</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{dataSummary.dataCounts.auditLogs}</p>
                  <p className="text-sm text-gray-600">Audit Logs</p>
                </div>
              </div>
            </div>

            {/* Export Data */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Your Data
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Download all your personal data in a structured format. This includes your profile, posts, 
                analytics, and all other information we have about you.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleExportData('json')}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExportData('csv')}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export as CSV
                </button>
              </div>
            </div>

            {/* Your Rights */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Data Rights</h2>
              <div className="space-y-3">
                {Object.entries(dataSummary.yourRights).map(([right, description]) => (
                  <div key={right} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {right.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-sm text-gray-600">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Retention Policy */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Retention Policy</h2>
              <div className="space-y-3">
                {Object.entries(dataSummary.dataRetentionPolicy).map(([dataType, policy]) => (
                  <div key={dataType} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="font-medium text-gray-900 capitalize">
                      {dataType.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-sm text-gray-600">{policy}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">GDPR Request History</h2>
              {gdprRequests.length > 0 ? (
                <div className="space-y-3">
                  {gdprRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <p className="font-medium text-gray-900">
                            {getRequestTypeLabel(request.type)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Requested on {new Date(request.requestedAt).toLocaleDateString()}
                          </p>
                          {request.processingNotes && (
                            <p className="text-xs text-gray-500 mt-1">{request.processingNotes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.status === 'completed' ? 'bg-green-100 text-green-800' :
                          request.status === 'failed' ? 'bg-red-100 text-red-800' :
                          request.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {request.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {request.retentionUntil && (
                          <p className="text-xs text-gray-500 mt-1">
                            Deletion: {new Date(request.retentionUntil).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No GDPR requests found</p>
                  <p className="text-sm text-gray-500">Your data export and deletion requests will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Consent Tab */}
        {activeTab === 'consent' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Consent Preferences</h2>
              <p className="text-sm text-gray-600 mb-6">
                Control how we use your data. You can change these settings at any time.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Marketing Emails</h3>
                    <p className="text-sm text-gray-600">Receive promotional emails and product updates</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPreferences.marketingEmails}
                      onChange={(e) => setConsentPreferences(prev => ({ ...prev, marketingEmails: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Analytics Tracking</h3>
                    <p className="text-sm text-gray-600">Help us improve our service with usage analytics</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPreferences.analyticsTracking}
                      onChange={(e) => setConsentPreferences(prev => ({ ...prev, analyticsTracking: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div>
                    <h3 className="font-medium text-gray-900">Functional Cookies</h3>
                    <p className="text-sm text-gray-600">Required for the app to work properly (cannot be disabled)</p>
                  </div>
                  <div className="w-11 h-6 bg-green-500 rounded-full relative">
                    <div className="absolute top-[2px] right-[2px] bg-white border border-gray-300 rounded-full h-5 w-5"></div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleUpdateConsent}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Settings className="w-4 h-4" />
                  {isLoading ? 'Updating...' : 'Update Preferences'}
                </button>
              </div>
            </div>

            {/* GDPR Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-900">GDPR Compliance</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    We process your data in accordance with the General Data Protection Regulation (GDPR). 
                    You have the right to access, rectify, erase, restrict, and port your data at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}