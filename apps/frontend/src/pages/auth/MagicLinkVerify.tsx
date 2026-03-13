/**
 * Magic Link Verification Page
 * 
 * Handles magic link token verification and automatic sign-in
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';

type VerificationState = 'loading' | 'success' | 'expired' | 'invalid' | 'error';

interface MagicLinkStatusResponse {
  valid: boolean;
  expired?: boolean;
  message: string;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface MagicLinkVerifyResponse {
  success: boolean;
  message: string;
  user: any;
  accessToken: string;
}

export const MagicLinkVerifyPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setAccessToken } = useAuthStore();
  
  const [state, setState] = useState<VerificationState>('loading');
  const [userInfo, setUserInfo] = useState<{ email: string; firstName: string; lastName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setError('No magic link token provided');
      return;
    }

    verifyMagicLink();
  }, [token]);

  const verifyMagicLink = async () => {
    if (!token) return;

    try {
      setState('loading');

      // First check if the token is valid without consuming it
      const statusResponse = await apiClient.get<MagicLinkStatusResponse>(
        `/auth/magic-link/status?token=${token}`
      );

      if (!statusResponse.valid) {
        if (statusResponse.expired) {
          setState('expired');
        } else {
          setState('invalid');
        }
        setError(statusResponse.message);
        return;
      }

      // Store user info for display
      if (statusResponse.user) {
        setUserInfo(statusResponse.user);
      }

      // Now verify and consume the token
      const verifyResponse = await apiClient.get<MagicLinkVerifyResponse>(
        `/auth/magic-link/verify?token=${token}`
      );

      if (verifyResponse.success) {
        // Set authentication state
        setUser(verifyResponse.user);
        setAccessToken(verifyResponse.accessToken);
        
        setState('success');
        
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        setState('error');
        setError(verifyResponse.message || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Magic link verification error:', err);
      
      if (err.response?.status === 401) {
        if (err.response?.data?.message?.includes('expired')) {
          setState('expired');
          setError('This magic link has expired');
        } else {
          setState('invalid');
          setError('Invalid or used magic link');
        }
      } else {
        setState('error');
        setError(err.response?.data?.message || 'Verification failed');
      }
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4">
              <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Verifying Magic Link
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Please wait while we verify your magic link...
            </p>
            {userInfo && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Signing in {userInfo.firstName} {userInfo.lastName} ({userInfo.email})
              </p>
            )}
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome Back!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              You've been successfully signed in.
            </p>
            {userInfo && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Hello, {userInfo.firstName} {userInfo.lastName}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to dashboard...
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 mb-4">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Magic Link Expired
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This magic link has expired. Magic links are only valid for 15 minutes for security reasons.
            </p>
            <div className="space-y-3">
              <Link
                to="/auth/magic-link"
                className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Request New Magic Link
              </Link>
              <Link
                to="/auth/login"
                className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Sign in with Password
              </Link>
            </div>
          </div>
        );

      case 'invalid':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Invalid Magic Link
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This magic link is invalid or has already been used. Each magic link can only be used once.
            </p>
            <div className="space-y-3">
              <Link
                to="/auth/magic-link"
                className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Request New Magic Link
              </Link>
              <Link
                to="/auth/login"
                className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Sign in with Password
              </Link>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Verification Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              We couldn't verify your magic link.
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-6">
                {error}
              </p>
            )}
            <div className="space-y-3">
              <button
                onClick={verifyMagicLink}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <Link
                to="/auth/magic-link"
                className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Request New Magic Link
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};