import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlatformOverridePanel } from '@/components/composer/PlatformOverridePanel';
import { useComposerStore } from '@/store/composer.store';

// Mock the composer store
vi.mock('@/store/composer.store', () => ({
  useComposerStore: vi.fn(),
}));

describe('PlatformOverridePanel', () => {
  const mockOnClose = vi.fn();
  const mockCopyFromBaseContent = vi.fn();
  const mockResetPlatformContent = vi.fn();
  const mockSetContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementation
    (useComposerStore as any).mockImplementation((selector: any) => {
      const state = {
        mainContent: 'Test main content',
        platformContent: {},
        selectedAccounts: ['acc1', 'acc2'],
        copyFromBaseContent: mockCopyFromBaseContent,
        resetPlatformContent: mockResetPlatformContent,
        setContent: mockSetContent,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders platform override panel with data-testid', () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    expect(screen.getByTestId('platform-override-panel')).toBeInTheDocument();
  });

  it('renders platform tabs for selected platforms', () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    // Check that platform tabs are rendered
    expect(screen.getByTestId('platform-override-tab-twitter')).toBeInTheDocument();
    expect(screen.getByTestId('platform-override-tab-instagram')).toBeInTheDocument();
    expect(screen.getByTestId('platform-override-tab-facebook')).toBeInTheDocument();
    expect(screen.getByTestId('platform-override-tab-linkedin')).toBeInTheDocument();
  });

  it('shows toggle for active platform', () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    // First platform should be active by default
    expect(screen.getByTestId('platform-override-toggle-twitter')).toBeInTheDocument();
  });

  it('toggle ON shows override textarea', async () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const toggle = screen.getByTestId('platform-override-toggle-twitter');
    
    // Click toggle to enable override
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(screen.getByTestId('platform-override-editor-twitter')).toBeInTheDocument();
    });
    
    expect(mockCopyFromBaseContent).toHaveBeenCalledWith('twitter');
  });

  it('toggle OFF hides override textarea', async () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const toggle = screen.getByTestId('platform-override-toggle-twitter');
    
    // Enable override first
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(screen.getByTestId('platform-override-editor-twitter')).toBeInTheDocument();
    });
    
    // Disable override
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(screen.queryByTestId('platform-override-editor-twitter')).not.toBeInTheDocument();
    });
    
    expect(mockResetPlatformContent).toHaveBeenCalledWith('twitter');
  });

  it('character count updates as user types', async () => {
    (useComposerStore as any).mockImplementation((selector: any) => {
      const state = {
        mainContent: 'Test main content',
        platformContent: { twitter: 'Hello' },
        selectedAccounts: ['acc1', 'acc2'],
        copyFromBaseContent: mockCopyFromBaseContent,
        resetPlatformContent: mockResetPlatformContent,
        setContent: mockSetContent,
      };
      return selector ? selector(state) : state;
    });
    
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const toggle = screen.getByTestId('platform-override-toggle-twitter');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(screen.getByTestId('platform-override-editor-twitter')).toBeInTheDocument();
    });
    
    const textarea = screen.getByTestId('platform-override-editor-twitter');
    
    // Type in textarea
    fireEvent.change(textarea, { target: { value: 'New content' } });
    
    expect(mockSetContent).toHaveBeenCalledWith('twitter', 'New content');
  });

  it('character count turns red when over platform limit', async () => {
    const longContent = 'a'.repeat(300); // Over Twitter's 280 limit
    
    (useComposerStore as any).mockImplementation((selector: any) => {
      const state = {
        mainContent: 'Test main content',
        platformContent: { twitter: longContent },
        selectedAccounts: ['acc1', 'acc2'],
        copyFromBaseContent: mockCopyFromBaseContent,
        resetPlatformContent: mockResetPlatformContent,
        setContent: mockSetContent,
      };
      return selector ? selector(state) : state;
    });
    
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const toggle = screen.getByTestId('platform-override-toggle-twitter');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      const charCount = screen.getByText(/300 \/ 280/);
      expect(charCount).toHaveClass('text-red-600');
    });
  });

  it('character count turns amber when 80-95% of limit', async () => {
    const content = 'a'.repeat(230); // 82% of Twitter's 280 limit
    
    (useComposerStore as any).mockImplementation((selector: any) => {
      const state = {
        mainContent: 'Test main content',
        platformContent: { twitter: content },
        selectedAccounts: ['acc1', 'acc2'],
        copyFromBaseContent: mockCopyFromBaseContent,
        resetPlatformContent: mockResetPlatformContent,
        setContent: mockSetContent,
      };
      return selector ? selector(state) : state;
    });
    
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const toggle = screen.getByTestId('platform-override-toggle-twitter');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      const charCount = screen.getByText(/230 \/ 280/);
      expect(charCount).toHaveClass('text-amber-600');
    });
  });

  it('character count is green when under 80% of limit', async () => {
    const content = 'a'.repeat(100); // 36% of Twitter's 280 limit
    
    (useComposerStore as any).mockImplementation((selector: any) => {
      const state = {
        mainContent: 'Test main content',
        platformContent: { twitter: content },
        selectedAccounts: ['acc1', 'acc2'],
        copyFromBaseContent: mockCopyFromBaseContent,
        resetPlatformContent: mockResetPlatformContent,
        setContent: mockSetContent,
      };
      return selector ? selector(state) : state;
    });
    
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const toggle = screen.getByTestId('platform-override-toggle-twitter');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      const charCount = screen.getByText(/100 \/ 280/);
      expect(charCount).toHaveClass('text-green-600');
    });
  });

  it('calls onClose when close button is clicked', () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const closeButton = screen.getByLabelText('Close platform override panel');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('switches between platform tabs', async () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    const instagramTab = screen.getByTestId('platform-override-tab-instagram');
    fireEvent.click(instagramTab);
    
    await waitFor(() => {
      expect(screen.getByTestId('platform-override-toggle-instagram')).toBeInTheDocument();
    });
  });

  it('shows global content when override is disabled', () => {
    render(<PlatformOverridePanel onClose={mockOnClose} />);
    
    // Should show "Using global content" message
    expect(screen.getByText('Using global content:')).toBeInTheDocument();
    expect(screen.getByText('Test main content')).toBeInTheDocument();
  });
});
