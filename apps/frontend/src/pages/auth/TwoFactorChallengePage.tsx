/**
 * Two-Factor Authentication Challenge Page
 * 
 * Shown after login when 2FA is required.
 * Allows user to enter TOTP code or backup code to complete login.
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, Smartphone, Key, AlertCircle } from 'lucide-react';
import { TwoFactorService } from '@/services/two-factor.service';
import { useAuthStore } from '@/store/auth.store';

type ChallengeMode = 'totp' | 'backup';

interface LocationState {
  userId?: string;
}

export function TwoFactorChallengePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { completeLogin } = useAuthStore();
  
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Get userId from location state
  const locationState = location.state as LocationState;
  const userId = locationState?.userId;

  useEffect(() => {
    // Redirect to login if no userId provided
    if (!userId) {
      navigate('/auth/login', { replace: true });
    }
  }, [userId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Please enter a verification code');
      return;
    }

    if (!userId) {
      setError('Session expired. Please log in again.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Complete login with 2FA token
      await completeLogin(userId, token);
      
      // Redirect to dashboard
      navigate('/', { replace: true });
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Invalid authentication code';
      setError(errorMessage);
      setRetryCount(prev => prev + 1);
      
      // Clear token on error
      setToken('');
      
      // If too many retries, redirect to login
      if (retryCount >= 4) {
        setError('Too many failed attempts. Please log in again.');
        setTimeout(() => {
          navigate('/auth/login', { replace: true });
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenChange = (value: string) => {
    setError(null);
    
    if (mode === 'totp') {
      // Only allow digits, max 6 characters
      const cleanValue = value.replace(/\D/g, '').slice(0, 6);
      setToken(cleanValue);
    } else {
      // Allow alphanumeric for backup codes, max 8 characters
      const cleanValue = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0, 8);
      setToken(cleanValue);
    }
  };

  const handleModeSwitch = (newMode: ChallengeMode) => {
    setMode(newMode);
    setToken('');
    setError(null);
  };

  const handleBackToLogin = () => {
    navigate('/auth/login', { replace: true });
  };

  if (!userId) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Shield className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          Two-Factor Authentication
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your authentication code to complete sign in
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Mode Toggle */}
          <div className="mb-6">
            <div className="flex rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => handleModeSwitch('totp')}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${mode === 'totp' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 hover:text-gray-900'
                  }
                `}
              >
                <Smartphone className="h-4 w-4" />
                Authenticator App
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('backup')}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${mode === 'backup' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 hover:text-gray-900'
                  }
                `}
              >
                <Key className="h-4 w-4" />
                Backup Code
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'totp' ? 'Authentication Code' : 'Backup Code'}
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => handleTokenChange(e.target.value)}
                placeholder={mode === 'totp' ? '000000' : 'XXXXXXXX'}
                className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={mode === 'totp' ? 6 : 8}
                autoComplete="off"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500">
                {mode === 'totp' 
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter one of your 8-character backup codes'
                }
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-600">{error}</p>
                  {retryCount > 0 && retryCount < 5 && (
                    <p className="text-xs text-red-500 mt-1">
                      Attempts remaining: {5 - retryCount}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || token.length < (mode === 'totp' ? 6 : 8)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 space-y-4">
            {mode === 'totp' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('backup')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Lost your device? Use a backup code instead
                </button>
              </div>
            )}
            
            {mode === 'backup' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Each backup code can only be used once. 
                  After using this code, it will no longer be valid.
                </p>
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ← Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}