import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Social/i);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('login form has email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('login shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 });
  });

  test('forgot password link is present', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /forgot/i })).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});
