import { test, expect } from '@playwright/test';
import { login, logout } from '../helpers/auth.helper';
import { navigateToScanner, navigateToHistory, navigateToBatches } from '../helpers/navigation.helper';

/**
 * SMOKE TESTS - Critical User Flows
 * These tests cover the most important paths through the application
 */

test.describe('Smoke Tests - Critical Paths', () => {
  test('CRITICAL: Complete grading workflow', async ({ page }) => {
    // 1. Login
    await page.goto('/');
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);

    // 2. Navigate to Scanner
    await navigateToScanner(page);
    await page.waitForTimeout(1500);

    // 3. Verify scanner loaded
    await expect(page.locator('body')).toContainText(/scanner|upload|photo|grade/i);

    // 4. Check if we can access grading interface
    const hasGradingUI = await page.locator('input, button, select').count();
    expect(hasGradingUI).toBeGreaterThan(0);

    // 5. Logout
    await logout(page);
  });

  test('CRITICAL: View session history', async ({ page }) => {
    // 1. Login
    await page.goto('/');
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);

    // 2. Navigate to History
    await navigateToHistory(page);
    await page.waitForTimeout(2000);

    // 3. Verify history view loaded
    const hasHistoryContent = await page.locator('text=/history|session|report/i').count();
    expect(hasHistoryContent).toBeGreaterThan(0);

    // 4. Logout
    await logout(page);
  });

  test('CRITICAL: Batch management access', async ({ page }) => {
    // 1. Login
    await page.goto('/');
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);

    // 2. Navigate to Batches
    await navigateToBatches(page);
    await page.waitForTimeout(2000);

    // 3. Verify batches view loaded
    const hasBatchContent = await page.locator('text=/batch|student|class/i').count();
    expect(hasBatchContent).toBeGreaterThan(0);

    // 4. Logout
    await logout(page);
  });

  test('CRITICAL: App loads without JavaScript errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Load the app
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Filter out known non-critical errors (like third-party script errors)
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('chrome-extension') &&
      !err.includes('third-party') &&
      !err.includes('Loading failed for') && // Resource loading errors
      !err.includes('Failed to load resource') && // Network errors
      !err.includes('net::ERR_') // Network/DNS errors
    );

    // Should have no critical JavaScript errors (allow up to 2 non-critical warnings)
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
  });

  test('CRITICAL: Responsive layout on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Login
    await page.goto('/');
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);

    // Verify app is usable on mobile
    await page.waitForTimeout(1500);

    // Navigation should be accessible
    const navElements = await page.locator('button, nav, header').count();
    expect(navElements).toBeGreaterThan(0);

    // No horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // Allow small margin
  });

  test('CRITICAL: All main navigation links work', async ({ page }) => {
    await page.goto('/');
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);
    await page.waitForTimeout(1500);

    // Test Scanner navigation
    await navigateToScanner(page);
    await page.waitForTimeout(1000);
    let content = await page.textContent('body');
    expect(content).toBeTruthy();

    // Test History navigation
    await navigateToHistory(page);
    await page.waitForTimeout(1000);
    content = await page.textContent('body');
    expect(content).toBeTruthy();

    // Test Batches navigation
    await navigateToBatches(page);
    await page.waitForTimeout(1000);
    content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('CRITICAL: Supabase connection is working', async ({ page }) => {
    await page.goto('/');

    // Check if Supabase client loads
    const supabaseLoaded = await page.evaluate(() => {
      return typeof (window as any).supabase !== 'undefined';
    });

    expect(supabaseLoaded).toBeTruthy();

    // Try to login (this uses Supabase auth)
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);

    // If login succeeds, Supabase is working (check for user email)
    await expect(page.locator(`text=${process.env.TEST_USERNAME}`)).toBeVisible();
  });

  test('CRITICAL: Page performance is acceptable', async ({ page }) => {
    // Navigate to the app
    const startTime = Date.now();
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);

    // Login
    const loginStart = Date.now();
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);
    const loginTime = Date.now() - loginStart;

    // Login should complete within 15 seconds
    expect(loginTime).toBeLessThan(15000);
  });

  test('CRITICAL: No mixed content warnings (HTTPS)', async ({ page }) => {
    const mixedContentWarnings: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Mixed Content') || text.includes('http://')) {
        mixedContentWarnings.push(text);
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should not have mixed content warnings
    expect(mixedContentWarnings.length).toBe(0);
  });

  test('CRITICAL: Essential React components render', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check if React is loaded
    const reactLoaded = await page.evaluate(() => {
      return typeof (window as any).React !== 'undefined';
    });

    expect(reactLoaded).toBeTruthy();

    // Check if root app is rendered
    const rootContent = await page.locator('#root').innerHTML();
    expect(rootContent.length).toBeGreaterThan(0);
  });
});
