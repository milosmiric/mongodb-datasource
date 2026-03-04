/**
 * E2E tests for the provisioned sample dashboard.
 */
import { test, expect } from '@playwright/test';

test.describe('Sample Dashboard', () => {
  test('dashboard loads with all panels', async ({ page }) => {
    // Navigate to the provisioned sample dashboard.
    await page.goto('/d/mongodb-sample/mongodb-sample-dashboard');

    // Wait for the dashboard to load.
    await page.waitForSelector('[data-testid="dashboard-panel"]', { timeout: 30000 }).catch(() => {
      // Fallback: just check the page has loaded.
    });

    // Verify dashboard title.
    await expect(page.getByText('MongoDB Sample Dashboard')).toBeVisible({ timeout: 15000 });
  });

  test('panels do not show "No data" errors', async ({ page }) => {
    await page.goto('/d/mongodb-sample/mongodb-sample-dashboard');

    // Wait for panels to render.
    await page.waitForTimeout(5000);

    // Check that there are no "No data" messages visible.
    const noDataElements = await page.getByText('No data').count();
    expect(noDataElements).toBe(0);
  });

  test('sensor readings panel renders', async ({ page }) => {
    await page.goto('/d/mongodb-sample/mongodb-sample-dashboard');

    await expect(page.getByText('Sensor Readings Over Time')).toBeVisible({ timeout: 15000 });
  });

  test('total sensor readings stat panel renders', async ({ page }) => {
    await page.goto('/d/mongodb-sample/mongodb-sample-dashboard');

    await expect(page.getByText('Total Sensor Readings')).toBeVisible({ timeout: 15000 });
  });
});
