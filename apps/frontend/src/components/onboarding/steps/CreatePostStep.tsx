import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '@/store/onboarding.store';
import { ChevronRight, ChevronLeft, Send, Calendar, Edit3 } from 'lucide-react';

interface CreatePostStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * CreatePostStep Component
 * 
 * Third step - create first post with simple composer
 */
export function CreatePostStep({ onNext, onBack }: CreatePostStepProps) {
  const navigate = useNavigate();
  const { currentStepData, updateStepData } = useOnboardingStore();
  const [postContent, setPostContent] = useState('');
  const [hasCreatedPost, setHasCreatedPost] = useState(
    currentStepData.firstPostCreated || false
  );

  const handleCreatePost = () => {
    // Navigate to full composer
    navigate('/posts/create?onboarding=true');
  };

  const handleSkipStep = () => {
    updateStepData({ firstPostCreated: false });
    onNext();
  };

  const handleNext = () => {
    updateStepData({ firstPostCreated: hasCreatedPost });
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Create Your First Post
        </h2>
        <p className="text-lg text-gray-600">
          Let's create your first social media post. You can schedule it or publish it right away.
        </p>
      </div>

      {!hasCreatedPost ? (
        <div className="space-y-6">
          {/* Simple Post Preview */}
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="max-w-md mx-auto">
              <Edit3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Ready to create your first post?
              </h3>
              <p className="text-gray-600 mb-6">
                Use our full composer to write, schedule, and publish your content across all your connected social accounts.
              </p>
              
              <button
                onClick={handleCreatePost}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send className="w-4 h-4 mr-2" />
                Open Composer
              </button>
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Send className="w-5 h-5 text-blue-600 mr-2" />
                <span className="font-medium text-gray-900">Publish Now</span>
              </div>
              <p className="text-sm text-gray-600">
                Post immediately to all your connected accounts
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Calendar className="w-5 h-5 text-purple-600 mr-2" />
                <span className="font-medium text-gray-900">Schedule Later</span>
              </div>
              <p className="text-sm text-gray-600">
                Pick the perfect time to reach your audience
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-green-900 mb-2">
            Great job! 🎉
          </h3>
          <p className="text-green-700">
            You've created your first post. You're well on your way to mastering social media scheduling!
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
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
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}