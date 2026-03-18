import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../../../pages/auth/ForgotPassword';
import { apiClient } from '../../../lib/api-client';

// Mock the API client
vi.mock('../../../lib/api-client');

const mockApiClient = vi.mocked(apiClient);

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forgot password form correctly', () => {
    renderWithRouter(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
    expect(screen.getByText(/enter your email address and we'll send you a link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('displays validation error for empty email', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    // Touch the field to trigger validation
    await user.click(emailInput);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays validation error for invalid email format', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid email', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockResolvedValue({ data: { message: 'Reset email sent' } });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'test@example.com'
      });
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /sending reset link/i })).toBeDisabled();
  });

  it('displays success message after successful submission', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockResolvedValue({ data: { message: 'Reset email sent' } });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument();
      expect(screen.getByText(/we've sent a password reset link to/i)).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('displays error message when submission fails', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Failed to send reset email';
    mockApiClient.post.mockRejectedValue({
      response: { data: { message: errorMessage } }
    });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('allows user to try different email after success', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockResolvedValue({ data: { message: 'Reset email sent' } });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument();
    });

    const tryDifferentEmailButton = screen.getByRole('button', { name: /try entering a different email address/i });
    await user.click(tryDifferentEmailButton);

    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    renderWithRouter(<ForgotPasswordPage />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', 'Request password reset');

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('aria-required', 'true');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
  });

  it('has links to other auth pages', () => {
    renderWithRouter(<ForgotPasswordPage />);

    expect(screen.getByRole('link', { name: /return to sign in page/i })).toHaveAttribute('href', '/auth/login');
  });

  it('displays proper ARIA attributes for error messages', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByText(/please enter a valid email address/i);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
    });
  });

  it('has proper accessibility labels for buttons and links', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockResolvedValue({ data: { message: 'Reset email sent' } });

    renderWithRouter(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try entering a different email address/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /return to sign in page/i })).toBeInTheDocument();
    });
  });
});