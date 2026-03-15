import { test, expect } from '@playwright/test';

/**
 * E2E Authentication Tests - Complete Login Flow
 * 
 * Tests the complete authentication flow including:
 * - Basic login with valid credentials
 * - JWT token handling and storage
 * - Redirect to dashboard after successful login
 * - API request validation
 * 
 * **Validates: Requirements 2.1, 2.4, 2.8, 3.1, 3.2, 3.6**
 */

test.describe('Authentication - Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  test('should complete full login flow with valid credentials', async ({ page }) => {
    // Step 1: Open /login page
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1, h2')).toContainText(/login|sign in/i);

    // Step 2: Enter email
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('test@example.com');

    // Step 3: Enter password
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('TestPassword123!');

    // Step 4: Submit login form
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Set up network monitoring before clicking submit
    const loginRequestPromise = page.waitForRequest(request => 
      request.url().includes('/auth/login') && request.method() === 'POST'
    );
    
    const loginResponsePromise = page.waitForResponse(response => 
      response.url().includes('/auth/login') && response.status() === 200
    );

    await submitButton.click();

    // Step 5: Verify API request to /auth/login
    const loginRequest = await loginRequestPromise;
    expect(loginRequest.url()).toContain('/auth/login');
    expect(loginRequest.method()).toBe('POST');
    
    const requestData = loginRequest.postDataJSON();
    expect(requestData.email).toBe('test@example.com');
    expect(requestData.password).toBe('TestPassword123!');

    // Step 6: Verify JWT token returned
    const loginResponse = await loginResponsePromise;
    const responseData = await loginResponse.json();
    
    expect(responseData.success).toBe(true);
    expect(responseData.token).toBeDefined();
    expect(responseData.user).toBeDefined();
    expect(responseData.user.email).toBe('test@example.com');

    // Step 7: Verify token stored in browser storage
    const localStorage = await page.evaluate(() => window.localStorage);
    const sessionStorage = await page.evaluate(() => window.sessionStorage);
    
    // Check for token in localStorage or sessionStorage
    const hasTokenInStorage = 
      Object.values(localStorage).some(value => typeof value === 'string' && value.includes('eyJ')) ||
      Object.values(sessionStorage).some(value => typeof value === 'string' && value.includes('eyJ'));
    
    expect(hasTokenInStorage).toBe(true);

    // Step 8: Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify dashboard elements are visible
    await expect(page.locator('nav, header')).toBeVisible();
    await expect(page.locator('main, .dashboard, [data-testid="dashboard"]')).toBeVisible();
  });

  test('should handle login with invalid credentials', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');

    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('wrongpassword');

    // Monitor for error response
    const errorResponsePromise = page.waitForResponse(response => 
      response.url().includes('/auth/login') && (response.status() === 401 || response.status() === 400)
    );

    await submitButton.click();

    // Verify error response
    const errorResponse = await errorResponsePromise;
    expect([400, 401]).toContain(errorResponse.status());

    // Verify error message is displayed
    const errorMessage = page.locator('.error, .alert-error, [role="alert"], .text-red-500');
    await expect(errorMessage).toBeVisible();
    
    // Verify user stays on login page
    await expect(page).toHaveURL('/login');
  });

  test('should validate required fields', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Try to submit without filling fields
    await submitButton.click();
    
    // Check for validation messages
    const emailValidation = page.locator('input[type="email"]:invalid, .field-error, .error-message');
    const passwordValidation = page.locator('input[type="password"]:invalid, .field-error, .error-message');
    
    // At least one validation should be visible
    const hasValidation = await emailValidation.count() > 0 || await passwordValidation.count() > 0;
    expect(hasValidation).toBe(true);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');

    // Block network requests to simulate network error
    await page.route('**/auth/login', route => route.abort());

    await emailInput.fill('test@example.com');
    await passwordInput.fill('TestPassword123!');
    await submitButton.click();

    // Verify error handling
    const errorMessage = page.locator('.error, .alert-error, [role="alert"], .network-error');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});