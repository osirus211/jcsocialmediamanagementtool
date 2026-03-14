import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Copy, ExternalLink, Eye, EyeOff, Palette, User, Settings, Send, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { clientPortalService, CreatePortalInput } from '@/services/client-portal.service';
import { usePostStore } from '@/store/post.store';
import { PostStatus } from '@/types/post.types';

interface CreatePortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'client-info' | 'branding' | 'posts' | 'settings' | 'share';

interface FormData {
  name: string;
  clientEmail: string;
  clientName: string;
  clientCompany: string;
  postIds: string[];
  branding: {
    companyName: string;
    logo: string;
    primaryColor: string;
    accentColor: string;
    customMessage: string;
  };
  allowedActions: {
    view: boolean;
    approve: boolean;
    reject: boolean;
    comment: boolean;
  };
  expiresInDays: number;
  passwordProtected: boolean;
  password: string;
  notifyOnAction: boolean;
}

const STEPS: { key: Step; title: string; description: string }[] = [
  { key: 'client-info', title: 'Client Info', description: 'Basic client information' },
  { key: 'branding', title: 'Branding', description: 'Customize portal appearance' },
  { key: 'posts', title: 'Posts', description: 'Select posts for review' },
  { key: 'settings', title: 'Settings', description: 'Portal configuration' },
  { key: 'share', title: 'Share', description: 'Portal link and invitation' },
];

export const CreatePortalModal: React.FC<CreatePortalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('client-info');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { posts, fetchPosts } = usePostStore();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    clientEmail: '',
    clientName: '',
    clientCompany: '',
    postIds: [],
    branding: {
      companyName: '',
      logo: '',
      primaryColor: '#3B82F6',
      accentColor: '#10B981',
      customMessage: '',
    },
    allowedActions: {
      view: true,
      approve: true,
      reject: true,
      comment: true,
    },
    expiresInDays: 7,
    passwordProtected: false,
    password: '',
    notifyOnAction: true,
  });

  useEffect(() => {
    if (isOpen) {
      fetchPosts();
      // Reset form when modal opens
      setCurrentStep('client-info');
      setError(null);
      setPortalUrl('');
      setFormData({
        name: '',
        clientEmail: '',
        clientName: '',
        clientCompany: '',
        postIds: [],
        branding: {
          companyName: '',
          logo: '',
          primaryColor: '#3B82F6',
          accentColor: '#10B981',
          customMessage: '',
        },
        allowedActions: {
          view: true,
          approve: true,
          reject: true,
          comment: true,
        },
        expiresInDays: 7,
        passwordProtected: false,
        password: '',
        notifyOnAction: true,
      });
    }
  }, [isOpen, fetchPosts]);

  const handleNext = () => {
    const currentIndex = STEPS.findIndex(step => step.key === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].key);
    }
  };

  const handlePrevious = () => {
    const currentIndex = STEPS.findIndex(step => step.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].key);
    }
  };

  const handleSubmit = async () => {
    if (currentStep !== 'settings') return;

    try {
      setIsLoading(true);
      setError(null);

      const input: CreatePortalInput = {
        name: formData.name,
        clientEmail: formData.clientEmail,
        clientName: formData.clientName,
        clientCompany: formData.clientCompany || undefined,
        postIds: formData.postIds,
        branding: formData.branding.companyName ? formData.branding : undefined,
        allowedActions: formData.allowedActions,
        expiresInDays: formData.expiresInDays,
        passwordProtected: formData.passwordProtected,
        password: formData.passwordProtected ? formData.password : undefined,
        notifyOnAction: formData.notifyOnAction,
      };

      const response = await clientPortalService.createPortal(input);
      setPortalUrl(response.portalUrl);
      setCurrentStep('share');
    } catch (err: any) {
      setError(err.message || 'Failed to create portal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 'client-info':
        return formData.name && formData.clientEmail && formData.clientName;
      case 'branding':
        return true; // Optional step
      case 'posts':
        return formData.postIds.length > 0;
      case 'settings':
        return !formData.passwordProtected || formData.password.length >= 6;
      case 'share':
        return true;
      default:
        return false;
    }
  };

  const availablePosts = posts.filter(post => 
    post.status === PostStatus.SCHEDULED || 
    post.status === PostStatus.DRAFT
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Client Portal</h2>
            <p className="text-sm text-gray-600 mt-1">
              {STEPS.find(step => step.key === currentStep)?.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isActive = step.key === currentStep;
              const isCompleted = STEPS.findIndex(s => s.key === currentStep) > index;
              const isLast = index === STEPS.length - 1;

              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    isCompleted 
                      ? 'bg-green-500 text-white' 
                      : isActive 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                  {!isLast && (
                    <div className={`w-8 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Client Info */}
          {currentStep === 'client-info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Portal Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., March Campaign Review"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Email *
                  </label>
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                    placeholder="client@company.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="John Smith"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.clientCompany}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientCompany: e.target.value }))}
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Branding */}
          {currentStep === 'branding' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name for Portal
                  </label>
                  <input
                    type="text"
                    value={formData.branding.companyName}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      branding: { ...prev.branding, companyName: e.target.value }
                    }))}
                    placeholder="Your Agency Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={formData.branding.logo}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      branding: { ...prev.branding, logo: e.target.value }
                    }))}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={formData.branding.primaryColor}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        branding: { ...prev.branding, primaryColor: e.target.value }
                      }))}
                      className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.branding.primaryColor}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        branding: { ...prev.branding, primaryColor: e.target.value }
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Accent Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={formData.branding.accentColor}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        branding: { ...prev.branding, accentColor: e.target.value }
                      }))}
                      className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.branding.accentColor}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        branding: { ...prev.branding, accentColor: e.target.value }
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Welcome Message
                </label>
                <textarea
                  value={formData.branding.customMessage}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    branding: { ...prev.branding, customMessage: e.target.value }
                  }))}
                  placeholder="Welcome! Please review and approve the content below..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Step 3: Posts */}
          {currentStep === 'posts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Select Posts for Review</h3>
                <span className="text-sm text-gray-600">
                  {formData.postIds.length} selected
                </span>
              </div>

              {availablePosts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No posts available for review.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Create some scheduled or draft posts first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {availablePosts.map((post) => (
                    <div
                      key={post._id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        formData.postIds.includes(post._id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          postIds: prev.postIds.includes(post._id)
                            ? prev.postIds.filter(id => id !== post._id)
                            : [...prev.postIds, post._id]
                        }));
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.postIds.includes(post._id)}
                          onChange={() => {}} // Handled by parent click
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {post.content.substring(0, 100)}...
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {post.socialAccountId?.platform} • {post.status}
                          </p>
                          {post.scheduledAt && (
                            <p className="text-xs text-gray-500">
                              Scheduled: {new Date(post.scheduledAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Settings */}
          {currentStep === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expires In (Days)
                  </label>
                  <select
                    value={formData.expiresInDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Allowed Actions
                  </label>
                  <div className="space-y-2">
                    {Object.entries(formData.allowedActions).map(([action, enabled]) => (
                      <label key={action} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            allowedActions: {
                              ...prev.allowedActions,
                              [action]: e.target.checked
                            }
                          }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 capitalize">
                          {action === 'view' ? 'View Posts' : 
                           action === 'approve' ? 'Approve Posts' :
                           action === 'reject' ? 'Reject Posts' :
                           'Add Comments'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.passwordProtected}
                    onChange={(e) => setFormData(prev => ({ ...prev, passwordProtected: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Password Protection</span>
                </label>

                {formData.passwordProtected && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Portal Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter password (min 6 characters)"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notifyOnAction}
                    onChange={(e) => setFormData(prev => ({ ...prev, notifyOnAction: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Notify me when client takes action
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Step 5: Share */}
          {currentStep === 'share' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Portal Created Successfully!</h3>
                <p className="text-gray-600">
                  Your client portal is ready. Share the link below with your client.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Portal URL
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={portalUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => copyToClipboard(portalUrl)}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => copyToClipboard(portalUrl)}
                  className="flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </button>
                <button
                  onClick={() => {
                    const subject = encodeURIComponent(`Review Required: ${formData.name}`);
                    const body = encodeURIComponent(`Hi ${formData.clientName},\n\nPlease review and approve the content at: ${portalUrl}\n\nThanks!`);
                    window.open(`mailto:${formData.clientEmail}?subject=${subject}&body=${body}`);
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={currentStep === 'client-info' ? onClose : handlePrevious}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {currentStep === 'client-info' ? 'Cancel' : 'Previous'}
          </button>

          <div className="flex items-center space-x-3">
            {currentStep === 'share' ? (
              <button
                onClick={handleFinish}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4 mr-2" />
                Done
              </button>
            ) : currentStep === 'settings' ? (
              <button
                onClick={handleSubmit}
                disabled={!isStepValid() || isLoading}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Portal
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};