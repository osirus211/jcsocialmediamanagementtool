import { Page, expect } from '@playwright/test';

/**
 * Authentication Helper Functions for E2E Tests
 * 
 * Provides reusable functions for common authentication operations
 * across all E2E test files.
 */

export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * Perform login with given credentials
   */
  async login(email: string, password: string) {
    await this.page.goto('/login');
    
    const emailInput = this.page.locator('input[type="email"], input[name="email"]');
    const passwordInput = this.page.locator('input[type="password"], input[name="password"]');
    const submitButton = this.page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await submitButton.click();
  }

  /**
   * Verify user is authenticated and on dashboard
   */
  async verifyAuthenticated() {
    await expect(this.page).toHaveURL('/dashboard');
    
    const authenticatedContent = this.page.locator('nav, .user-menu, [data-testid="user-avatar"]');
    await expect(authenticatedContent).toBeVisible();
  }

  /**
   * Verify user is not authenticated
   */
  async verifyNotAuthenticated() {
    await expect(this.page).toHaveURL(/\/login|\/unauthorized/);
  }

  /**
   * Clear all authentication tokens
   */
  async clearTokens() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Check if tokens exist in browser storage
   */
  async hasTokensInStorage(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const localStorage = window.localStorage;
      const sessionStorage = window.sessionStorage;
      
      return Object.values(localStorage).some(value => 
        typeof value === 'string' && value.includes('eyJ')
      ) || Object.values(sessionStorage).some(value => 
        typeof value === 'string' && value.includes('eyJ')
      );
    });
  }

  /**
   * Wait for authentication API response
   */
  async waitForAuthResponse(endpoint: string = '/auth/login') {
    return await this.page.waitForResponse(response => 
      response.url().includes(endpoint) && response.status() === 200
    );
  }

  /**
   * Verify API endpoint is accessible
   */
  async verifyApiEndpoint(endpoint: string, expectedStatuses: number[] = [200, 401, 400]) {
    try {
      const response = await this.page.request.get(`http://localhost:5000${endpoint}`);
      expect(expectedStatuses).toContain(response.status());
      return response;
    } catch (error) {
      throw new Error(`API endpoint ${endpoint} is not accessible: ${error.message}`);
    }
  }

  /**
   * Perform logout
   */
  async logout() {
    const logoutButton = this.page.locator('button:has-text("Logout"), button:has-text("Sign Out"), .logout');
    
    if (await logoutButton.count() === 0) {
      // Try to find logout in user menu
      const userMenu = this.page.locator('.user-menu, [data-testid="user-menu"], .dropdown-toggle');
      if (await userMenu.count() > 0) {
        await userMenu.click();
        await this.page.locator('button:has-text("Logout"), a:has-text("Logout")').click();
      }
    } else {
      await logoutButton.click();
    }
  }
}

/**
 * Test data for authentication tests
 */
export const testUsers = {
  valid: {
    email: 'test@example.com',
    password: 'TestPassword123!'
  },
  twoFactor: {
    email: '2fa-user@example.com',
    password: 'TestPassword123!'
  },
  invalid: {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  }
};

/**
 * Common test assertions for authentication
 */
export const authAssertions = {
  async verifyLoginForm(page: Page) {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"], button:has-text("Login")');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  },

  async verifyErrorMessage(page: Page) {
    const errorMessage = page.locator('.error, .alert-error, [role="alert"], .text-red-500');
    await expect(errorMessage).toBeVisible();
  },

  async verifySuccessMessage(page: Page) {
    const successMessage = page.locator('.success, .alert-success, [role="alert"], .text-green-500');
    await expect(successMessage).toBeVisible();
  }
};