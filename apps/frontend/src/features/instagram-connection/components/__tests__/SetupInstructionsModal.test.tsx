/**
 * Unit Tests for SetupInstructionsModal
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupInstructionsModal } from '../SetupInstructionsModal';

describe('SetupInstructionsModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe('Rendering (Requirements 2.1, 2.5)', () => {
    it('should not render when isOpen is false', () => {
      render(
        <SetupInstructionsModal
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Instagram Setup Instructions')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Instagram Setup Instructions')).toBeInTheDocument();
    });

    it('should render all four instruction steps', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Check progress indicators (4 steps)
      const progressBars = screen.getAllByRole('button', { name: /Go to step/i });
      expect(progressBars).toHaveLength(4);
    });

    it('should render mobile and web tabs', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/📱 Mobile App/i)).toBeInTheDocument();
      expect(screen.getByText(/💻 Web Browser/i)).toBeInTheDocument();
    });

    it('should render help links', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Need more help\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Instagram Business Account Guide/i)).toBeInTheDocument();
      expect(screen.getByText(/Link Instagram to Facebook Page/i)).toBeInTheDocument();
    });
  });

  describe('Tab Switching (Requirement 2.6)', () => {
    it('should show mobile instructions by default', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Open the Instagram app on your phone/i)).toBeInTheDocument();
    });

    it('should switch to web instructions when web tab is clicked', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const webTab = screen.getByText(/💻 Web Browser/i);
      fireEvent.click(webTab);

      expect(screen.getByText(/Log in to Instagram on your web browser/i)).toBeInTheDocument();
    });

    it('should switch back to mobile instructions', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const webTab = screen.getByText(/💻 Web Browser/i);
      fireEvent.click(webTab);

      const mobileTab = screen.getByText(/📱 Mobile App/i);
      fireEvent.click(mobileTab);

      expect(screen.getByText(/Open the Instagram app on your phone/i)).toBeInTheDocument();
    });
  });

  describe('Step Navigation (Requirements 2.1, 2.2, 2.3, 2.4)', () => {
    it('should start at convert step by default', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Convert to Business Account')).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    it('should navigate to next step when Next button is clicked', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const nextButton = screen.getByText(/Next →/i);
      fireEvent.click(nextButton);

      expect(screen.getByText('Create or Select Facebook Page')).toBeInTheDocument();
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    });

    it('should navigate to previous step when Previous button is clicked', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Go to step 2
      const nextButton = screen.getByText(/Next →/i);
      fireEvent.click(nextButton);

      // Go back to step 1
      const previousButton = screen.getByText(/← Previous/i);
      fireEvent.click(previousButton);

      expect(screen.getByText('Convert to Business Account')).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    it('should disable Previous button on first step', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const previousButton = screen.getByText(/← Previous/i);
      expect(previousButton).toBeDisabled();
    });

    it('should show Done button on last step', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Navigate to last step
      const nextButton = screen.getByText(/Next →/i);
      fireEvent.click(nextButton); // Step 2
      fireEvent.click(nextButton); // Step 3
      fireEvent.click(nextButton); // Step 4

      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.queryByText(/Next →/i)).not.toBeInTheDocument();
    });

    it('should allow jumping to specific step via progress indicator', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const step3Button = screen.getByRole('button', { name: /Go to step 3/i });
      fireEvent.click(step3Button);

      expect(screen.getByText('Link Instagram to Facebook Page')).toBeInTheDocument();
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
    });
  });

  describe('Initial Step (Requirement 2.1)', () => {
    it('should start at specified initial step', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
          initialStep="link"
        />
      );

      expect(screen.getByText('Link Instagram to Facebook Page')).toBeInTheDocument();
    });
  });

  describe('Modal Close (Requirement 2.1)', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const { container } = render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const backdrop = container.querySelector('.bg-black.bg-opacity-50');
      fireEvent.click(backdrop!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Done button is clicked on last step', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Navigate to last step
      const nextButton = screen.getByText(/Next →/i);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      const doneButton = screen.getByText('Done');
      fireEvent.click(doneButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content Display (Requirements 2.2, 2.3, 2.4)', () => {
    it('should display step title and description', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Convert to Business Account')).toBeInTheDocument();
      expect(screen.getByText(/Convert your Instagram account to a Business or Creator account type/i)).toBeInTheDocument();
    });

    it('should display numbered instructions', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Check for numbered circles
      const { container } = render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const numberedItems = container.querySelectorAll('.bg-blue-100');
      expect(numberedItems.length).toBeGreaterThan(0);
    });

    it('should display all four steps with correct titles', () => {
      render(
        <SetupInstructionsModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const nextButton = screen.getByText(/Next →/i);

      // Step 1
      expect(screen.getByText('Convert to Business Account')).toBeInTheDocument();

      // Step 2
      fireEvent.click(nextButton);
      expect(screen.getByText('Create or Select Facebook Page')).toBeInTheDocument();

      // Step 3
      fireEvent.click(nextButton);
      expect(screen.getByText('Link Instagram to Facebook Page')).toBeInTheDocument();

      // Step 4
      fireEvent.click(nextButton);
      expect(screen.getByText('Verify Connection')).toBeInTheDocument();
    });
  });
});
