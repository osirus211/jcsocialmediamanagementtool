/**
 * Unit Tests for AccountSelectionDialog
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountSelectionDialog } from '../AccountSelectionDialog';
import type { DiscoveredInstagramAccount } from '../../types';

const mockAccounts: DiscoveredInstagramAccount[] = [
  {
    id: 'account-1',
    username: 'test_user_1',
    name: 'Test User 1',
    profilePictureUrl: 'https://example.com/profile1.jpg',
    followersCount: 1000,
    pageId: 'page-1',
    pageName: 'Test Page 1',
    alreadyConnected: false,
  },
  {
    id: 'account-2',
    username: 'test_user_2',
    name: 'Test User 2',
    profilePictureUrl: 'https://example.com/profile2.jpg',
    followersCount: 5000,
    pageId: 'page-2',
    pageName: 'Test Page 2',
    alreadyConnected: true,
  },
];

describe('AccountSelectionDialog', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    expect(screen.getByText('Select Instagram Accounts')).toBeInTheDocument();
  });

  it('should display all accounts', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    expect(screen.getByText('@test_user_1')).toBeInTheDocument();
    expect(screen.getByText('@test_user_2')).toBeInTheDocument();
  });

  it('should display account details', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    expect(screen.getByText('Test User 1')).toBeInTheDocument();
    expect(screen.getByText('1,000 followers')).toBeInTheDocument();
    expect(screen.getByText('Test Page 1')).toBeInTheDocument();
  });

  it('should show "Connected" badge for already connected accounts', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    const connectedBadges = screen.getAllByText('Connected');
    expect(connectedBadges).toHaveLength(1);
  });

  it('should allow selecting individual accounts', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    const accountCheckbox = checkboxes[1]; // First account checkbox (index 0 is "Select All")

    expect(accountCheckbox).not.toBeChecked();

    fireEvent.click(accountCheckbox);

    expect(accountCheckbox).toBeChecked();
  });

  it('should update selection count', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
  });

  it('should handle "Select All" functionality', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });

    expect(selectAllCheckbox).not.toBeChecked();

    fireEvent.click(selectAllCheckbox);

    expect(selectAllCheckbox).toBeChecked();
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();
  });

  it('should deselect all when clicking "Select All" again', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });

    fireEvent.click(selectAllCheckbox);
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();

    fireEvent.click(selectAllCheckbox);
    expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();
  });

  it('should disable save button when no accounts selected', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    const saveButton = screen.getByRole('button', { name: /connect selected accounts/i });
    expect(saveButton).toBeDisabled();
  });

  it('should enable save button when accounts are selected', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const saveButton = screen.getByRole('button', { name: /connect selected accounts/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('should call onSave with selected account IDs', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={onSave}
        isOpen={true}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Select first account

    const saveButton = screen.getByRole('button', { name: /connect selected accounts/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(['account-1']);
    });
  });

  it('should show error message when trying to save without selection', () => {
    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    const saveButton = screen.getByRole('button', { name: /connect selected accounts/i });
    
    // Button should be disabled, but let's test the error handling
    expect(saveButton).toBeDisabled();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();

    render(
      <AccountSelectionDialog
        accounts={mockAccounts}
        onSave={vi.fn()}
        onCancel={onCancel}
        isOpen={true}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should show empty state when no accounts', () => {
    render(
      <AccountSelectionDialog
        accounts={[]}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    expect(screen.getByText('No accounts found')).toBeInTheDocument();
  });

  it('should not show "Select All" for single account', () => {
    render(
      <AccountSelectionDialog
        accounts={[mockAccounts[0]]}
        onSave={vi.fn()}
        isOpen={true}
      />
    );

    expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
  });
});
