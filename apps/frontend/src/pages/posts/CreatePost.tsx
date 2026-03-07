import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { ComposerContainer } from '@/components/composer/ComposerContainer';

export const CreatePostPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspaceStore();
  
  const draftId = searchParams.get('draftId') || undefined;

  const handleSuccess = (postId: string) => {
    navigate('/posts');
  };

  const handleCancel = () => {
    navigate('/posts');
  };

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Please select a workspace first
        </div>
      </div>
    );
  }

  return (
    <ComposerContainer
      draftId={draftId}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
