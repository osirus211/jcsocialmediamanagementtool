import { useEffect, useState } from 'react';
import { billingService, UsageStats, BillingStatus } from '../../services/billing.service';
import { AlertCircle, TrendingUp, Users, Zap, HardDrive, CreditCard, ArrowUpRight } from 'lucide-react';

/**
 * Billing Dashboard
 * Shows current plan, usage, and billing status
 */

export function BillingDashboard() {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usageData, billingData] = await Promise.all([
        billingService.getCurrentUsage(),
        billingService.getBillingStatus(),
      ]);
      setUsage(usageData);
      setBilling(billingData);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      // Example: Upgrade to Pro monthly
      const { url } = await billingService.createCheckout('price_pro_monthly');
      window.location.href = url;
    } catch (err: any) {
      alert(err.message || 'Failed to create checkout');
    }
  };

  const handleManageBilling = async () => {
    try {
      const { url } = await billingService.createPortal();
      window.location.href = url;
    } catch (err: any) {
      alert(err.message || 'Failed to open billing portal');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!usage || !billing) {
    return null;
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-blue-100 text-blue-800',
      past_due: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800',
      incomplete: 'bg-yellow-100 text-yellow-800',
    };
    return badges[status as keyof typeof badges] || badges.canceled;
  };

  const postsPercentage = getUsagePercentage(usage.usage.posts, usage.limits.maxPosts);
  const accountsPercentage = getUsagePercentage(usage.usage.accounts, usage.limits.maxAccounts);
  const aiPercentage = getUsagePercentage(usage.usage.ai, usage.limits.maxAIRequests);
  const storagePercentage = getUsagePercentage(usage.usage.storage, usage.limits.maxStorageMB);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
          <p className="text-gray-600 mt-2">Manage your subscription and track usage</p>
        </div>

        {/* Billing Status Alert */}
        {billing.status === 'past_due' && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Payment Failed</p>
                <p className="text-sm">Please update your payment method to continue using paid features.</p>
              </div>
            </div>
            <button
              onClick={handleManageBilling}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Update Payment Method
            </button>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gray-900 capitalize">{usage.plan}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(billing.status)}`}>
                    {billing.status}
                  </span>
                </div>
                {billing.currentPeriodEnd && (
                  <p className="text-gray-600 mt-2">
                    Renews on {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              {usage.plan !== 'enterprise' && (
                <button
                  onClick={handleUpgrade}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <ArrowUpRight className="w-5 h-5" />
                  Upgrade Plan
                </button>
              )}
              <button
                onClick={handleManageBilling}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Manage Billing
              </button>
            </div>
          </div>
        </div>

        {/* Usage Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Posts Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Posts</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{usage.usage.posts}</span>
                <span className="text-gray-600">
                  / {usage.limits.maxPosts === -1 ? '∞' : usage.limits.maxPosts}
                </span>
              </div>
              {usage.limits.maxPosts !== -1 && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getUsageColor(postsPercentage)}`}
                      style={{ width: `${postsPercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{postsPercentage.toFixed(0)}% used</p>
                </>
              )}
            </div>
          </div>

          {/* Accounts Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Accounts</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{usage.usage.accounts}</span>
                <span className="text-gray-600">
                  / {usage.limits.maxAccounts === -1 ? '∞' : usage.limits.maxAccounts}
                </span>
              </div>
              {usage.limits.maxAccounts !== -1 && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getUsageColor(accountsPercentage)}`}
                      style={{ width: `${accountsPercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{accountsPercentage.toFixed(0)}% used</p>
                </>
              )}
            </div>
          </div>

          {/* AI Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">AI Requests</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{usage.usage.ai}</span>
                <span className="text-gray-600">
                  / {usage.limits.maxAIRequests === -1 ? '∞' : usage.limits.maxAIRequests}
                </span>
              </div>
              {usage.limits.maxAIRequests !== -1 && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getUsageColor(aiPercentage)}`}
                      style={{ width: `${aiPercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{aiPercentage.toFixed(0)}% used</p>
                </>
              )}
            </div>
          </div>

          {/* Storage Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <HardDrive className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Storage</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{usage.usage.storage.toFixed(0)}</span>
                <span className="text-gray-600">
                  / {usage.limits.maxStorageMB === -1 ? '∞' : usage.limits.maxStorageMB} MB
                </span>
              </div>
              {usage.limits.maxStorageMB !== -1 && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getUsageColor(storagePercentage)}`}
                      style={{ width: `${storagePercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{storagePercentage.toFixed(0)}% used</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Billing Period */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Current Billing Period</h3>
          <p className="text-gray-600">
            {new Date(usage.periodStart).toLocaleDateString()} - {new Date(usage.periodEnd).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Usage resets at the end of each billing period</p>
        </div>
      </div>
    </div>
  );
}
