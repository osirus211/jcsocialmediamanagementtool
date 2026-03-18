import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../../../pages/auth/Login';
import { useAuthStore } from '../../../store/auth.store';

// Mock the auth store
vi.mock('../../../store/auth.store');

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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

describe('LoginPage', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      user: null,
      isAuthenticated: false,
      logout: vi.fn(),
      register: vi.fn(),
      refreshToken: vi.fn(),
      clearError: vi.fn(),
      error: null
    });
  });

  it('renders login form correctly', () => {
    renderWithRouter(<LoginPage />);

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('displays validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Touch the fields to trigger validation
    await user.click(emailInput);
    await user.click(passwordInput);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Ensure login was not called due to validation errors
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('displays validation error for invalid email format', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'somepassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
    });
    
    // Ensure login was not called due to validation error
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Password123');
    });
  });

  it('shows loading state during login', () => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: true,
      user: null,
      isAuthenticated: false,
      logout: vi.fn(),
      register: vi.fn(),
      refreshToken: vi.fn(),
      clearError: vi.fn(),
      error: null
    });

    renderWithRouter(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /signing in/i });
    expect(submitButton).toBeDisabled();
  });

  it('displays error message when login fails', async () => {
    const errorMessage = 'Invalid credentials';
    const mockLoginFail = vi.fn().mockRejectedValue(new Error(errorMessage));
    
    mockUseAuthStore.mockReturnValue({
      login: mockLoginFail,
      isLoading: false,
      user: null,
      isAuthenticated: false,
      logout: vi.fn(),
      register: vi.fn(),
      refreshToken: vi.fn(),
      clearError: vi.fn(),
      error: null
    });

    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const passwordInput = screen.getByLabelText(/^password$/i);
    const toggleButton = screen.getByLabelText(/show password/i);

    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/hide password/i)).toBeInTheDocument();

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('has proper accessibility attributes', () => {
    renderWithRouter(<LoginPage />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', 'Sign in to your account');

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('aria-required', 'true');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute('aria-required', 'true');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
  });

  it('shows OAuth buttons', () => {
    renderWithRouter(<LoginPage />);

    expect(screen.getByLabelText(/continue with google/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/continue with github/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/continue with apple/i)).toBeInTheDocument();
  });

  it('has links to other auth pages', () => {
    renderWithRouter(<LoginPage />);

    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/auth/forgot-password');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/auth/register');
  });

  it('handles keyboard navigation properly', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Tab through form elements
    await user.tab();
    expect(emailInput).toHaveFocus();

    await user.tab();
    expect(passwordInput).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/show password/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveFocus();

    await user.tab();
    expect(submitButton).toHaveFocus();
  });
});