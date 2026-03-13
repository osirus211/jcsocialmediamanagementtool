import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '@/store/onboarding.store';
import { ChevronRight, ChevronLeft, Plus, Check } from 'lucide-react';

interface ConnectAccountsStepProps {
  onNext: () => void;
  onBack: () => void;
}

// Mock social platforms - replace with actual data
const SOCIAL_PLATFORMS = [
  { id: 'twitter', name: 'Twitter', icon: '🐦', connected: false },
  { id: 'facebook', name: 'Facebook', icon: '📘', connected: false },
  { id: 'instagram', name: 'Instagram', icon: '📷', connected: false },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', connected: false },
  { id: 'youtube', name: 'YouTube', icon: '📺', connected: false },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', connected: false },
];

/**
 * ConnectAccountsStep Component
 * 
 * Second step - connect at least one social account
 */
export function ConnectAccountsStep({ onNext, onBack }: ConnectAccountsStepProps) {
  const navigate = useNavigate();
  const { currentStepData, updateStepData } = useOnboardingStore();
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>(
    currentStepData.connectedAccounts || []
  );

  const handleConnect = (platformId: string) => {
    // Navigate to OAuth connection flow
    navigate(`/connect-v2?platform=${platformId}&return=/onboarding`);
  };

  const handleSkipStep = () => {
    updateStepData({ connectedAccounts });
    onNext();
  };

  const handleNext = () => {
    updateStepData({ connectedAccounts });
    onNext();
  };

  const hasConnectedAccounts = connectedAccounts.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Connect Your Social Accounts
        </h2>
        <p className="text-lg text-gray-600">
          Connect at least one social media account to start scheduling posts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {SOCIAL_PLATFORMS.map((platform) => {
          const isConnected = connectedAccounts.includes(platform.id);
          
          return (
            <div
              key={platform.id}
              className={`p-6 border-2 rounded-lg transition-colors ${
                isConnected
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{platform.icon}</span>
                  <span className="font-medium text-gray-900">{platform.name}</span>
                </div>
                
                {isConnected ? (
                  <div className="flex items-center text-green-600">
                    <Check className="w-5 h-5 mr-1" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!hasConnectedAccounts && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            💡 <strong>Tip:</strong> You can always connect more accounts later from your settings.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={handleSkipStep}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Skip for now
          </button>
          
          <button
            onClick={handleNext}
            disabled={!hasConnectedAccounts}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}