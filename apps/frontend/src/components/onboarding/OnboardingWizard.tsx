import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';
import { ONBOARDING_STEPS } from '@/types/onboarding.types';
import { WelcomeStep } from './steps/WelcomeStep';
import { ConnectAccountsStep } from './steps/ConnectAccountsStep';
import { CreatePostStep } from './steps/CreatePostStep';
import { InviteTeamStep } from './steps/InviteTeamStep';
import { CompleteStep } from './steps/CompleteStep';
import { OnboardingProgress } from './OnboardingProgress';
import { logger } from '@/lib/logger';
import { Loader2 } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete?: () => void;
}

/**
 * OnboardingWizard Component
 * 
 * Multi-step onboarding flow for new users:
 * 1. Welcome - personalize experience
 * 2. Connect Social Accounts
 * 3. Create First Post
 * 4. Invite Team Members
 * 5. Setup Complete
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    progress,
    isLoading,
    fetchProgress,
    updateStep,
    completeOnboarding,
    skipOnboarding,
  } = useOnboardingStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fetch progress on mount
  useEffect(() => {
    if (user && !progress) {
      fetchProgress().catch((error) => {
        logger.error('Failed to fetch onboarding progress', { error });
      });
    }
  }, [user, progress, fetchProgress]);

  // Update current step when progress changes
  useEffect(() => {
    if (progress) {
      setCurrentStep(progress.currentStep);
    }
  }, [progress]);

  const handleNext = async () => {
    if (isTransitioning) return;

    try {
      setIsTransitioning(true);
      const nextStep = currentStep + 1;
      
      if (nextStep >= 5) {
        // Complete onboarding
        await completeOnboarding();
        onComplete?.();
        navigate('/');
      } else {
        await updateStep(nextStep);
        setCurrentStep(nextStep);
      }
    } catch (error) {
      logger.error('Failed to proceed to next step', { error });
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleBack = async () => {
    if (isTransitioning || currentStep <= 0) return;

    try {
      setIsTransitioning(true);
      const prevStep = currentStep - 1;
      await updateStep(prevStep);
      setCurrentStep(prevStep);
    } catch (error) {
      logger.error('Failed to go back', { error });
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleSkip = async () => {
    if (isTransitioning) return;

    try {
      setIsTransitioning(true);
      await skipOnboarding();
      onComplete?.();
      navigate('/');
    } catch (error) {
      logger.error('Failed to skip onboarding', { error });
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleStepClick = async (step: number) => {
    if (isTransitioning || step === currentStep) return;
    
    // Only allow going to completed steps or the next step
    if (progress && (progress.completedSteps.includes(step) || step === currentStep + 1)) {
      try {
        setIsTransitioning(true);
        await updateStep(step);
        setCurrentStep(step);
      } catch (error) {
        logger.error('Failed to jump to step', { error });
      } finally {
        setIsTransitioning(false);
      }
    }
  };

  if (isLoading && !progress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case ONBOARDING_STEPS.WELCOME:
        return <WelcomeStep onNext={handleNext} />;
      case ONBOARDING_STEPS.CONNECT_ACCOUNTS:
        return <ConnectAccountsStep onNext={handleNext} onBack={handleBack} />;
      case ONBOARDING_STEPS.CREATE_POST:
        return <CreatePostStep onNext={handleNext} onBack={handleBack} />;
      case ONBOARDING_STEPS.INVITE_TEAM:
        return <InviteTeamStep onNext={handleNext} onBack={handleBack} />;
      case ONBOARDING_STEPS.COMPLETE:
        return <CompleteStep onComplete={() => {
          onComplete?.();
          navigate('/');
        }} />;
      default:
        return <WelcomeStep onNext={handleNext} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Welcome to SocialScheduler
              </h1>
            </div>
            
            <button
              onClick={handleSkip}
              disabled={isTransitioning}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium disabled:opacity-50"
            >
              Skip setup
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <OnboardingProgress
            currentStep={currentStep}
            completedSteps={progress?.completedSteps || []}
            onStepClick={handleStepClick}
            disabled={isTransitioning}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}