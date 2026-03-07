/**
 * Billing Success Page
 * Stripe checkout success callback
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useBillingStore } from '../../store/billing.store';

export default function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchSubscription, fetchUsage } = useBillingStore();

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Refresh subscription and usage data
    const refreshData = async () => {
      try {
        await fetchSubscription();
        await fetchUsage();
      } catch (error) {
        console.error('Failed to refresh billing data:', error);
      }
    };

    refreshData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Payment Successful!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Your subscription has been activated. You now have access to all premium features.
        </p>

        {sessionId && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-6">
            Session ID: {sessionId}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/billing')}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View Billing Details
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
