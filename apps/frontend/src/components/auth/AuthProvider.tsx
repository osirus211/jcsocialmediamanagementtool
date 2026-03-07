import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider component
 * Handles session restoration on app load
 * 
 * Flow:
 * 1. Check if auth has been checked
 * 2. If not, attempt to fetch current user (/auth/me)
 * 3. If 401, attempt token refresh
 * 4. If refresh succeeds, retry /auth/me
 * 5. If all fails, mark as unauthenticated (GUEST SESSION)
 * 
 * CRITICAL: 401 during bootstrap is NOT an error - it means guest session
 * App MUST NEVER crash or block startup due to missing auth
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { authChecked, fetchMe, setAuthChecked } = useAuthStore();
  const didInit = useRef(false);

  useEffect(() => {
    // Prevent double execution in React StrictMode (development only)
    if (didInit.current) return;
    didInit.current = true;


    const initAuth = async () => {
      if (authChecked) return;
      
      try {
        // Attempt to restore session
        // If this fails (401), it's expected - user is not logged in
        await fetchMe();
      } catch (error) {
        // Bootstrap auth failure is NORMAL for guest users
        // Log for debugging but DO NOT block app startup
        console.warn('Auth init: Continuing as guest session', error);
      } finally {
        // ALWAYS mark auth as checked, even if fetchMe fails
        // This ensures app loads for guest users
        setAuthChecked(true);
      }
    };

    initAuth();
  }, [authChecked, fetchMe, setAuthChecked]);

  // Show loading screen while checking auth
  // This should be brief - no timeout needed
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
