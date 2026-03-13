import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';
import {
  ROLE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  GOAL_OPTIONS,
} from '@/types/onboarding.types';
import { ChevronRight, Users, Target, Briefcase } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

/**
 * WelcomeStep Component
 * 
 * First step of onboarding - personalize the experience
 * - Select role (founder, marketer, agency, creator)
 * - Select team size
 * - Select primary goal
 */
export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const { user } = useAuthStore();
  const { currentStepData, updateStepData } = useOnboardingStore();
  
  const [selectedRole, setSelectedRole] = useState(currentStepData.role || '');
  const [selectedTeamSize, setSelectedTeamSize] = useState(currentStepData.teamSize || '');
  const [selectedGoal, setSelectedGoal] = useState(currentStepData.primaryGoal || '');

  const handleNext = () => {
    updateStepData({
      role: selectedRole,
      teamSize: selectedTeamSize,
      primaryGoal: selectedGoal,
    });
    onNext();
  };

  const isValid = selectedRole && selectedTeamSize && selectedGoal;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome, {user?.firstName}! 👋
        </h2>
        <p className="text-lg text-gray-600">
          Let's personalize your experience to help you get the most out of SocialScheduler.
        </p>
      </div>

      <div className="space-y-8">
        {/* Role Selection */}
        <div>
          <div className="flex items-center mb-4">
            <Briefcase className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">What's your role?</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedRole(option.value)}
                className={`p-4 text-left border-2 rounded-lg transition-colors ${
                  selectedRole === option.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-600 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Team Size Selection */}
        <div>
          <div className="flex items-center mb-4">
            <Users className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">What's your team size?</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEAM_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTeamSize(option.value)}
                className={`p-4 text-left border-2 rounded-lg transition-colors ${
                  selectedTeamSize === option.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-600 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Goal Selection */}
        <div>
          <div className="flex items-center mb-4">
            <Target className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">What's your primary goal?</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GOAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedGoal(option.value)}
                className={`p-4 text-left border-2 rounded-lg transition-colors ${
                  selectedGoal === option.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-600 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end mt-8">
        <button
          onClick={handleNext}
          disabled={!isValid}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
}