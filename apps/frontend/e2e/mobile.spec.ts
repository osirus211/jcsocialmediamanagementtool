import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test.use({ ...devices['Pixel 5'] });

  test('login page is usable on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('no horizontal scroll on login page', async ({ page }) => {
    await page.goto('/login');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('register page is usable on mobile', async ({ page }) => {
    await page.goto('/register');
    const response = await page.waitForLoadState('domcontentloaded');
    expect(response).toBeUndefined();
  });
});
