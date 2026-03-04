/**
 * E2E tests for the MongoDB datasource health check.
 */
import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
  test('datasource health check succeeds', async ({ page }) => {
    // Navigate to the provisioned MongoDB datasource settings.
    await page.goto('/connections/datasources/edit/mongodb-demo');

    // Wait for the page to load.
    await page.waitForSelector('text=MongoDB');

    // Click "Save & test".
    await page.getByRole('button', { name: /save & test/i }).click();

    // Verify success message.
    await expect(page.getByText(/MongoDB connected/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Server version/i)).toBeVisible();
  });
});
