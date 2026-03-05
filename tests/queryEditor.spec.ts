/**
 * E2E tests for the MongoDB query editor.
 */
import { test, expect } from '@playwright/test';
import { openNewPanelEditor, clickSelect, selectOption, commitPipelineAndRefresh } from './helpers';

test.describe('Query Editor', () => {
  test('can create a table query', async ({ page }) => {
    await openNewPanelEditor(page);

    // Verify query editor fields are visible using data-testid where available.
    await expect(page.getByTestId('mongodb-pipeline-editor')).toBeVisible();
    await expect(page.locator('label', { hasText: 'Database' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Collection' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Format' })).toBeVisible();
  });

  test('table format hides time field', async ({ page }) => {
    await openNewPanelEditor(page);

    // Table format is the default — the "Table" radio should be checked.
    // Scope to query editor row to avoid matching the Legend display mode radio.
    await expect(page.getByTestId('query-editor-row').locator('input[id*="option-table"]')).toBeChecked();

    // Time Field label should not be visible in table mode.
    await expect(page.locator('label', { hasText: 'Time Field' })).not.toBeVisible();
  });

  test('switching to time_series format shows Time Field', async ({ page }) => {
    await openNewPanelEditor(page);

    // Click the "Time Series" radio label.
    await page.locator('label[for*="option-time_series"]').click({ force: true });

    // Time Field and Legend inputs should now appear.
    await expect(page.locator('label', { hasText: 'Time Field' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('label', { hasText: 'Legend' })).toBeVisible();
  });

  test('database dropdown loads real databases', async ({ page }) => {
    await openNewPanelEditor(page);

    // Click the database select dropdown.
    await clickSelect(page, 'Select database');

    // The "demo" database should appear in the dropdown options.
    await expect(page.getByText('demo', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('collection dropdown loads after selecting database', async ({ page }) => {
    await openNewPanelEditor(page);

    // Select the "demo" database.
    await selectOption(page, 'Select database', 'demo');

    // Now click the collection dropdown.
    await clickSelect(page, 'Select collection');

    // Collections from the demo database should appear.
    await expect(page.getByText('sensors')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('users')).toBeVisible();
    await expect(page.getByText('events')).toBeVisible();
    await expect(page.getByText('orders')).toBeVisible();
  });

  test('running a query returns data in the panel', async ({ page }) => {
    await openNewPanelEditor(page);

    // Select database and collection.
    await selectOption(page, 'Select database', 'demo');
    await selectOption(page, 'Select collection', 'users');

    // Commit the default pipeline and trigger query execution.
    await commitPipelineAndRefresh(page);

    // The default pipeline is [{"$limit": 100}], which should return users.
    await expect(page.getByText('alice@example.com')).toBeVisible({ timeout: 15000 });
  });
});
