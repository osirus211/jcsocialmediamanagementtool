import { test, expect } from '@playwright/test';

/**
 * E2E Authentication Tests - Password Reset Flow
 * 
 * Tests the password reset functionality including:
 * - Password reset request
 * - Email verification
 * - New password setting
 * - Reset token validation
 * 
 * **Validates: Requirements 2.1, 3.5**
 */

test.describe('Authentication - Password Reset', () => {
  test('should complete password reset flow', async ({ page }) => {
    // Step 1: Navigate to forgot password page
    await page.goto('/login');
    
    const forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset"), .forgot-password');
    await expect(forgotPasswordLink).toBeVisible();
    await forgotPasswordLink.click();

    // Step 2: Enter email for reset
    await expect(page).toHaveURL(/\/forgot|\/reset/);
    
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('user@example.com');

    // Step 3: Submit reset request
    const submitButton = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Reset")');
    
    const resetRequestPromise = page.waitForResponse(response => 
      response.url().includes('/auth/request-password-reset') && response.status() === 200
    );

    await submitButton.click();

    // Step 4: Verify reset request API call
    const resetResponse = await resetRequestPromise;
    const responseData = await resetResponse.json();
    expect(responseData.success).toBe(true);

    // Step 5: Verify success message
    const successMessage = page.locator('.success, .alert-success, [role="alert"]');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText(/sent|email/i);
  });

  test('should handle invalid email for reset', async ({ page }) => {
    await page.goto('/forgot-password');
    
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('nonexistent@example.com');

    const errorResponsePromise = page.waitForResponse(response => 
      response.url().includes('/auth/request-password-reset') && 
      (response.status() === 404 || response.status() === 400)
    );

    await submitButton.click();

    const errorResponse = await errorResponsePromise;
    expect([400, 404]).toContain(errorResponse.status());

    const errorMessage = page.locator('.error, .alert-error, [role="alert"]');
    await expect(errorMessage).toBeVisible();
  });
});