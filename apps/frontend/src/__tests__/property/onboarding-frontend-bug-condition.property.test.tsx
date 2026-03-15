import { fc, test } from '@fast-check/vitest';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';

/**
 * Frontend Bug Condition Exploration Test
 * 
 * **Validates: Requirements 2.1**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms frontend bugs exist
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * GOAL: Surface counterexamples that demonstrate frontend bugs exist
 * 
 * Expected Outcome: Test FAILS (this is correct - it proves frontend bugs exist)
 */

// Mock stores
vi.mock('@/store/onboarding.store');
vi.mock('@/store/auth.store');
vi.mock('@/lib/logger');

const mockOnboardingStore = {
  progress: null,
  isLoading: false,
  currentStepData: {},
  fetchProgress: vi.fn(),
  updateStep: vi.fn(),
  completeOnboarding: vi.fn(),
  skipOnboarding: vi.fn(),
  updateStepData: vi.fn(),
  clearOnboarding: vi.fn(),
};

const mockAuthStore = {
  user: {
    id: 'user-123',
    firstName: 'John',
    email: 'john@example.com',
  },
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Console error tracking
let consoleErrors: string[] = [];
const originalConsoleError = console.error;

describe('Frontend Bug Condition Exploration - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrors = [];
    
    // Track console errors
    console.error = (...args) => {
      consoleErrors.push(args.join(' '));
      originalConsoleError(...args);
    };
    
    // Setup default mocks
    (useOnboardingStore as any).mockReturnValue(mockOnboardingStore);
    (useAuthStore as any).mockReturnValue(mockAuthStore);
    
    // Reset store state
    mockOnboardingStore.progress = {
      userId: 'user-123',
      currentStep: 0,
      completed: false,
      completedSteps: [],
    };
    mockOnboardingStore.isLoading = false;
    mockOnboardingStore.currentStepData = {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  const renderOnboardingWizard = () => {
    return render(
      <BrowserRouter>
        <OnboardingWizard />
      </BrowserRouter>
    );
  };

  describe('Property 1: Bug Condition - Frontend Issues Detection', () => {
    
    test('console errors should NOT occur during step rendering', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          (stepNumber) => {
            // Set current step
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep: stepNumber,
              completed: false,
              completedSteps: [],
            };
            
            // Clear previous console errors
            consoleErrors = [];
            
            // Render the wizard
            renderOnboardingWizard();
            
            // EXPECTED TO FAIL: Console errors should NOT occur during rendering
            // If this fails, it confirms console error bugs exist
            expect(consoleErrors).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('new users should NOT have pre-filled data in step 1', () => {
      fc.assert(
        fc.property(
          fc.record({
            role: fc.option(fc.constantFrom('founder', 'marketer', 'agency', 'creator')),
            teamSize: fc.option(fc.constantFrom('solo', 'small', 'medium', 'large')),
            primaryGoal: fc.option(fc.constantFrom('grow-audience', 'save-time', 'manage-clients', 'increase-sales')),
          }),
          (prefilledData) => {
            // Simulate new user with potentially pre-filled data (bug condition)
            mockOnboardingStore.currentStepData = prefilledData;
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep: 0, // Welcome step
              completed: false,
              completedSteps: [],
            };
            
            renderOnboardingWizard();
            
            // EXPECTED TO FAIL: New users should have empty form data
            // If this fails, it confirms pre-filled data bugs exist
            if (prefilledData.role) {
              expect(screen.queryByText(prefilledData.role)).not.toBeInTheDocument();
            }
            if (prefilledData.teamSize) {
              expect(screen.queryByText(prefilledData.teamSize)).not.toBeInTheDocument();
            }
            if (prefilledData.primaryGoal) {
              expect(screen.queryByText(prefilledData.primaryGoal)).not.toBeInTheDocument();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Next button should advance steps when clicked', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }), // Steps 0-3 can advance
          async (currentStep) => {
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep,
              completed: false,
              completedSteps: [],
            };
            
            // Mock successful step update
            mockOnboardingStore.updateStep.mockResolvedValue(undefined);
            
            renderOnboardingWizard();
            
            // Find and click Next button
            const nextButton = screen.getByRole('button', { name: /continue|next/i });
            
            // EXPECTED TO FAIL: Next button should trigger step advancement
            // If this fails, it confirms Next button advancement bugs exist
            fireEvent.click(nextButton);
            
            await waitFor(() => {
              expect(mockOnboardingStore.updateStep).toHaveBeenCalledWith(currentStep + 1);
            }, { timeout: 1000 });
          }
        ),
        { numRuns: 15 }
      );
    });

    test('invalid forms should NOT advance to next step', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasRole: fc.boolean(),
            hasTeamSize: fc.boolean(),
            hasGoal: fc.boolean(),
          }),
          async (formState) => {
            // Only test invalid combinations
            const isValid = formState.hasRole && formState.hasTeamSize && formState.hasGoal;
            if (isValid) return; // Skip valid forms
            
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep: 0, // Welcome step with validation
              completed: false,
              completedSteps: [],
            };
            
            renderOnboardingWizard();
            
            // Simulate partial form completion
            if (formState.hasRole) {
              const roleButton = screen.getByText('Founder/CEO');
              fireEvent.click(roleButton);
            }
            if (formState.hasTeamSize) {
              const teamButton = screen.getByText('Just me');
              fireEvent.click(teamButton);
            }
            if (formState.hasGoal) {
              const goalButton = screen.getByText('Grow my audience');
              fireEvent.click(goalButton);
            }
            
            const nextButton = screen.getByRole('button', { name: /continue/i });
            
            // EXPECTED TO FAIL: Invalid forms should prevent advancement
            // If this fails, it confirms validation bypass bugs exist
            expect(nextButton).toBeDisabled();
            
            fireEvent.click(nextButton);
            
            // Should not call updateStep for invalid forms
            expect(mockOnboardingStore.updateStep).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('back button should preserve entered data', () => {
      fc.assert(
        fc.property(
          fc.record({
            role: fc.constantFrom('founder', 'marketer', 'agency', 'creator'),
            teamSize: fc.constantFrom('solo', 'small', 'medium', 'large'),
            primaryGoal: fc.constantFrom('grow-audience', 'save-time', 'manage-clients', 'increase-sales'),
          }),
          async (userData) => {
            // Start at step 1 (Connect Accounts)
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep: 1,
              completed: false,
              completedSteps: [0],
            };
            
            // Set user data from previous step
            mockOnboardingStore.currentStepData = userData;
            
            renderOnboardingWizard();
            
            // Click back button
            const backButton = screen.getByRole('button', { name: /back/i });
            fireEvent.click(backButton);
            
            // Wait for navigation
            await waitFor(() => {
              expect(mockOnboardingStore.updateStep).toHaveBeenCalledWith(0);
            });
            
            // EXPECTED TO FAIL: Data should be preserved when going back
            // If this fails, it confirms back button data loss bugs exist
            expect(mockOnboardingStore.currentStepData).toEqual(userData);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('wizard state should persist on page refresh', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          fc.record({
            role: fc.option(fc.constantFrom('founder', 'marketer', 'agency', 'creator')),
            connectedAccounts: fc.option(fc.array(fc.constantFrom('twitter', 'facebook', 'instagram'))),
          }),
          (currentStep, stepData) => {
            // Set initial state
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep,
              completed: false,
              completedSteps: Array.from({ length: currentStep }, (_, i) => i),
            };
            mockOnboardingStore.currentStepData = stepData;
            
            // Simulate page refresh by re-rendering
            const { unmount } = renderOnboardingWizard();
            unmount();
            
            // EXPECTED TO FAIL: State should be preserved after refresh
            // If this fails, it confirms state persistence bugs exist
            expect(mockOnboardingStore.fetchProgress).toHaveBeenCalled();
            
            // Re-render after "refresh"
            renderOnboardingWizard();
            
            // State should be maintained
            expect(mockOnboardingStore.progress?.currentStep).toBe(currentStep);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('mobile rendering should work correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 320, max: 768 }), // Mobile viewport widths
          fc.integer({ min: 0, max: 4 }),
          (viewportWidth, stepNumber) => {
            // Set mobile viewport
            Object.defineProperty(window, 'innerWidth', {
              writable: true,
              configurable: true,
              value: viewportWidth,
            });
            
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep: stepNumber,
              completed: false,
              completedSteps: [],
            };
            
            const { container } = renderOnboardingWizard();
            
            // EXPECTED TO FAIL: Mobile rendering should work without issues
            // If this fails, it confirms mobile rendering bugs exist
            
            // Check for responsive classes
            const wizardContainer = container.querySelector('.min-h-screen');
            expect(wizardContainer).toBeInTheDocument();
            
            // Check for mobile-friendly navigation
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
              const styles = window.getComputedStyle(button);
              // Buttons should be touch-friendly (min 44px height)
              expect(parseInt(styles.minHeight) || 0).toBeGreaterThanOrEqual(44);
            });
          }
        ),
        { numRuns: 8 }
      );
    });

    test('keyboard navigation should work correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          (stepNumber) => {
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep: stepNumber,
              completed: false,
              completedSteps: [],
            };
            
            renderOnboardingWizard();
            
            // EXPECTED TO FAIL: All interactive elements should be keyboard accessible
            // If this fails, it confirms keyboard navigation bugs exist
            
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
              // All buttons should be focusable
              expect(button.tabIndex).toBeGreaterThanOrEqual(0);
              
              // Buttons should have proper ARIA attributes
              expect(button).toHaveAttribute('type');
            });
            
            // Form inputs should be keyboard accessible
            const inputs = screen.queryAllByRole('textbox');
            inputs.forEach(input => {
              expect(input.tabIndex).toBeGreaterThanOrEqual(0);
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    test('ARIA labels should be present for accessibility', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }),
          (stepNumber) => {
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep: stepNumber,
              completed: false,
              completedSteps: [],
            };
            
            renderOnboardingWizard();
            
            // EXPECTED TO FAIL: All form elements should have proper ARIA labels
            // If this fails, it confirms accessibility violation bugs exist
            
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
              // Buttons should have accessible names
              expect(button).toHaveAccessibleName();
            });
            
            // Check for proper heading structure
            const headings = screen.getAllByRole('heading');
            expect(headings.length).toBeGreaterThan(0);
            
            // Main content should have proper landmarks
            const main = screen.queryByRole('main');
            if (!main) {
              // Should have main landmark or equivalent
              expect(screen.getByText(/welcome/i).closest('[role="main"]')).toBeInTheDocument();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    // Concrete examples for sanity checks
    it('concrete example: Next button click should advance from step 0 to step 1', async () => {
      mockOnboardingStore.progress = {
        userId: 'user-123',
        currentStep: 0,
        completed: false,
        completedSteps: [],
      };
      
      mockOnboardingStore.updateStep.mockResolvedValue(undefined);
      
      renderOnboardingWizard();
      
      // Fill out required fields
      fireEvent.click(screen.getByText('Founder/CEO'));
      fireEvent.click(screen.getByText('Just me'));
      fireEvent.click(screen.getByText('Grow my audience'));
      
      const nextButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(mockOnboardingStore.updateStep).toHaveBeenCalledWith(1);
      });
    });

    it('concrete example: console errors should not occur on step render', () => {
      consoleErrors = [];
      
      mockOnboardingStore.progress = {
        userId: 'user-123',
        currentStep: 0,
        completed: false,
        completedSteps: [],
      };
      
      renderOnboardingWizard();
      
      expect(consoleErrors).toHaveLength(0);
    });

    it('concrete example: incomplete form should disable Next button', () => {
      mockOnboardingStore.progress = {
        userId: 'user-123',
        currentStep: 0,
        completed: false,
        completedSteps: [],
      };
      
      renderOnboardingWizard();
      
      // Only fill role, leave team size and goal empty
      fireEvent.click(screen.getByText('Founder/CEO'));
      
      const nextButton = screen.getByRole('button', { name: /continue/i });
      expect(nextButton).toBeDisabled();
    });
  });
});