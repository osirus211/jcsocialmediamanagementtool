/**
 * Billing Cancel Page
 * Stripe checkout cancel callback
 */

import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function Cancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        {/* Cancel Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <XCircle className="h-12 w-12 text-gray-600 dark:text-gray-400" />
          </div>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Checkout Canceled
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Your checkout was canceled. No charges were made to your account.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/pricing')}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View Plans Again
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
