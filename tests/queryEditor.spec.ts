/**
 * E2E tests for the MongoDB query editor.
 */
import { test, expect } from '@playwright/test';

test.describe('Query Editor', () => {
  test('can create a table query', async ({ page }) => {
    // Navigate to explore or create new panel.
    await page.goto('/dashboard/new');

    // Click "Add visualization".
    await page.getByRole('button', { name: /add visualization/i }).click();

    // Select MongoDB datasource.
    await page.getByText('MongoDB', { exact: true }).click();

    // Verify query editor fields are visible.
    await expect(page.getByText('Database')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Collection')).toBeVisible();
    await expect(page.getByText('Pipeline')).toBeVisible();
    await expect(page.getByText('Format')).toBeVisible();
  });

  test('table format hides time field', async ({ page }) => {
    await page.goto('/dashboard/new');
    await page.getByRole('button', { name: /add visualization/i }).click();
    await page.getByText('MongoDB', { exact: true }).click();

    // Table format should be default.
    await expect(page.getByText('Table')).toBeVisible();

    // Time field should not be visible in table mode.
    await expect(page.getByText('Time Field')).not.toBeVisible();
  });
});
