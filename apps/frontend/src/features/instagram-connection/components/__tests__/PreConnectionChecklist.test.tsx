/**
 * Unit Tests for PreConnectionChecklist
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreConnectionChecklist } from '../PreConnectionChecklist';

describe('PreConnectionChecklist', () => {
  const mockOnProceed = vi.fn();
  const mockOnShowInstructions = vi.fn();

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    mockOnProceed.mockClear();
    mockOnShowInstructions.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Rendering (Requirements 1.1, 1.2)', () => {
    it('should render all three checklist items', () => {
      render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      expect(screen.getByLabelText(/Instagram Business or Creator Account/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Linked to Facebook Page/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Admin Access to Facebook Page/i)).toBeInTheDocument();
    });

    it('should mark all items as required', () => {
      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const requiredMarkers = container.querySelectorAll('.text-red-500');
      expect(requiredMarkers).toHaveLength(3);
    });

    it('should render proceed button', () => {
      render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      expect(screen.getByText('Proceed to Connect')).toBeInTheDocument();
    });

    it('should render help button', () => {
      render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      expect(screen.getByText(/Need Help\? View Setup Instructions/i)).toBeInTheDocument();
    });
  });

  describe('Checkbox Interactions (Requirement 1.3)', () => {
    it('should toggle checkbox when clicked', () => {
      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('should expand and collapse item details', () => {
      render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const showDetailsButton = screen.getAllByText('Show details')[0];
      fireEvent.click(showDetailsButton);

      expect(screen.getByText(/Personal accounts cannot be connected via API/i)).toBeInTheDocument();

      const hideDetailsButton = screen.getByText('Hide details');
      fireEvent.click(hideDetailsButton);

      expect(screen.queryByText(/Personal accounts cannot be connected via API/i)).not.toBeInTheDocument();
    });
  });

  describe('Button Enable/Disable Logic (Requirement 1.4)', () => {
    it('should disable proceed button when no items are checked', () => {
      render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const proceedButton = screen.getByText('Proceed to Connect');
      expect(proceedButton).toBeDisabled();
    });

    it('should disable proceed button when only some items are checked', () => {
      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      const proceedButton = screen.getByText('Proceed to Connect');
      expect(proceedButton).toBeDisabled();
    });

    it('should enable proceed button when all items are checked', () => {
      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => fireEvent.click(checkbox));

      const proceedButton = screen.getByText('Proceed to Connect');
      expect(proceedButton).not.toBeDisabled();
    });

    it('should call onProceed when proceed button is clicked', () => {
      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => fireEvent.click(checkbox));

      const proceedButton = screen.getByText('Proceed to Connect');
      fireEvent.click(proceedButton);

      expect(mockOnProceed).toHaveBeenCalledTimes(1);
    });

    it('should call onShowInstructions when help button is clicked', () => {
      render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const helpButton = screen.getByText(/Need Help\? View Setup Instructions/i);
      fireEvent.click(helpButton);

      expect(mockOnShowInstructions).toHaveBeenCalledTimes(1);
    });
  });

  describe('localStorage Persistence (Requirement 1.4)', () => {
    it('should save checklist state to localStorage', () => {
      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(checkbox);

      const stored = localStorage.getItem('instagram-connection-checklist');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed[0].checked).toBe(true);
    });

    it('should restore checklist state from localStorage', () => {
      // Pre-populate localStorage
      const initialState = [
        { id: 'business_account', checked: true },
        { id: 'facebook_page', checked: false },
        { id: 'admin_access', checked: true },
      ];
      localStorage.setItem('instagram-connection-checklist', JSON.stringify(initialState));

      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
      expect((checkboxes[2] as HTMLInputElement).checked).toBe(true);
    });

    it('should clear localStorage when proceeding', () => {
      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => fireEvent.click(checkbox));

      const proceedButton = screen.getByText('Proceed to Connect');
      fireEvent.click(proceedButton);

      const stored = localStorage.getItem('instagram-connection-checklist');
      expect(stored).toBeNull();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('instagram-connection-checklist', 'invalid json');

      const { container } = render(
        <PreConnectionChecklist
          onProceed={mockOnProceed}
          onShowInstructions={mockOnShowInstructions}
        />
      );

      // Should render with default unchecked state
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        expect((checkbox as HTMLInputElement).checked).toBe(false);
      });
    });
  });
});
