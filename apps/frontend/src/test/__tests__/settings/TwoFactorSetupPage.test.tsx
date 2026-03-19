import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TwoFactorSetupPage } from '../../../pages/settings/TwoFactorSetupPage';
import { TwoFactorService } from '../../../services/two-factor.service';

vi.mock('../../../services/two-factor.service');

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('TwoFactorSetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders introduction step initially', () => {
    renderWithRouter(<TwoFactorSetupPage />);

    expect(screen.getByText(/Secure Your Account with Two-Factor Authentication/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
  });

  it('shows step indicator', () => {
    renderWithRouter(<TwoFactorSetupPage />);

    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
  });

  it('has cancel button', () => {
    renderWithRouter(<TwoFactorSetupPage />);

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });
});
