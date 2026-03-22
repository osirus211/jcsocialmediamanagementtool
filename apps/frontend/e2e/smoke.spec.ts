import { test, expect } from '@playwright/test';

test.describe('Smoke Tests — Critical Paths', () => {
  test('app loads without crashing', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('login page is accessible', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
  });

  test('register page is accessible', async ({ page }) => {
    const response = await page.goto('/register');
    expect(response?.status()).toBe(200);
  });

  test('404 page handles unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    const criticalErrors = errors.filter(
      e => !e.includes('favicon') && !e.includes('manifest')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
