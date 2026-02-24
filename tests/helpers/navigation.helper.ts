import { Page, expect } from '@playwright/test';

/**
 * Helper functions for navigation in the app
 */

export async function navigateToScanner(page: Page) {
  await page.click('button:has-text("Scanner")');
  await page.waitForLoadState('networkidle');
}

export async function navigateToHistory(page: Page) {
  await page.click('button:has-text("History")');
  await page.waitForLoadState('networkidle');
}

export async function navigateToBatches(page: Page) {
  await page.click('button:has-text("Batches")');
  await page.waitForLoadState('networkidle');
}

export async function getCurrentView(page: Page): Promise<string> {
  // Determine current view based on visible content
  if (await page.locator('text=Upload Photo').isVisible().catch(() => false)) {
    return 'scanner';
  }
  if (await page.locator('text=Session History').isVisible().catch(() => false)) {
    return 'history';
  }
  if (await page.locator('text=Batch Management').isVisible().catch(() => false)) {
    return 'batches';
  }
  return 'unknown';
}
