import { X } from 'lucide-react';
import { RepurposeFromPost } from './RepurposeFromPost';

interface RepurposeModalProps {
  postId: string;
  content: string;
  platform: string;
  onClose: () => void;
}

export function RepurposeModal({ postId, content, platform, onClose }: RepurposeModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Repurpose Content
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          <RepurposeFromPost
            postId={postId}
            content={content}
            originalPlatform={platform}
          />
        </div>
      </div>
    </div>
  );
}