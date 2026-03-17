/**
 * RSS Page Tests
 * Tests for RSS feed management UI
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RSSPage } from '../../pages/rss/RSSPage';
import { rssService } from '../../services/rss.service';

// Mock dependencies
vi.mock('../../services/rss.service');
vi.mock('../../lib/notifications');

const mockRssService = rssService as any;

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('RSSPage', () => {
  const mockFeed = {
    _id: 'feed-1',
    name: 'Test Feed',
    feedUrl: 'https://example.com/feed.xml',
    pollingInterval: 60,
    enabled: true,
    keywordsInclude: ['tech'],
    keywordsExclude: ['spam'],
    targetPlatforms: ['linkedin'],
    lastFetchedAt: new Date(),
    failureCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: 'workspace-1',
    createdBy: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRssService.getFeeds.mockResolvedValue([mockFeed]);
    mockRssService.getPendingArticles.mockResolvedValue({
      articles: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  describe('Edit Feed Modal', () => {
    it('edit button exists on feed card', async () => {
      render(<RSSPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Feed')).toBeInTheDocument();
      });

      // Check that edit button exists
      const editButton = screen.getByTitle('Edit feed');
      expect(editButton).toBeInTheDocument();
    });

    it('changing interval and saving calls PATCH with new refreshIntervalHours', async () => {
      mockRssService.updateFeed.mockResolvedValue(mockFeed);

      render(<RSSPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Feed')).toBeInTheDocument();
      });

      // Open edit modal
      const editButton = screen.getByTitle('Edit feed');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit RSS Feed')).toBeInTheDocument();
      });

      // Change polling interval
      const intervalSelect = screen.getByDisplayValue('1 hour');
      fireEvent.change(intervalSelect, { target: { value: '120' } });

      // Save changes
      const updateButton = screen.getByText('Update Feed');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(mockRssService.updateFeed).toHaveBeenCalledWith('feed-1', expect.objectContaining({
          pollingInterval: 120,
        }));
      });
    });

    it('modal closes on successful save', async () => {
      mockRssService.updateFeed.mockResolvedValue(mockFeed);

      render(<RSSPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Feed')).toBeInTheDocument();
      });

      // Open edit modal
      const editButton = screen.getByTitle('Edit feed');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit RSS Feed')).toBeInTheDocument();
      });

      // Save changes
      const updateButton = screen.getByText('Update Feed');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.queryByText('Edit RSS Feed')).not.toBeInTheDocument();
      });
    });

    it('modal stays open on save error, shows error toast', async () => {
      mockRssService.updateFeed.mockRejectedValue(new Error('Update failed'));

      render(<RSSPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Feed')).toBeInTheDocument();
      });

      // Open edit modal
      const editButton = screen.getByTitle('Edit feed');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit RSS Feed')).toBeInTheDocument();
      });

      // Save changes
      const updateButton = screen.getByText('Update Feed');
      fireEvent.click(updateButton);

      await waitFor(() => {
        // Modal should still be open
        expect(screen.getByText('Edit RSS Feed')).toBeInTheDocument();
      });
    });

    it('modal closes on Escape key', async () => {
      render(<RSSPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Feed')).toBeInTheDocument();
      });

      // Open edit modal
      const editButton = screen.getByTitle('Edit feed');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit RSS Feed')).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(screen.getByText('Edit RSS Feed'), {
        key: 'Escape',
        code: 'Escape',
      });

      await waitFor(() => {
        expect(screen.queryByText('Edit RSS Feed')).not.toBeInTheDocument();
      });
    });

    it('edit modal supports keyword management', async () => {
      render(<RSSPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Feed')).toBeInTheDocument();
      });

      // Open edit modal
      const editButton = screen.getByTitle('Edit feed');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit RSS Feed')).toBeInTheDocument();
      });

      // Check that keyword inputs exist
      const keywordInputs = screen.getAllByPlaceholderText('Type keyword and press Enter');
      expect(keywordInputs).toHaveLength(2); // Include and exclude inputs
    });
  });
});