import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { Loader2 } from 'lucide-react';

/**
 * OnboardingPage Component
 * 
 * Full-page onboarding experience for new users
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, authChecked } = useAuthStore();
  const { progress, fetchProgress } = useOnboardingStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (authChecked && !isAuthenticated) {
      navigate('/auth/login');
    }
  }, [authChecked, isAuthenticated, navigate]);

  // Redirect if onboarding is already completed
  useEffect(() => {
    if (user?.onboardingCompleted || progress?.completed) {
      navigate('/');
    }
  }, [user, progress, navigate]);

  // Fetch onboarding progress on mount
  useEffect(() => {
    if (user && !progress) {
      fetchProgress().catch(console.error);
    }
  }, [user, progress, fetchProgress]);

  const handleComplete = () => {
    navigate('/');
  };

  // Show loading while checking auth
  if (!authChecked || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <OnboardingWizard onComplete={handleComplete} />;
}

export default OnboardingPage;