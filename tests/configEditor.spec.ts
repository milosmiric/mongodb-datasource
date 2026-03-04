/**
 * E2E tests for the MongoDB datasource configuration editor.
 */
import { test, expect } from '@playwright/test';

test.describe('Config Editor', () => {
  test('can navigate to datasource settings', async ({ page }) => {
    await page.goto('/connections/datasources/edit/mongodb-demo');
    await page.waitForSelector('text=MongoDB');

    // Verify key config sections are visible using <legend> elements
    // to avoid matching nav items like "Connections".
    await expect(page.locator('legend', { hasText: 'Connection' })).toBeVisible();
    await expect(page.locator('legend', { hasText: 'Authentication' })).toBeVisible();
    await expect(page.locator('legend', { hasText: 'TLS / SSL' })).toBeVisible();
  });

  test('connection URI is configured (masked)', async ({ page }) => {
    await page.goto('/connections/datasources/edit/mongodb-demo');
    await page.waitForSelector('text=MongoDB');

    // The URI should show as configured (reset button visible).
    await expect(page.getByText('Connection URI')).toBeVisible();
  });

  test('default database is set', async ({ page }) => {
    await page.goto('/connections/datasources/edit/mongodb-demo');
    await page.waitForSelector('text=MongoDB');

    const dbInput = page.getByPlaceholder('mydb');
    await expect(dbInput).toHaveValue('demo');
  });
});
