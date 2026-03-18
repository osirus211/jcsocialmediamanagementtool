import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { registerSchema, RegisterFormData } from '@/validators/auth.validators';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    trigger,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'all',
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLocalError(null);
      const submitData: any = {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      };
      
      // Only include marketingConsent if it's true
      if (data.marketingConsent) {
        submitData.marketingConsent = data.marketingConsent;
      }
      
      await registerUser(submitData);
      navigate('/onboarding');
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Manually trigger validation to ensure errors show up
    const isValid = await trigger();
    if (!isValid) {
      return;
    }
    
    // If validation passes, call the actual submit handler
    handleSubmit(onSubmit)(e);
  };

  // Use local error only
  const displayError = localError;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Create Account
      </h2>

      {displayError && (
        <div 
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{displayError}</p>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-4" role="form" aria-label="Create your account">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label 
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              First Name
            </label>
            <input
              {...register('firstName')}
              id="firstName"
              type="text"
              required
              aria-required="true"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="John"
            />
            {errors.firstName && (
              <p 
                id="firstName-error"
                className="mt-1 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <label 
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Last Name
            </label>
            <input
              {...register('lastName')}
              id="lastName"
              type="text"
              required
              aria-required="true"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Doe"
            />
            {errors.lastName && (
              <p 
                id="lastName-error"
                className="mt-1 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

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
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="you@example.com"
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
          <label 
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Password
          </label>
          <input
            {...register('password')}
            id="password"
            type="password"
            autoComplete="new-password"
            required
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="••••••••"
          />
          {errors.password && (
            <p 
              id="password-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {errors.password.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Must be 8+ characters with uppercase, lowercase, and number
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              {...register('termsAccepted')}
              type="checkbox"
              tabIndex={-1}
              aria-required="true"
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I agree to the Terms of Service and Privacy Policy
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.termsAccepted.message}
            </p>
          )}

          <label className="flex items-start gap-3">
            <input
              {...register('marketingConsent')}
              type="checkbox"
              tabIndex={-1}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I'd like to receive product updates and news (optional)
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
};
