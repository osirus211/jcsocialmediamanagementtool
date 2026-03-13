import { Check } from 'lucide-react';

interface OnboardingProgressProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
  disabled?: boolean;
}

const STEP_LABELS = [
  'Welcome',
  'Connect Accounts',
  'Create Post',
  'Invite Team',
  'Complete',
];

/**
 * OnboardingProgress Component
 * 
 * Shows progress through onboarding steps with clickable navigation
 */
export function OnboardingProgress({
  currentStep,
  completedSteps,
  onStepClick,
  disabled = false,
}: OnboardingProgressProps) {
  const getStepStatus = (step: number) => {
    if (completedSteps.includes(step)) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  };

  const isStepClickable = (step: number) => {
    return !disabled && (completedSteps.includes(step) || step === currentStep + 1);
  };

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {STEP_LABELS.map((label, index) => {
          const status = getStepStatus(index);
          const isClickable = isStepClickable(index);
          
          return (
            <li key={index} className={`relative ${index !== STEP_LABELS.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
              {/* Connector line */}
              {index !== STEP_LABELS.length - 1 && (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${
                    completedSteps.includes(index) ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                </div>
              )}
              
              {/* Step button */}
              <button
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  status === 'completed'
                    ? 'bg-blue-600 border-blue-600 hover:bg-blue-700'
                    : status === 'current'
                    ? 'border-blue-600 bg-white'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                } ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                } transition-colors`}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span className="sr-only">{label}</span>
                {status === 'completed' ? (
                  <Check className="h-5 w-5 text-white" aria-hidden="true" />
                ) : (
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    status === 'current' ? 'bg-blue-600' : 'bg-transparent'
                  }`} />
                )}
              </button>
              
              {/* Step label */}
              <span className={`absolute top-10 left-1/2 transform -translate-x-1/2 text-xs font-medium ${
                status === 'current' ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}