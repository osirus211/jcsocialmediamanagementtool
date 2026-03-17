/**
 * CalendarAutoFill Tests
 * Tests for AI-powered calendar auto-fill functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CalendarAutoFillModal } from '../CalendarAutoFillModal';

// Mock dependencies
vi.mock('@/services/ai.service', () => ({
  aiService: {
    generateCalendarPosts: vi.fn(),
  },
}));

vi.mock('@/services/post.service', () => ({
  PostService: {
    bulkCreatePosts: vi.fn(),
  },
}));

vi.mock('@/lib/notifications', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockConnectedAccounts = [
  { id: 'acc1', platform: 'twitter', username: 'testuser' },
  { id: 'acc2', platform: 'facebook', username: 'testpage' },
];

describe('CalendarAutoFillModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('opens and shows basic form elements', () => {
    render(
      <CalendarAutoFillModal
        isOpen={true}
        onClose={vi.fn()}
        connectedAccounts={mockConnectedAccounts}
      />
    );

    expect(screen.getByText(/auto-fill calendar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
  });

  it('shows connected platforms as checkboxes', () => {
    render(
      <CalendarAutoFillModal
        isOpen={true}
        onClose={vi.fn()}
        connectedAccounts={mockConnectedAccounts}
      />
    );

    expect(screen.getByText('twitter (@testuser)')).toBeInTheDocument();
    expect(screen.getByText('facebook (@testpage)')).toBeInTheDocument();
  });

  it('has topic input with character limit', () => {
    render(
      <CalendarAutoFillModal
        isOpen={true}
        onClose={vi.fn()}
        connectedAccounts={mockConnectedAccounts}
      />
    );

    const topicInput = screen.getByLabelText(/topic or theme/i);
    expect(topicInput).toBeInTheDocument();
    expect(screen.getByText('0/200')).toBeInTheDocument();
  });

  it('has post count selector from 1 to 30', () => {
    render(
      <CalendarAutoFillModal
        isOpen={true}
        onClose={vi.fn()}
        connectedAccounts={mockConnectedAccounts}
      />
    );

    const countSlider = screen.getByRole('slider');
    expect(countSlider).toBeInTheDocument();
    expect(countSlider).toHaveAttribute('min', '1');
    expect(countSlider).toHaveAttribute('max', '30');
  });
});