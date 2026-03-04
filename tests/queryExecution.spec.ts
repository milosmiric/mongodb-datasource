/**
 * E2E tests focused on query execution — verifying actual data results.
 */
import { test, expect } from '@playwright/test';
import { openNewPanelEditor, selectOption } from './helpers';

/**
 * Helper: Fill query editor fields and run a query in the panel editor.
 */
async function fillAndRunQuery(
  page: import('@playwright/test').Page,
  opts: {
    database: string;
    collection: string;
    pipeline: string;
    format?: 'table' | 'time_series';
    timeField?: string;
  }
) {
  await openNewPanelEditor(page);

  // Select database and collection.
  await selectOption(page, 'Select database', opts.database);
  await selectOption(page, 'Select collection', opts.collection);

  // Set format if needed.
  if (opts.format === 'time_series') {
    // Switch visualization type to Time series for chart rendering.
    const vizBtn = page.getByTestId('data-testid select a panel type button');
    if (await vizBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await vizBtn.click();
      await page.getByText('Time series').first().click();
    }
    await page.locator('label[for*="option-time_series"]').click({ force: true });
    if (opts.timeField) {
      const timeInput = page.getByPlaceholder('timestamp');
      await timeInput.clear();
      await timeInput.fill(opts.timeField);
      await timeInput.blur();
    }
  }

  // Set pipeline using the code editor (Monaco) inside our data-testid wrapper.
  const pipelineEditor = page.getByTestId('mongodb-pipeline-editor');
  const editor = pipelineEditor.locator('.monaco-editor').first();
  await editor.click({ force: true });
  // Select all existing text and replace it.
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.type(opts.pipeline, { delay: 5 });

  // Click outside the editor to commit the pipeline value.
  await page.locator('label', { hasText: 'Pipeline' }).click({ force: true });

  // Explicitly trigger query execution via the RefreshPicker run button.
  await page.getByTestId('data-testid RefreshPicker run button').click();

  // Wait for the query to execute.
  await page.waitForTimeout(3000);
}

test.describe('Query Execution', () => {
  test('table query returns data', async ({ page }) => {
    await fillAndRunQuery(page, {
      database: 'demo',
      collection: 'users',
      pipeline: '[{"$project": {"_id": 0, "name": 1, "email": 1, "role": 1}}]',
    });

    await expect(page.getByText('Alice Chen')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('bob@example.com')).toBeVisible();
  });

  test('time_series query renders chart', async ({ page }) => {
    await fillAndRunQuery(page, {
      database: 'demo',
      collection: 'sensors',
      pipeline: '[{"$match": {"sensor": "temperature"}}, {"$sort": {"timestamp": 1}}, {"$limit": 100}, {"$project": {"_id": 0, "timestamp": 1, "value": 1}}]',
      format: 'time_series',
      timeField: 'timestamp',
    });

    // Time series panel should render a canvas chart.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('aggregation pipeline ($group) returns grouped results', async ({ page }) => {
    await fillAndRunQuery(page, {
      database: 'demo',
      collection: 'orders',
      pipeline: '[{"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$project": {"_id": 0, "category": "$_id", "count": 1}}, {"$sort": {"category": 1}}]',
    });

    // Should show the 4 categories from the orders collection.
    await expect(page.getByText('electronics')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('clothing')).toBeVisible();
    await expect(page.getByText('food')).toBeVisible();
    await expect(page.getByText('books')).toBeVisible();
  });

  test('invalid pipeline shows error', async ({ page }) => {
    await fillAndRunQuery(page, {
      database: 'demo',
      collection: 'users',
      pipeline: '[{"$invalidOperator": true}]',
    });

    // Grafana shows an error for the failed query — check via data-testid.
    const errorIndicator = page.getByTestId('data-testid Panel status error');
    await expect(errorIndicator).toBeVisible({ timeout: 15000 });
  });

  test('empty result set shows "No data"', async ({ page }) => {
    await fillAndRunQuery(page, {
      database: 'demo',
      collection: 'users',
      pipeline: '[{"$match": {"name": "NONEXISTENT_USER_12345"}}]',
    });

    await expect(page.getByText('No data')).toBeVisible({ timeout: 15000 });
  });
});
