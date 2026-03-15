import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { loginSchema, LoginFormData } from '@/validators/auth.validators';
import { socialService } from '@/services/social.service';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      const result = await login(data.email, data.password);
      
      // Check if 2FA is required
      if (result && 'requiresTwoFactor' in result) {
        navigate('/auth/two-factor-challenge', { 
          state: { userId: result.userId } 
        });
        return;
      }
      
      // Successful login - redirect to intended page or dashboard
      const redirectTo = searchParams.get('redirect') || '/';
      navigate(redirectTo);
    } catch (err: any) {
      // Handle specific error types
      if (err.message?.includes('verify your email')) {
        setError('Please verify your email first. Check your inbox for the verification link.');
      } else if (err.message?.includes('Too many')) {
        setError('Too many login attempts. Please try again in 15 minutes.');
      } else if (err.message?.includes('Account temporarily locked')) {
        setError('Account temporarily locked. Please try again later.');
      } else if (err.message?.includes('Check your internet')) {
        setError('Check your internet connection and try again.');
      } else {
        setError('Invalid email or password');
      }
      
      // Focus on first field with error
      if (errors.email) {
        setFocus('email');
      } else if (errors.password) {
        setFocus('password');
      }
    }
  };

  const handleOAuthLogin = async (platform: string) => {
    try {
      setError(null);
      const { url } = await socialService.getOAuthUrl(platform);
      window.location.href = url;
    } catch (err: any) {
      setError(`${platform} login failed: ${err.message}`);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Sign In
      </h2>

      {error && (
        <div 
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" role="form">
        <div>
          <label 
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            {...register('email')}
            id="email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="you@example.com"
            onChange={() => setError(null)} // Clear error when user starts typing
          />
          {errors.email && (
            <p 
              id="email-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label 
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              {...register('password')}
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              aria-required="true"
              aria-describedby={errors.password ? 'password-error' : undefined}
              className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="••••••••"
              onChange={() => setError(null)} // Clear error when user starts typing
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px] justify-center"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p 
              id="password-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Don't have an account?{' '}
        <Link to="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign up
        </Link>
      </p>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Or sign in without a password
          </p>
          <Link
            to="/auth/magic-link"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Send me a magic link instead →
          </Link>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Or sign in with
          </p>
          <div className="flex flex-col space-y-2">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
              </svg>
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin('apple')}
              className="w-full flex items-center justify-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M15.5 2.25c-.8 0-1.5.3-2.1.8-.5.5-.8 1.2-.8 1.9 0 .1 0 .2.1.3.1 0 .2 0 .3-.1.7-.4 1.4-.6 2.1-.6.8 0 1.5.3 2.1.8.5.5.8 1.2.8 1.9 0 1.1-.4 2.1-1.2 2.8-.8.7-1.8 1.1-2.9 1.1-.9 0-1.7-.3-2.4-.8-.7-.5-1.2-1.2-1.5-2-.3-.8-.3-1.7 0-2.5.3-.8.8-1.5 1.5-2 .7-.5 1.5-.8 2.4-.8.3 0 .6 0 .9.1.3.1.6.2.8.4.2.2.4.4.5.7.1.3.1.6 0 .9-.1.3-.3.5-.5.7-.2.2-.5.3-.8.3-.3 0-.6-.1-.8-.3-.2-.2-.3-.5-.3-.8 0-.2.1-.4.2-.5.1-.1.3-.2.5-.2.1 0 .2 0 .3.1.1.1.1.2.1.3 0 .1-.1.2-.2.2-.1 0-.2 0-.2-.1 0-.1 0-.1.1-.2 0 0 0-.1-.1-.1-.1 0-.2.1-.2.2-.1.2-.1.4 0 .6.1.2.3.3.5.3.3 0 .5-.1.7-.3.2-.2.3-.4.3-.7 0-.4-.2-.8-.5-1.1-.3-.3-.7-.5-1.1-.5-.5 0-1 .2-1.4.5-.4.3-.7.7-.9 1.2-.2.5-.2 1 0 1.5.2.5.5.9.9 1.2.4.3.9.5 1.4.5.7 0 1.4-.3 1.9-.7.5-.4.9-1 1.1-1.6.2-.6.2-1.3 0-1.9-.2-.6-.6-1.1-1.1-1.5-.5-.4-1.1-.6-1.8-.6z"/>
              </svg>
              Continue with Apple
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
