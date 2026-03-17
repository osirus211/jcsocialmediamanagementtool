import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarHeader } from '../CalendarHeader';
import { SocialPlatform } from '@/types/social.types';

// Mock the stores
vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: () => ({
    members: [
      {
        _id: 'member1',
        userId: {
          _id: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          avatar: null,
        },
      },
    ],
  }),
}));

vi.mock('@/store/social.store', () => ({
  useSocialAccountStore: () => ({
    accounts: [
      {
        _id: 'account1',
        platform: SocialPlatform.TWITTER,
        accountName: 'testuser',
        metadata: { avatarUrl: null },
      },
      {
        _id: 'account2',
        platform: SocialPlatform.INSTAGRAM,
        accountName: 'testuser_ig',
        metadata: { avatarUrl: null },
      },
    ],
  }),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const defaultProps = {
  viewMode: 'month' as const,
  onViewModeChange: vi.fn(),
  selectedMemberIds: [],
  onFilterByMembers: vi.fn(),
  postCount: 10,
  searchQuery: '',
  onSearchChange: vi.fn(),
  activePlatforms: [],
  activeAccountIds: [],
  platformCounts: { twitter: 5, instagram: 3 },
  hasActiveFilters: false,
  onTogglePlatform: vi.fn(),
  onToggleAccountId: vi.fn(),
  onClearAllFilters: vi.fn(),
};

describe('CalendarFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders platform chips with correct counts', () => {
    render(<CalendarHeader {...defaultProps} />);
    
    expect(screen.getByTestId('platform-chip-twitter')).toBeInTheDocument();
    expect(screen.getByTestId('platform-chip-instagram')).toBeInTheDocument();
    expect(screen.getByText('Twitter (5)')).toBeInTheDocument();
    expect(screen.getByText('Instagram (3)')).toBeInTheDocument();
  });

  it('toggles platform filter when chip is clicked', () => {
    render(<CalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('platform-chip-twitter'));
    expect(defaultProps.onTogglePlatform).toHaveBeenCalledWith('twitter');
  });

  it('shows active platform filter badge', () => {
    const props = {
      ...defaultProps,
      activePlatforms: ['twitter'],
      hasActiveFilters: true,
    };
    
    render(<CalendarHeader {...props} />);
    
    expect(screen.getByTestId('active-platform-badge-twitter')).toBeInTheDocument();
    expect(screen.getByTestId('clear-all-filters')).toBeInTheDocument();
  });

  it('removes platform filter when badge X is clicked', () => {
    const props = {
      ...defaultProps,
      activePlatforms: ['twitter'],
      hasActiveFilters: true,
    };
    
    render(<CalendarHeader {...props} />);
    
    fireEvent.click(screen.getByTestId('remove-platform-twitter'));
    expect(defaultProps.onTogglePlatform).toHaveBeenCalledWith('twitter');
  });

  it('opens account dropdown when clicked', () => {
    render(<CalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('account-dropdown-trigger'));
    expect(screen.getByTestId('all-accounts-option')).toBeInTheDocument();
    expect(screen.getByTestId('account-option-account1')).toBeInTheDocument();
  });

  it('selects account from dropdown', () => {
    render(<CalendarHeader {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('account-dropdown-trigger'));
    fireEvent.click(screen.getByTestId('account-option-account1'));
    
    expect(defaultProps.onToggleAccountId).toHaveBeenCalledWith('account1');
  });

  it('clears all filters when clear all button is clicked', () => {
    const props = {
      ...defaultProps,
      activePlatforms: ['twitter'],
      activeAccountIds: ['account1'],
      hasActiveFilters: true,
    };
    
    render(<CalendarHeader {...props} />);
    
    fireEvent.click(screen.getByTestId('clear-all-filters'));
    expect(defaultProps.onClearAllFilters).toHaveBeenCalled();
  });

  it('shows active account filter badge', () => {
    const props = {
      ...defaultProps,
      activeAccountIds: ['account1'],
      hasActiveFilters: true,
    };
    
    render(<CalendarHeader {...props} />);
    
    expect(screen.getByTestId('active-account-badge-account1')).toBeInTheDocument();
  });

  it('removes account filter when badge X is clicked', () => {
    const props = {
      ...defaultProps,
      activeAccountIds: ['account1'],
      hasActiveFilters: true,
    };
    
    render(<CalendarHeader {...props} />);
    
    fireEvent.click(screen.getByTestId('remove-account-account1'));
    expect(defaultProps.onToggleAccountId).toHaveBeenCalledWith('account1');
  });

  it('shows no active filter badges when hasActiveFilters is false', () => {
    render(<CalendarHeader {...defaultProps} />);
    
    expect(screen.queryByTestId('clear-all-filters')).not.toBeInTheDocument();
  });

  it('handles mobile viewport with horizontal scroll', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    render(<CalendarHeader {...defaultProps} />);
    
    const chipContainer = screen.getByTestId('platform-chip-twitter').parentElement;
    expect(chipContainer).toHaveClass('overflow-x-auto', 'scrollbar-hide');
  });

  it('supports keyboard navigation for filter chips', () => {
    render(<CalendarHeader {...defaultProps} />);
    
    const twitterChip = screen.getByTestId('platform-chip-twitter');
    
    // Verify the chip is focusable (it's a button)
    expect(twitterChip.tagName).toBe('BUTTON');
    expect(twitterChip).not.toHaveAttribute('disabled');
    
    // Focus should work
    twitterChip.focus();
    expect(document.activeElement).toBe(twitterChip);
  });
});