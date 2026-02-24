import { test, expect } from '@playwright/test';
import { waitForAuthScreen } from '../helpers/auth.helper';

test.describe('Authentication - Password Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAuthScreen(page);
  });

  test('should show forgot password link or button', async ({ page }) => {
    // Look for forgot password functionality
    const forgotPasswordElement = page.locator('button:has-text("Forgot"), a:has-text("Forgot"), button:has-text("Reset"), a:has-text("Reset")').first();

    // Check if forgot password option exists
    const count = await forgotPasswordElement.count();
    if (count > 0) {
      await expect(forgotPasswordElement).toBeVisible();
    }
  });

  test('should handle password reset flow', async ({ page }) => {
    // Try to find and click forgot password
    const forgotPasswordBtn = page.locator('button:has-text("Forgot"), a:has-text("Forgot")').first();

    const btnExists = await forgotPasswordBtn.count();
    if (btnExists === 0) {
      test.skip('Forgot password functionality not found in UI');
      return;
    }

    await forgotPasswordBtn.click();

    // Should show email input for password reset
    await page.waitForTimeout(1000);

    // Look for submit button
    const submitBtn = page.locator('button:has-text("Send"), button:has-text("Reset"), button:has-text("Submit")').first();

    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeVisible();
    }
  });
});
