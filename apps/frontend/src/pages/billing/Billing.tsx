/**
 * Billing Page
 * Manage subscription, view usage, and billing details
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBillingStore } from '../../store/billing.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { billingService } from '../../services/billing.service';
import { 
  CreditCard, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Users,
  Zap,
  Share2,
  ExternalLink
} from 'lucide-react';
import UsageMeter from '../../components/billing/UsageMeter';

export default function Billing() {
  const navigate = useNavigate();
  const {
    currentSubscription,
    usage,
    fetchSubscription,
    fetchUsage,
    cancelSubscription,
    reactivateSubscription,
    isLoading,
  } = useBillingStore();
  const { currentWorkspace } = useWorkspaceStore();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      fetchSubscription();
      fetchUsage();
    }
  }, [currentWorkspace]);

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await cancelSubscription();
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Cancel error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setActionLoading(true);
      await reactivateSubscription();
    } catch (error) {
      console.error('Reactivate error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setPortalLoading(true);
      const { url } = await billingService.createPortal();
      window.location.href = url;
    } catch (error: any) {
      console.error('Portal error:', error);
      alert(error.message || 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!currentSubscription) return null;

    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Active' },
      trialing: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, text: 'Trial' },
      past_due: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Past Due' },
      canceled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, text: 'Canceled' },
      incomplete: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, text: 'Incomplete' },
    };

    const config = statusConfig[currentSubscription.status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="h-4 w-4 mr-1" />
        {config.text}
      </span>
    );
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading && !currentSubscription) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Usage</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your subscription and monitor your usage
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Subscription Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Current Plan
              </h2>
              {getStatusBadge()}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentSubscription?.plan.displayName || 'Free'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {currentSubscription?.plan.description}
                </p>
              </div>

              {currentSubscription?.currentPeriodEnd && (
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="h-4 w-4 mr-2" />
                  {currentSubscription.cancelAtPeriodEnd ? (
                    <span>
                      Cancels on {formatDate(currentSubscription.currentPeriodEnd)}
                    </span>
                  ) : (
                    <span>
                      Renews on {formatDate(currentSubscription.currentPeriodEnd)}
                    </span>
                  )}
                </div>
              )}

              {currentSubscription?.trialEnd && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Trial ends on {formatDate(currentSubscription.trialEnd)}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/pricing')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {currentSubscription?.plan.name === 'free' ? 'Upgrade Plan' : 'Change Plan'}
              </button>

              {currentSubscription?.plan.name !== 'free' && (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {portalLoading ? 'Loading...' : 'Manage Billing'}
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}

              {currentSubscription?.status === 'active' &&
                currentSubscription.plan.name !== 'free' &&
                !currentSubscription.cancelAtPeriodEnd && (
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors"
                  >
                    Cancel Subscription
                  </button>
                )}

              {currentSubscription?.cancelAtPeriodEnd && (
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Loading...' : 'Reactivate Subscription'}
                </button>
              )}
            </div>

            {/* Warning Messages */}
            {currentSubscription?.status === 'past_due' && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Payment Failed
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Your last payment failed. Please update your payment method to continue using premium features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentSubscription?.cancelAtPeriodEnd && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Subscription Ending
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Your subscription will end on {formatDate(currentSubscription.currentPeriodEnd)}. You'll be moved to the Free plan.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Usage Card */}
          {usage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Usage This Month
              </h2>

              <div className="space-y-6">
                <UsageMeter
                  icon={TrendingUp}
                  label="Posts Created"
                  current={usage.usage.postsThisMonth}
                  limit={usage.limits.maxPostsPerMonth}
                  color="blue"
                />

                <UsageMeter
                  icon={Zap}
                  label="AI Credits Used"
                  current={usage.usage.aiCreditsUsed}
                  limit={usage.limits.aiCreditsPerMonth}
                  color="purple"
                />

                <UsageMeter
                  icon={Share2}
                  label="Social Accounts"
                  current={usage.usage.socialAccounts}
                  limit={usage.limits.maxSocialAccounts}
                  color="green"
                />

                <UsageMeter
                  icon={Users}
                  label="Team Members"
                  current={usage.usage.teamMembers}
                  limit={usage.limits.maxTeamMembers}
                  color="orange"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Plan Features */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Plan Features
            </h2>

            <ul className="space-y-3">
              {currentSubscription?.plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Upgrade CTA */}
          {currentSubscription?.plan.name === 'free' && (
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm p-6 text-white">
              <h3 className="text-lg font-semibold mb-2">Unlock More Features</h3>
              <p className="text-sm text-blue-100 mb-4">
                Upgrade to Pro and get 10x more posts, AI credits, and advanced features.
              </p>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
              >
                View Plans
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cancel Subscription?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your subscription will remain active until {formatDate(currentSubscription?.currentPeriodEnd)}.
              After that, you'll be moved to the Free plan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
