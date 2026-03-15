import { test, expect } from '@playwright/test';

test('simple connectivity test', async ({ page }) => {
  // Test basic page loading
  await page.goto('http://localhost:5173');
  
  // Just verify the page loads
  await expect(page).toHaveTitle(/.*/, { timeout: 10000 });
  
  console.log('✓ Frontend is accessible');
  
  // Test backend health
  try {
    const response = await page.request.get('http://localhost:5000/health');
    console.log(`Backend health status: ${response.status()}`);
  } catch (error) {
    console.log('Backend health check failed:', error.message);
  }
});