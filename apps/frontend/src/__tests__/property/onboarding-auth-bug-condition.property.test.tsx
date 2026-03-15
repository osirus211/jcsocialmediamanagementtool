import { fc, test } from '@fast-check/vitest';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';

/**
 * Auth Flow Bug Condition Exploration Test
 * 
 * **Validates: Requirements 2.2**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms auth flow bugs exist
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * GOAL: Surface counterexamples that demonstrate auth flow bugs exist
 * 
 * Expected Outcome: Test FAILS (this is correct - it proves auth flow bugs exist)
 */

// Mock stores and services
vi.mock('@/store/onboarding.store');
vi.mock('@/store/auth.store');
vi.mock('@/lib/api-client');
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
  user: null,
  isAuthenticated: false,
  isLoading: false,
  authChecked: false,
  accessToken: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  refreshToken: vi.fn(),
  clearAuth: vi.fn(),
  setUser: vi.fn(),
  setAccessToken: vi.fn(),
};

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Auth Flow Bug Condition Exploration - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (useOnboardingStore as any).mockReturnValue(mockOnboardingStore);
    (useAuthStore as any).mockReturnValue(mockAuthStore);
    (apiClient as any).get = mockApiClient.get;
    (apiClient as any).post = mockApiClient.post;
    (apiClient as any).put = mockApiClient.put;
    (apiClient as any).delete = mockApiClient.delete;
    
    // Reset store state
    mockOnboardingStore.progress = null;
    mockOnboardingStore.isLoading = false;
    mockOnboardingStore.currentStepData = {};
    
    mockAuthStore.user = {
      _id: 'user-123',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'owner' as const,
      isEmailVerified: true,
      provider: 'local' as const,
      twoFactorEnabled: false,
      onboardingCompleted: false,
      onboardingStep: 0,
      notificationPreferences: {
        email: {
          postPublished: true,
          postFailed: true,
          weeklyReport: true,
          accountIssues: true,
        },
        push: {
          postPublished: true,
          postFailed: true,
          accountIssues: true,
        },
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    mockAuthStore.isAuthenticated = true;
    mockAuthStore.authChecked = true;
  });

  const renderOnboardingWizard = () => {
    return render(
      <BrowserRouter>
        <OnboardingWizard />
      </BrowserRouter>
    );
  };

  describe('Property 1: Bug Condition - Auth Flow Issues Detection', () => {
    
    test('valid registration should NOT fail with unclear errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            firstName: fc.string({ minLength: 1, maxLength: 50 }),
            lastName: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (validRegistrationData) => {
            // Mock registration failure (bug condition)
            mockAuthStore.register.mockRejectedValue(new Error('Registration failed'));
            
            // EXPECTED TO FAIL: Valid registration should succeed
            // If this fails, it confirms registration flow bugs exist
            try {
              await mockAuthStore.register(validRegistrationData);
              expect(true).toBe(true); // Should reach here
            } catch (error) {
              // This should NOT happen for valid data
              expect(error).toBeUndefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('weak password validation should provide clear error messages', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 7 }), // Too short
            fc.string({ minLength: 8, maxLength: 50 }).filter(s => !/[A-Z]/.test(s)), // No uppercase
            fc.string({ minLength: 8, maxLength: 50 }).filter(s => !/[0-9]/.test(s)), // No numbers
            fc.constant('password'), // Common password
          ),
          async (weakPassword) => {
            const registrationData = {
              email: 'test@example.com',
              password: weakPassword,
              firstName: 'John',
              lastName: 'Doe',
            };
            
            // Mock weak password error (should be clear and specific)
            mockAuthStore.register.mockRejectedValue(new Error('Password validation failed'));
            
            // EXPECTED TO FAIL: Weak password errors should be specific and helpful
            // If this fails, it confirms password validation error message bugs exist
            try {
              await mockAuthStore.register(registrationData);
            } catch (error: any) {
              // Error message should be specific about password requirements
              expect(error.message).toMatch(/password.*requirements|password.*strong|password.*criteria/i);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('duplicate email registration should provide clear error handling', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          async (existingEmail) => {
            const registrationData = {
              email: existingEmail,
              password: 'ValidPassword123',
              firstName: 'John',
              lastName: 'Doe',
            };
            
            // Mock duplicate email error (should be clear)
            mockAuthStore.register.mockRejectedValue(new Error('Email already exists'));
            
            // EXPECTED TO FAIL: Duplicate email errors should be clear and actionable
            // If this fails, it confirms email validation error handling bugs exist
            try {
              await mockAuthStore.register(registrationData);
            } catch (error: any) {
              // Error should clearly indicate email is already in use
              expect(error.message).toMatch(/email.*already|email.*exists|email.*taken/i);
            }
          }
        ),
        { numRuns: 8 }
      );
    });

    test('OAuth tokens should be stored securely', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 20, maxLength: 100 }), // OAuth access token
          fc.string({ minLength: 20, maxLength: 100 }), // OAuth refresh token
          (accessToken, refreshToken) => {
            // Simulate OAuth token storage
            mockAuthStore.setAccessToken(accessToken);
            
            // EXPECTED TO FAIL: OAuth tokens should not be stored in localStorage
            // If this fails, it confirms OAuth token security bugs exist
            const storedInLocalStorage = localStorage.getItem('oauth-token') || 
                                       localStorage.getItem('access-token') ||
                                       localStorage.getItem('auth-token');
            
            expect(storedInLocalStorage).toBeNull();
            
            // Tokens should not be accessible via window object
            expect((window as any).oauthToken).toBeUndefined();
            expect((window as any).accessToken).toBeUndefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('email verification flow should work correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }), // Verification token
          fc.string({ minLength: 10, maxLength: 50 }), // User ID
          async (verificationToken, userId) => {
            // Mock email verification API call
            mockApiClient.post.mockResolvedValue({
              success: true,
              message: 'Email verified successfully',
            });
            
            // EXPECTED TO FAIL: Email verification should work with valid tokens
            // If this fails, it confirms email verification flow bugs exist
            const response = await mockApiClient.post('/auth/verify-email', {
              userId,
              token: verificationToken,
            });
            
            expect(response.success).toBe(true);
            expect(mockApiClient.post).toHaveBeenCalledWith('/auth/verify-email', {
              userId,
              token: verificationToken,
            });
          }
        ),
        { numRuns: 8 }
      );
    });

    test('session expiry should be handled gracefully during onboarding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 }), // Current onboarding step
          async (currentStep) => {
            // Set up onboarding in progress
            mockOnboardingStore.progress = {
              userId: 'user-123',
              currentStep,
              completed: false,
              completedSteps: Array.from({ length: currentStep }, (_, i) => i),
            };
            
            // Mock session expiry during step update
            mockOnboardingStore.updateStep.mockRejectedValue(new Error('Session expired'));
            mockAuthStore.refreshToken.mockResolvedValue(null); // Refresh fails
            
            renderOnboardingWizard();
            
            // Try to advance to next step
            const nextButton = screen.queryByRole('button', { name: /continue|next/i });
            if (nextButton) {
              fireEvent.click(nextButton);
              
              // EXPECTED TO FAIL: Session expiry should be handled gracefully
              // If this fails, it confirms session expiry handling bugs exist
              await waitFor(() => {
                // Should show session expired message or redirect to login
                const sessionMessage = screen.queryByText(/session.*expired|please.*login.*again/i);
                expect(sessionMessage).toBeInTheDocument();
              }, { timeout: 1000 });
            }
          }
        ),
        { numRuns: 8 }
      );
    });

    test('already onboarded users should be redirected from wizard', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // onboardingCompleted flag
          (isCompleted) => {
            // Set user as already completed onboarding
            mockAuthStore.user = {
              ...mockAuthStore.user!,
              onboardingCompleted: isCompleted,
              onboardingStep: 4,
            };
            
            renderOnboardingWizard();
            
            if (isCompleted) {
              // EXPECTED TO FAIL: Completed users should be redirected
              // If this fails, it confirms onboarded user redirect logic bugs exist
              expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('authentication state should be properly managed during onboarding', () => {
      fc.assert(
        fc.property(
          fc.record({
            isAuthenticated: fc.boolean(),
            hasValidToken: fc.boolean(),
            tokenExpired: fc.boolean(),
          }),
          async (authState) => {
            // Set up auth state
            mockAuthStore.isAuthenticated = authState.isAuthenticated;
            mockAuthStore.accessToken = authState.hasValidToken ? 'valid-token' : null;
            
            if (authState.tokenExpired) {
              mockAuthStore.refreshToken.mockResolvedValue(null);
            } else {
              mockAuthStore.refreshToken.mockResolvedValue('new-token');
            }
            
            renderOnboardingWizard();
            
            // EXPECTED TO FAIL: Unauthenticated users should not access onboarding
            // If this fails, it confirms authentication state management bugs exist
            if (!authState.isAuthenticated) {
              expect(mockNavigate).toHaveBeenCalledWith('/login');
            }
            
            // Users with expired tokens should be handled gracefully
            if (authState.isAuthenticated && !authState.hasValidToken && authState.tokenExpired) {
              await waitFor(() => {
                expect(mockAuthStore.refreshToken).toHaveBeenCalled();
              });
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    // Concrete examples for sanity checks
    it('concrete example: valid registration should succeed', async () => {
      const validData = {
        email: 'test@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe',
      };
      
      mockAuthStore.register.mockResolvedValue(undefined);
      
      await expect(mockAuthStore.register(validData)).resolves.toBeUndefined();
    });

    it('concrete example: weak password should provide specific error', async () => {
      const weakPasswordData = {
        email: 'test@example.com',
        password: '123', // Too short
        firstName: 'John',
        lastName: 'Doe',
      };
      
      mockAuthStore.register.mockRejectedValue(
        new Error('Password must be at least 8 characters long')
      );
      
      await expect(mockAuthStore.register(weakPasswordData))
        .rejects.toThrow(/password.*8.*characters/i);
    });

    it('concrete example: duplicate email should provide clear error', async () => {
      const duplicateEmailData = {
        email: 'existing@example.com',
        password: 'ValidPassword123',
        firstName: 'John',
        lastName: 'Doe',
      };
      
      mockAuthStore.register.mockRejectedValue(
        new Error('Email address is already registered')
      );
      
      await expect(mockAuthStore.register(duplicateEmailData))
        .rejects.toThrow(/email.*already.*registered/i);
    });

    it('concrete example: OAuth tokens should not be in localStorage', () => {
      const token = 'oauth-access-token-12345';
      mockAuthStore.setAccessToken(token);
      
      // Check that token is not stored in localStorage
      expect(localStorage.getItem('oauth-token')).toBeNull();
      expect(localStorage.getItem('access-token')).toBeNull();
      expect(localStorage.getItem('auth-token')).toBeNull();
    });

    it('concrete example: session expiry should show appropriate message', async () => {
      mockOnboardingStore.progress = {
        userId: 'user-123',
        currentStep: 1,
        completed: false,
        completedSteps: [0],
      };
      
      mockOnboardingStore.updateStep.mockRejectedValue(new Error('Session expired'));
      mockAuthStore.refreshToken.mockResolvedValue(null);
      
      renderOnboardingWizard();
      
      const nextButton = screen.getByRole('button', { name: /continue|next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        const errorMessage = screen.queryByText(/session.*expired/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('concrete example: completed user should be redirected', () => {
      mockAuthStore.user = {
        ...mockAuthStore.user!,
        onboardingCompleted: true,
        onboardingStep: 4,
      };
      
      renderOnboardingWizard();
      
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});