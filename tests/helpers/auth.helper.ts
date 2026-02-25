import { Page, expect } from '@playwright/test';

/**
 * Helper functions for authentication in tests
 */

export async function login(page: Page, username: string, password: string) {
  // Wait for auth screen to load
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Fill in credentials
  await page.fill('input[type="email"]', username);
  await page.fill('input[type="password"]', password);

  // Click login button
  await page.click('button:has-text("Sign In")');

  // Wait for navigation to complete (app should load)
  await page.waitForLoadState('networkidle');

  // Verify we're logged in (header should be visible)
  await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });
}

export async function logout(page: Page) {
  // Click user avatar/email to open dropdown menu
  await page.click('button:has-text("' + process.env.TEST_USERNAME + '")');

  // Wait for dropdown menu to appear
  await page.waitForTimeout(500);

  // Click sign out button in the dropdown
  await page.click('button:has-text("Sign Out")');

  // Wait for redirect to auth screen
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Check if navigation/header is visible (indicates logged in state)
    const navVisible = await page.locator('nav').or(page.locator('header')).isVisible();
    return navVisible;
  } catch {
    return false;
  }
}

export async function waitForAuthScreen(page: Page) {
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await expect(page.locator('input[type="password"]')).toBeVisible();
}
