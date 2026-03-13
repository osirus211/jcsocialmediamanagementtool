import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { loginSchema, LoginFormData } from '@/validators/auth.validators';
import { socialService } from '@/services/social.service';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      await login(data.email, data.password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password
          </label>
          <input
            {...register('password')}
            type="password"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
