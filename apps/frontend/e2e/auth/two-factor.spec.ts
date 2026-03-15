import { test, expect } from '@playwright/test';

/**
 * E2E Authentication Tests - 2FA Flow
 * 
 * Tests the two-factor authentication flow including:
 * - 2FA setup and verification
 * - TOTP code validation
 * - Backup codes usage
 * - 2FA bypass attempts
 * 
 * **Validates: Requirements 2.8, 3.2**
 */

test.describe('Authentication - Two-Factor Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  test('should complete 2FA authentication flow', async ({ page }) => {
    // Step 1: Login with 2FA-enabled account
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');

    await emailInput.fill('2fa-user@example.com');
    await passwordInput.fill('TestPassword123!');

    // Monitor for 2FA challenge response
    const twoFactorResponsePromise = page.waitForResponse(response => 
      response.url().includes('/auth/login') && response.status() === 200
    );

    await submitButton.click();

    const response = await twoFactorResponsePromise;
    const responseData = await response.json();

    // Step 2: Verify 2FA challenge is presented
    if (responseData.requiresTwoFactor) {
      await expect(page).toHaveURL(/\/two-factor|\/2fa/);
      
      // Verify 2FA form elements
      const totpInput = page.locator('input[name="totp"], input[name="code"], input[placeholder*="code"]');
      await expect(totpInput).toBeVisible();
      
      const verifyButton = page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Continue")');
      await expect(verifyButton).toBeVisible();

      // Step 3: Enter TOTP code
      await totpInput.fill('123456'); // Mock TOTP code

      // Monitor for verification response
      const verifyResponsePromise = page.waitForResponse(response => 
        response.url().includes('/auth/complete-login') && response.status() === 200
      );

      await verifyButton.click();

      // Step 4: Verify successful 2FA completion
      const verifyResponse = await verifyResponsePromise;
      const verifyData = await verifyResponse.json();
      
      expect(verifyData.success).toBe(true);
      expect(verifyData.token).toBeDefined();

      // Step 5: Verify redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
    }
  });

  test('should handle invalid 2FA codes', async ({ page }) => {
    // Login to get to 2FA challenge
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('2fa-user@example.com');
    await passwordInput.fill('TestPassword123!');
    await submitButton.click();

    // Wait for 2FA page
    await page.waitForURL(/\/two-factor|\/2fa/, { timeout: 10000 });

    const totpInput = page.locator('input[name="totp"], input[name="code"], input[placeholder*="code"]');
    const verifyButton = page.locator('button[type="submit"], button:has-text("Verify")');

    // Enter invalid TOTP code
    await totpInput.fill('000000');

    // Monitor for error response
    const errorResponsePromise = page.waitForResponse(response => 
      response.url().includes('/auth/complete-login') && (response.status() === 400 || response.status() === 401)
    );

    await verifyButton.click();

    // Verify error response
    const errorResponse = await errorResponsePromise;
    expect([400, 401]).toContain(errorResponse.status());

    // Verify error message is displayed
    const errorMessage = page.locator('.error, .alert-error, [role="alert"], .text-red-500');
    await expect(errorMessage).toBeVisible();
    
    // Verify user stays on 2FA page
    await expect(page).toHaveURL(/\/two-factor|\/2fa/);
  });

  test('should provide backup code option', async ({ page }) => {
    // Login to get to 2FA challenge
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('2fa-user@example.com');
    await passwordInput.fill('TestPassword123!');
    await submitButton.click();

    // Wait for 2FA page
    await page.waitForURL(/\/two-factor|\/2fa/, { timeout: 10000 });

    // Look for backup code option
    const backupCodeLink = page.locator('a:has-text("backup"), button:has-text("backup"), .backup-code');
    
    if (await backupCodeLink.count() > 0) {
      await backupCodeLink.click();
      
      // Verify backup code input is available
      const backupInput = page.locator('input[name="backup"], input[placeholder*="backup"]');
      await expect(backupInput).toBeVisible();
    }
  });

  test('should prevent 2FA bypass attempts', async ({ page }) => {
    // Try to access dashboard directly without completing 2FA
    await page.goto('/dashboard');
    
    // Should be redirected to login or 2FA page
    await expect(page).toHaveURL(/\/login|\/two-factor|\/2fa/);
    
    // Verify no access to protected content
    const protectedContent = page.locator('.dashboard-content, [data-testid="dashboard"]');
    await expect(protectedContent).not.toBeVisible();
  });

  test('should handle 2FA setup flow', async ({ page }) => {
    // Login with regular account
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('regular-user@example.com');
    await passwordInput.fill('TestPassword123!');
    await submitButton.click();

    // Navigate to 2FA setup (usually in settings)
    await page.goto('/settings/security');
    
    // Look for 2FA setup option
    const setupButton = page.locator('button:has-text("Enable"), button:has-text("Setup"), .enable-2fa');
    
    if (await setupButton.count() > 0) {
      await setupButton.click();
      
      // Verify QR code or setup key is displayed
      const qrCode = page.locator('.qr-code, canvas, img[alt*="QR"]');
      const setupKey = page.locator('.setup-key, .secret-key, code');
      
      const hasSetupMethod = await qrCode.count() > 0 || await setupKey.count() > 0;
      expect(hasSetupMethod).toBe(true);
    }
  });
});