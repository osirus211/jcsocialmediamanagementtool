import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ResetPasswordPage } from '../../../pages/auth/ResetPassword';
import { apiClient } from '../../../lib/api-client';

// Mock the API client
vi.mock('../../../lib/api-client');

const mockApiClient = vi.mocked(apiClient);

// Mock useSearchParams
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
    useNavigate: () => vi.fn(),
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.set('token', 'valid-reset-token');
  });

  it('renders reset password form correctly with valid token', () => {
    renderWithRouter(<ResetPasswordPage />);

    expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows error message for missing token', () => {
    mockSearchParams.delete('token');
    renderWithRouter(<ResetPasswordPage />);

    expect(screen.getByRole('heading', { name: /invalid reset link/i })).toBeInTheDocument();
    expect(screen.getByText(/this password reset link is invalid or has expired/i)).toBeInTheDocument();
  });

  it('displays validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const submitButton = screen.getByRole('button', { name: /reset password/i });
    await user.click(submitButton);

    // The component shows password strength indicator instead of validation messages
    // Check that the submit button is disabled for empty/weak passwords
    expect(submitButton).toBeDisabled();
  });

  it('displays validation error for weak password', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    await user.type(passwordInput, 'weak');
    await user.click(submitButton);

    await waitFor(() => {
      // Check that password strength shows "Very Weak" and submit is disabled
      expect(screen.getByText(/very weak/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  it('displays validation error for mismatched passwords', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    await user.type(passwordInput, 'Password123');
    await user.type(confirmPasswordInput, 'DifferentPassword123');
    await user.click(submitButton);

    await waitFor(() => {
      // Check that submit button is disabled for mismatched passwords
      expect(submitButton).toBeDisabled();
    });
  });

  it('shows password strength indicator', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');

    await user.type(passwordInput, 'Password123');

    await waitFor(() => {
      expect(screen.getByText(/password strength/i)).toBeInTheDocument();
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('shows password requirements checklist', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');

    await user.type(passwordInput, 'Password123');

    await waitFor(() => {
      expect(screen.getByText(/8\+ characters/i)).toBeInTheDocument();
      expect(screen.getByText(/uppercase/i)).toBeInTheDocument();
      expect(screen.getByText(/lowercase/i)).toBeInTheDocument();
      expect(screen.getByText(/number/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockResolvedValue({ data: { message: 'Password reset successfully' } });

    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    await user.type(passwordInput, 'NewPassword123');
    await user.type(confirmPasswordInput, 'NewPassword123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'valid-reset-token',
        newPassword: 'NewPassword123'
      });
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    await user.type(passwordInput, 'NewPassword123');
    await user.type(confirmPasswordInput, 'NewPassword123');
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /resetting password/i })).toBeDisabled();
  });

  it('displays success message after successful reset', async () => {
    const user = userEvent.setup();
    mockApiClient.post.mockResolvedValue({ data: { message: 'Password reset successfully' } });

    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    await user.type(passwordInput, 'NewPassword123');
    await user.type(confirmPasswordInput, 'NewPassword123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /password reset successful/i })).toBeInTheDocument();
      expect(screen.getByText(/your password has been successfully reset/i)).toBeInTheDocument();
    });
  });

  it('displays error message when reset fails', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Invalid or expired reset token';
    mockApiClient.post.mockRejectedValue({
      response: { data: { message: errorMessage } }
    });

    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    await user.type(passwordInput, 'NewPassword123');
    await user.type(confirmPasswordInput, 'NewPassword123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const toggleButton = screen.getByLabelText(/show password/i);

    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/hide password/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    renderWithRouter(<ResetPasswordPage />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', 'Set new password');

    const passwordInput = screen.getByLabelText('New Password');
    expect(passwordInput).toHaveAttribute('aria-required', 'true');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');

    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    expect(confirmPasswordInput).toHaveAttribute('aria-required', 'true');
    expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password');
  });

  it('disables submit button when password strength is insufficient', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');
    const submitButton = screen.getByRole('button', { name: /reset password/i });

    await user.type(passwordInput, 'weak');

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('has proper ARIA attributes for password strength indicator', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ResetPasswordPage />);

    const passwordInput = screen.getByLabelText('New Password');

    await user.type(passwordInput, 'Password123');

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '4');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '4');
      expect(progressBar).toHaveAttribute('aria-label', 'Password strength: Strong');

      const requirementsList = screen.getByRole('list', { name: /password requirements/i });
      expect(requirementsList).toBeInTheDocument();
    });
  });
});