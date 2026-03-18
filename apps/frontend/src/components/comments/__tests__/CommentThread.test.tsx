import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { CommentThread } from '../CommentThread';

// Mock the comment service
vi.mock('@/services/post-comments.service', () => ({
  postCommentsService: {
    getComments: vi.fn(),
    addComment: vi.fn(),
    editComment: vi.fn(),
    deleteComment: vi.fn(),
    resolveComment: vi.fn(),
    unresolveComment: vi.fn(),
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
  },
}));

// Mock the workspace store
vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: vi.fn(),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('CommentThread', () => {
  let mockPostCommentsService: any;
  let mockUseWorkspaceStore: any;

  beforeAll(async () => {
    mockPostCommentsService = (await vi.importMock('@/services/post-comments.service')).postCommentsService;
    mockUseWorkspaceStore = (await vi.importMock('@/store/workspace.store')).useWorkspaceStore;
  });

  const mockComments = [
    {
      _id: 'comment-1',
      postId: 'post-1',
      workspaceId: 'workspace-1',
      content: 'This is a test comment',
      authorId: {
        _id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        avatar: null,
      },
      authorName: 'John Doe',
      authorAvatar: null,
      mentions: [],
      parentId: undefined,
      isResolved: false,
      resolvedBy: undefined,
      resolvedAt: undefined,
      editedAt: undefined,
      reactions: [],
      attachments: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    },
    {
      _id: 'comment-2',
      postId: 'post-1',
      workspaceId: 'workspace-1',
      content: 'This is another comment with @jane mention',
      authorId: {
        _id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        avatar: null,
      },
      authorName: 'Jane Smith',
      authorAvatar: null,
      mentions: ['jane'],
      parentId: undefined,
      isResolved: false,
      resolvedBy: undefined,
      resolvedAt: undefined,
      editedAt: undefined,
      reactions: [],
      attachments: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(mockUseWorkspaceStore).mockReturnValue({
      currentWorkspace: {
        _id: 'workspace-1',
        name: 'Test Workspace',
      },
      members: [
        { _id: 'user-1', firstName: 'John', lastName: 'Doe', avatar: null },
        { _id: 'user-2', firstName: 'Jane', lastName: 'Smith', avatar: null },
      ],
    });

    vi.mocked(mockPostCommentsService.getComments).mockResolvedValue(mockComments);
  });

  it('renders list of comments', async () => {
    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    expect(screen.getByText('This is another comment with @jane mention')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('submit new comment calls POST endpoint', async () => {
    vi.mocked(mockPostCommentsService.addComment).mockResolvedValue(mockComments[0]);

    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    const commentInput = screen.getByPlaceholderText(/add a comment/i);
    const submitButton = screen.getByRole('button', { name: /post comment/i });

    fireEvent.change(commentInput, { target: { value: 'New test comment' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(vi.mocked(mockPostCommentsService.addComment)).toHaveBeenCalledWith('post-1', {
        content: 'New test comment',
      });
    });
  });

  it('@mention autocomplete appears after typing @', async () => {
    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    const commentInput = screen.getByPlaceholderText(/add a comment/i);
    
    fireEvent.change(commentInput, { target: { value: 'Hello @j' } });
    fireEvent.keyUp(commentInput, { key: 'j' });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('edit comment shows edit input inline', async () => {
    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit comment/i });
    fireEvent.click(editButton);

    expect(screen.getByDisplayValue('This is a test comment')).toBeInTheDocument();
  });

  it('delete comment calls DELETE endpoint', async () => {
    vi.mocked(mockPostCommentsService.deleteComment).mockResolvedValue(undefined);
    
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete comment/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(vi.mocked(mockPostCommentsService.deleteComment)).toHaveBeenCalledWith('post-1', 'comment-1');
    });

    // Restore window.confirm
    window.confirm = originalConfirm;
  });

  it('resolve comment calls POST /:id/resolve', async () => {
    vi.mocked(mockPostCommentsService.resolveComment).mockResolvedValue(mockComments[0]);

    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    const resolveButton = screen.getByRole('button', { name: /resolve comment/i });
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(vi.mocked(mockPostCommentsService.resolveComment)).toHaveBeenCalledWith('post-1', 'comment-1');
    });
  });

  it('reply to comment shows nested reply', async () => {
    vi.mocked(mockPostCommentsService.addComment).mockResolvedValue(mockComments[0]);

    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    const replyButton = screen.getByRole('button', { name: /reply to comment/i });
    fireEvent.click(replyButton);

    const replyInput = screen.getByPlaceholderText(/reply to john doe/i);
    const submitReplyButton = screen.getByRole('button', { name: /post reply/i });

    fireEvent.change(replyInput, { target: { value: 'This is a reply' } });
    fireEvent.click(submitReplyButton);

    await waitFor(() => {
      expect(vi.mocked(mockPostCommentsService.addComment)).toHaveBeenCalledWith('post-1', {
        content: 'This is a reply',
        parentId: 'comment-1',
      });
    });
  });

  it('all icon buttons have aria-labels', async () => {
    renderWithRouter(
      <CommentThread 
        postId="post-1" 
        isVisible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit comment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resolve comment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reply to comment/i })).toBeInTheDocument();
  });
});