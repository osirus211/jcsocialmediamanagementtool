/**
 * Email Verification Page
 * 
 * Handles email verification token verification and automatic confirmation
 */

import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, XCircle, Loader2, Mail, RefreshCw } from 'lucide-react';

type VerificationState = 'loading' | 'success' | 'expired' | 'invalid' | 'error';

interface VerifyEmailResponse {
  success: boolean;
  message: string;
}

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerificationState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const userId = searchParams.get('userId');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!userId || !token) {
      setState('invalid');
      setError('Invalid verification link');
      return;
    }

    verifyEmail();
  }, [userId, token]);

  const verifyEmail = async () => {
    if (!userId || !token) return;

    try {
      setState('loading');
      setError(null);

      const response = await apiClient.post<VerifyEmailResponse>('/auth/verify-email', {
        userId,
        token,
      });

      if (response.success) {
        setState('success');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth/login');
        }, 3000);
      } else {
        setState('error');
        setError(response.message || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Email verification error:', err);
      
      if (err.response?.status === 400) {
        if (err.response?.data?.message?.includes('expired')) {
          setState('expired');
          setError('This verification link has expired');
        } else if (err.response?.data?.message?.includes('invalid')) {
          setState('invalid');
          setError('Invalid verification link');
        } else {
          setState('error');
          setError(err.response?.data?.message || 'Verification failed');
        }
      } else {
        setState('error');
        setError('Something went wrong. Please try again.');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!userId) return;

    try {
      setIsResending(true);
      setError(null);

      await apiClient.post('/auth/resend-verification', {
        userId,
      });

      // Show success message
      setState('success');
      setError('A new verification email has been sent to your email address.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Verifying Your Email
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300">
            Please wait while we verify your email address...
          </p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Email Verified Successfully
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your email address has been verified. You can now sign in to your account.
          </p>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Redirecting to sign in page in 3 seconds...
          </p>
          
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Verification Link Expired
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            This email verification link has expired. Verification links are only valid for 24 hours for security reasons.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Send New Verification Email
                </>
              )}
            </button>
            
            <Link
              to="/auth/login"
              className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Verification Link
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            This email verification link is invalid or has already been used. Each verification link can only be used once.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleResendVerification}
              disabled={isResending || !userId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Send New Verification Email
                </>
              )}
            </button>
            
            <Link
              to="/auth/login"
              className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Verification Failed
        </h2>
        
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          We couldn't verify your email address.
        </p>
        
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-6">{error}</p>
        )}
        
        <div className="space-y-3">
          <button
            onClick={verifyEmail}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={handleResendVerification}
            disabled={isResending || !userId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Send New Verification Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};