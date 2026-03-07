import { useNavigate } from 'react-router-dom';
import { Calendar, Send, CheckCircle } from 'lucide-react';

interface FirstPostOnboardingProps {
  onDismiss: () => void;
}

/**
 * FirstPostOnboarding Component
 * 
 * Guides new users through creating their first post
 * 
 * Flow:
 * 1. Create post
 * 2. Schedule or publish
 * 3. Done!
 */
export function FirstPostOnboarding({ onDismiss }: FirstPostOnboardingProps) {
  const navigate = useNavigate();

  const handleCreatePost = () => {
    onDismiss();
    navigate('/posts/create');
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Send className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Welcome! Let's create your first post
          </h3>
          
          <p className="text-gray-700 mb-4">
            Get started by creating and scheduling your first social media post. It only takes a minute!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                1
              </div>
              <div>
                <div className="font-medium text-gray-900">Create</div>
                <div className="text-sm text-gray-600">Write your post content</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                2
              </div>
              <div>
                <div className="font-medium text-gray-900">Schedule</div>
                <div className="text-sm text-gray-600">Pick a time to publish</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                3
              </div>
              <div>
                <div className="font-medium text-gray-900">Done!</div>
                <div className="text-sm text-gray-600">We'll publish it for you</div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCreatePost}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Create Your First Post
            </button>
            
            <button
              onClick={onDismiss}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
