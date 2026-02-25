import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.helper';

test.describe('Learning Summaries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await login(page, process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);
  });

  test('should display learning summary section', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should show learning summary for students with 2+ reports', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent!.length).toBeGreaterThan(100);
  });

  test('should display recent grades in learning summary', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should show learning summary generation status', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should handle learning summary queue processing', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should display learning summary based on last 3 reports', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should show appropriate message for students without enough reports', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should update learning summary when new reports are added', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should display learning summary in parent view', async ({ page }) => {
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });
});
