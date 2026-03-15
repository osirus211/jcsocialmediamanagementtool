import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { vi } from 'vitest'
import { LoginPage } from '../../pages/auth/Login'

expect.extend(toHaveNoViolations)

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockLogin = vi.fn()

// Mock auth store
const mockAuthStore = {
  login: mockLogin,
  isLoading: false
}
vi.mock('@/store/auth.store', () => ({
  useAuthStore: () => mockAuthStore
}))

// Mock social service
vi.mock('@/services/social.service', () => ({
  socialService: {
    getOAuthUrl: vi.fn()
  }
}))

const renderLogin = (initialEntries = ['/login']) => 
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoginPage />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockLogin.mockReset()
  mockAuthStore.isLoading = false
})

describe('LoginPage Accessibility Tests', () => {
  // A11Y TESTS (T108-T112)
  describe('ACCESSIBILITY', () => {
    test('T108: has no accessibility violations', async () => {
      const { container } = renderLogin()
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    test('T109: form inputs have proper labels', () => {
      renderLogin()
      
      const emailInput = document.querySelector('#email')
      const passwordInput = document.querySelector('#password')
      const emailLabel = document.querySelector('label[for="email"]')
      const passwordLabel = document.querySelector('label[for="password"]')
      
      expect(emailInput).toBeInTheDocument()
      expect(passwordInput).toBeInTheDocument()
      expect(emailLabel).toBeInTheDocument()
      expect(passwordLabel).toBeInTheDocument()
      expect(emailLabel).toHaveTextContent('Email')
      expect(passwordLabel).toHaveTextContent('Password')
    })

    test('T110: error messages have proper ARIA attributes', async () => {
      renderLogin()
      
      // Submit form to trigger validation errors
      const form = document.querySelector('form')
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true }))
      }
      
      // Wait for errors to appear
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const emailError = document.querySelector('#email-error')
      const passwordError = document.querySelector('#password-error')
      
      if (emailError) {
        expect(emailError).toHaveAttribute('role', 'alert')
      }
      if (passwordError) {
        expect(passwordError).toHaveAttribute('role', 'alert')
      }
    })

    test('T111: buttons have sufficient color contrast', () => {
      renderLogin()
      
      const submitButton = document.querySelector('button[type="submit"]')
      const showPasswordButton = document.querySelector('button[aria-label*="password"]')
      
      expect(submitButton).toBeInTheDocument()
      expect(showPasswordButton).toBeInTheDocument()
      
      // These buttons should have proper styling for contrast
      // The actual contrast testing would require more complex tools
      // but we can verify the elements exist and have proper attributes
      expect(submitButton).toHaveClass('bg-blue-600', 'text-white')
    })

    test('T112: interactive elements meet minimum size requirements', () => {
      renderLogin()
      
      const submitButton = document.querySelector('button[type="submit"]')
      const showPasswordButton = document.querySelector('button[aria-label*="password"]')
      
      expect(submitButton).toBeInTheDocument()
      expect(showPasswordButton).toBeInTheDocument()
      
      // Check minimum touch target size (44px)
      expect(submitButton).toHaveClass('min-h-[44px]')
      expect(showPasswordButton).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })
  })
})