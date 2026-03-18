import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RegisterPage } from '../../../pages/auth/Register';
import { useAuthStore } from '../../../store/auth.store';

// Mock the auth store
vi.mock('../../../store/auth.store');

// Create mockNavigate at module level
const mockNavigate = vi.fn();

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseAuthStore = vi.mocked(useAuthStore);

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('RegisterPage', () => {
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuthStore.mockReturnValue({
      register: mockRegister,
      isLoading: false,
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      clearError: vi.fn(),
      error: null
    });
  });

  it('renders registration form correctly', () => {
    renderWithRouter(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('displays validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterPage />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Touch the fields to trigger validation
    await user.click(firstNameInput);
    await user.click(lastNameInput);
    await user.click(emailInput);
    await user.click(passwordInput);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays validation error for invalid email format', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('displays validation error for weak password', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterPage />);

    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(passwordInput, 'weak');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterPage />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');
    await user.type(emailInput, 'john.doe@example.com');
    await user.type(passwordInput, 'Password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123'
      });
    });
  });

  it('shows loading state during registration', () => {
    mockUseAuthStore.mockReturnValue({
      register: mockRegister,
      isLoading: true,
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      clearError: vi.fn(),
      error: null
    });

    renderWithRouter(<RegisterPage />);

    const submitButton = screen.getByRole('button', { name: /creating account/i });
    expect(submitButton).toBeDisabled();
  });

  it('displays error message when registration fails', async () => {
    const errorMessage = 'User already exists';
    const mockRegisterFail = vi.fn().mockRejectedValue(new Error(errorMessage));
    
    mockUseAuthStore.mockReturnValue({
      register: mockRegisterFail,
      isLoading: false,
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      clearError: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithRouter(<RegisterPage />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    await user.type(firstNameInput, 'John');
    await user.type(lastNameInput, 'Doe');
    await user.type(emailInput, 'john.doe@example.com');
    await user.type(passwordInput, 'Password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', () => {
    renderWithRouter(<RegisterPage />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', 'Create your account');

    const firstNameInput = screen.getByLabelText(/first name/i);
    expect(firstNameInput).toHaveAttribute('aria-required', 'true');

    const lastNameInput = screen.getByLabelText(/last name/i);
    expect(lastNameInput).toHaveAttribute('aria-required', 'true');

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('aria-required', 'true');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('aria-required', 'true');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
  });

  it('shows password requirements help text', () => {
    renderWithRouter(<RegisterPage />);

    expect(screen.getByText(/must be 8\+ characters with uppercase, lowercase, and number/i)).toBeInTheDocument();
  });

  it('has link to login page', () => {
    renderWithRouter(<RegisterPage />);

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/auth/login');
  });

  it('handles keyboard navigation properly', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterPage />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Tab through form elements
    await user.tab();
    expect(firstNameInput).toHaveFocus();

    await user.tab();
    expect(lastNameInput).toHaveFocus();

    await user.tab();
    expect(emailInput).toHaveFocus();

    await user.tab();
    expect(passwordInput).toHaveFocus();

    await user.tab();
    expect(submitButton).toHaveFocus();
  });

  it('displays field-specific error messages with proper ARIA attributes', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterPage />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Touch the field to trigger validation
    await user.click(firstNameInput);
    await user.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByText(/first name is required/i);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
      expect(firstNameInput).toHaveAttribute('aria-describedby', 'firstName-error');
    }, { timeout: 3000 });
  });
});