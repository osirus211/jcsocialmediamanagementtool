import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';
import { 
  CheckCircle, 
  Calendar, 
  BarChart3, 
  Settings, 
  Sparkles,
  ArrowRight 
} from 'lucide-react';

interface CompleteStepProps {
  onComplete: () => void;
}

/**
 * CompleteStep Component
 * 
 * Final step - setup complete with confetti and next actions
 */
export function CompleteStep({ onComplete }: CompleteStepProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentStepData } = useOnboardingStore();
  const [showConfetti, setShowConfetti] = useState(false);

  // Trigger confetti animation on mount
  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const quickActions = [
    {
      title: 'Create Your Next Post',
      description: 'Keep the momentum going with another post',
      icon: Calendar,
      action: () => navigate('/posts/create'),
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      title: 'View Analytics',
      description: 'See how your content is performing',
      icon: BarChart3,
      action: () => navigate('/analytics'),
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      title: 'Explore Features',
      description: 'Discover all the tools available to you',
      icon: Settings,
      action: () => navigate('/'),
      color: 'bg-green-600 hover:bg-green-700',
    },
  ];

  const setupSummary = [
    {
      label: 'Role',
      value: currentStepData.role ? 
        currentStepData.role.charAt(0).toUpperCase() + currentStepData.role.slice(1) : 
        'Not specified',
      completed: !!currentStepData.role,
    },
    {
      label: 'Team Size',
      value: currentStepData.teamSize ? 
        currentStepData.teamSize.charAt(0).toUpperCase() + currentStepData.teamSize.slice(1) : 
        'Not specified',
      completed: !!currentStepData.teamSize,
    },
    {
      label: 'Connected Accounts',
      value: currentStepData.connectedAccounts?.length || 0,
      completed: (currentStepData.connectedAccounts?.length || 0) > 0,
    },
    {
      label: 'First Post',
      value: currentStepData.firstPostCreated ? 'Created' : 'Skipped',
      completed: !!currentStepData.firstPostCreated,
    },
    {
      label: 'Team Members',
      value: currentStepData.teamMembersInvited?.length || 0,
      completed: (currentStepData.teamMembersInvited?.length || 0) > 0,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 opacity-10 animate-pulse" />
          {/* Simple confetti simulation with emojis */}
          <div className="absolute top-1/4 left-1/4 text-4xl animate-bounce">🎉</div>
          <div className="absolute top-1/3 right-1/4 text-3xl animate-bounce delay-100">✨</div>
          <div className="absolute top-1/2 left-1/3 text-2xl animate-bounce delay-200">🎊</div>
          <div className="absolute top-1/4 right-1/3 text-3xl animate-bounce delay-300">🌟</div>
        </div>
      )}

      {/* Success Message */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-green-600" />
        </div>
        
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          🎉 Welcome to SocialScheduler, {user?.firstName}!
        </h2>
        
        <p className="text-lg text-gray-600 mb-6">
          Your account is all set up and ready to go. You're now equipped with everything you need 
          to manage your social media presence like a pro.
        </p>
      </div>

      {/* Setup Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Setup Summary</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {setupSummary.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <div className="flex items-center">
                <span className="text-sm text-gray-900 mr-2">{item.value}</span>
                {item.completed && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">What would you like to do next?</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={action.action}
                className={`p-4 text-white rounded-lg transition-colors ${action.color} group`}
              >
                <Icon className="w-6 h-6 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-medium text-sm mb-1">{action.title}</div>
                <div className="text-xs opacity-90">{action.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main CTA */}
      <div className="space-y-4">
        <button
          onClick={onComplete}
          className="w-full flex items-center justify-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors group"
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
        
        <p className="text-sm text-gray-500">
          Need help getting started? Check out our{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700 underline">
            help center
          </a>{' '}
          or{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700 underline">
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}