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

// Mock the auth store
vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
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
  let mockUseAuthStore: any;
  let mockUseWorkspaceStore: any;

  beforeAll(async () => {
    mockPostCommentsService = (await vi.importMock('@/services/post-comments.service')).postCommentsService;
    mockUseAuthStore = (await vi.importMock('@/store/auth.store')).useAuthStore;
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
    
    // Mock auth store to return user
    vi.mocked(mockUseAuthStore).mockReturnValue({
      user: {
        _id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        avatar: null,
      },
      isAuthenticated: true,
      isLoading: false,
      authChecked: true,
      accessToken: 'mock-token',
      setUser: vi.fn(),
      setAccessToken: vi.fn(),
      setLoading: vi.fn(),
      setAuthChecked: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      completeLogin: vi.fn(),
      logout: vi.fn(),
      fetchMe: vi.fn(),
      refreshToken: vi.fn(),
      clearAuth: vi.fn(),
    });
    
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

    // Use a function matcher for text split across elements
    expect(screen.getByText((content, element) => {
      return element?.textContent === 'This is another comment with @jane mention';
    })).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    const commentInput = screen.getByPlaceholderText(/write a comment/i);
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

    await waitFor(() => {
      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    const commentInput = screen.getByPlaceholderText(/write a comment/i);
    
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

    const resolveButtons = screen.getAllByRole('button', { name: /resolve comment/i });
    fireEvent.click(resolveButtons[0]); // Click the first comment's resolve button

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

    const replyButtons = screen.getAllByRole('button', { name: /reply to comment/i });
    fireEvent.click(replyButtons[0]); // Click the first comment's reply button

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/write a reply/i)).toBeInTheDocument();
    });

    const replyInput = screen.getByPlaceholderText(/write a reply/i);
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

    // Use getAllByRole since there are multiple comments
    expect(screen.getAllByRole('button', { name: /edit comment/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /delete comment/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /resolve comment/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /reply to comment/i }).length).toBeGreaterThan(0);
  });
});