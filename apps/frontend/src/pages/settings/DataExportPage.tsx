/**
 * Data Export Page
 * 
 * Dedicated page for GDPR data export with advanced features
 */

import { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Mail,
  Database,
  Calendar,
  BarChart3,
  Users,
  CreditCard,
  Activity,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GDPRService, type GDPRRequest } from '@/services/gdpr.service';
import { toast } from '@/lib/notifications';

interface ExportCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  included: boolean;
  estimatedSize: string;
}

export function DataExportPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [exportRequests, setExportRequests] = useState<GDPRRequest[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv'>('json');
  const [emailNotification, setEmailNotification] = useState(true);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [categories, setCategories] = useState<ExportCategory[]>([
    {
      id: 'profile',
      label: 'Profile & Account',
      description: 'Personal information, settings, and account details',
      icon: Users,
      included: true,
      estimatedSize: '< 1 MB',
    },
    {
      id: 'posts',
      label: 'Posts & Content',
      description: 'All your posts, drafts, and scheduled content',
      icon: FileText,
      included: true,
      estimatedSize: '5-50 MB',
    },
    {
      id: 'analytics',
      label: 'Analytics Data',
      description: 'Performance metrics and engagement statistics',
      icon: BarChart3,
      included: true,
      estimatedSize: '1-10 MB',
    },
    {
      id: 'social-accounts',
      label: 'Connected Accounts',
      description: 'Social media accounts and connection details',
      icon: Shield,
      included: true,
      estimatedSize: '< 1 MB',
    },
    {
      id: 'workspaces',
      label: 'Workspace Data',
      description: 'Team workspaces, roles, and collaboration data',
      icon: Database,
      included: true,
      estimatedSize: '1-5 MB',
    },
    {
      id: 'billing',
      label: 'Billing History',
      description: 'Payment history, invoices, and subscription data',
      icon: CreditCard,
      included: true,
      estimatedSize: '< 1 MB',
    },
    {
      id: 'activity',
      label: 'Activity Logs',
      description: 'Login history and account activity records',
      icon: Activity,
      included: false,
      estimatedSize: '1-5 MB',
    },
  ]);

  useEffect(() => {
    loadExportHistory();
  }, []);

  const loadExportHistory = async () => {
    try {
      const response = await GDPRService.getGDPRRequests();
      const exportRequests = response.requests.filter(req => req.type === 'data_export');
      setExportRequests(exportRequests);
    } catch (error: any) {
      console.error('Failed to load export history:', error);
      toast.error('Failed to load export history');
    }
  };

  const toggleCategory = (categoryId: string) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, included: !cat.included } : cat
    ));
  };

  const handleExportData = async () => {
    const selectedCategories = categories.filter(cat => cat.included);
    
    if (selectedCategories.length === 0) {
      toast.error('Please select at least one data category to export');
      return;
    }

    try {
      setIsLoading(true);
      setExportProgress(0);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev === null) return 10;
          if (prev >= 90) return prev;
          return prev + Math.random() * 20;
        });
      }, 500);

      await GDPRService.downloadExportedData(selectedFormat);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      setTimeout(() => {
        setExportProgress(null);
        toast.success(`Data exported successfully as ${selectedFormat.toUpperCase()}`);
        loadExportHistory(); // Refresh to show new request
      }, 1000);

    } catch (error: any) {
      setExportProgress(null);
      toast.error(`Failed to export data: ${error.response?.data?.message || error.message}`);
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
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTotalEstimatedSize = () => {
    const selectedCategories = categories.filter(cat => cat.included);
    if (selectedCategories.length === 0) return '0 MB';
    
    // Simple estimation logic
    const hasLargeData = selectedCategories.some(cat => 
      cat.id === 'posts' || cat.id === 'analytics'
    );
    
    if (hasLargeData) {
      return '10-100 MB';
    } else {
      return '1-10 MB';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/settings/account" 
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Account Settings
        </Link>
        
        <div className="flex items-center gap-3 mb-2">
          <Download className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Export Your Data</h1>
        </div>
        <p className="text-gray-600">
          Download your personal data in a structured format. Choose what to include and how to receive it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Data Categories */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Data Categories</h2>
            <p className="text-sm text-gray-600 mb-6">
              Choose which types of data to include in your export. You can select all or specific categories.
            </p>
            
            <div className="space-y-3">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <div 
                    key={category.id}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      category.included 
                        ? 'border-blue-200 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={category.included}
                        onChange={() => toggleCategory(category.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Icon className={`w-5 h-5 ${category.included ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <h3 className="font-medium text-gray-900">{category.label}</h3>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{category.estimatedSize}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Format */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h2>
            <div className="grid grid-cols-2 gap-4">
              <div 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedFormat === 'json' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedFormat('json')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    checked={selectedFormat === 'json'}
                    onChange={() => setSelectedFormat('json')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="font-medium">JSON</span>
                </div>
                <p className="text-sm text-gray-600">
                  Machine-readable format, preserves data structure and relationships
                </p>
              </div>
              
              <div 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedFormat === 'csv' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedFormat('csv')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    checked={selectedFormat === 'csv'}
                    onChange={() => setSelectedFormat('csv')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="font-medium">CSV</span>
                </div>
                <p className="text-sm text-gray-600">
                  Spreadsheet format, easy to open in Excel or Google Sheets
                </p>
              </div>
            </div>
          </div>

          {/* Notification Options */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Options</h2>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <h3 className="font-medium text-gray-900">Email Notification</h3>
                  <p className="text-sm text-gray-600">Get notified when your export is ready for download</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotification}
                  onChange={(e) => setEmailNotification(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Export Summary & Action */}
        <div className="space-y-6">
          {/* Export Summary */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Selected Categories:</span>
                <span className="font-medium">{categories.filter(cat => cat.included).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Format:</span>
                <span className="font-medium uppercase">{selectedFormat}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Estimated Size:</span>
                <span className="font-medium">{getTotalEstimatedSize()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Email Notification:</span>
                <span className="font-medium">{emailNotification ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Export Progress */}
          {exportProgress !== null && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-medium text-gray-900 mb-3">Export Progress</h3>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">{Math.round(exportProgress)}% complete</p>
            </div>
          )}

          {/* Export Action */}
          <div className="bg-white rounded-lg border p-6">
            <button
              onClick={handleExportData}
              disabled={isLoading || categories.filter(cat => cat.included).length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {isLoading ? 'Preparing Export...' : 'Start Export'}
            </button>
            
            <p className="text-xs text-gray-500 mt-3 text-center">
              Export will be available for download immediately and via email if enabled
            </p>
          </div>

          {/* GDPR Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-900 text-sm">Your Data Rights</h3>
                <p className="text-xs text-blue-800 mt-1">
                  Under GDPR, you have the right to receive your personal data in a structured, 
                  commonly used format. This export includes all data we have about you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export History */}
      <div className="mt-12">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Export History</h2>
          {exportRequests.length > 0 ? (
            <div className="space-y-3">
              {exportRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(request.status)}
                    <div>
                      <p className="font-medium text-gray-900">
                        Data Export Request
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
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                      {request.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {request.completedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Completed: {new Date(request.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {exportRequests.length > 5 && (
                <div className="text-center pt-4">
                  <Link 
                    to="/settings/account#gdpr" 
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View all export requests →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No export requests found</p>
              <p className="text-sm text-gray-500">Your data export requests will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}