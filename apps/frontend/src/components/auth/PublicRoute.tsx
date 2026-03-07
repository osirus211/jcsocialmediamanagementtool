import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute component
 * Blocks access if already authenticated
 * Redirects to dashboard if logged in
 * Used for login/register pages
 */
export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { isAuthenticated, authChecked } = useAuthStore();

  // Wait for auth check to complete
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
