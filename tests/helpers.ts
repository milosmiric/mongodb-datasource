/**
 * Shared Playwright test utilities for MongoDB datasource E2E tests.
 *
 * Only plugin-specific helpers live here. Grafana abstractions (navigation,
 * panel assertions, viz picking) are handled by @grafana/plugin-e2e fixtures.
 */
import { type Page } from '@playwright/test';
import { type PanelEditPage } from '@grafana/plugin-e2e';

/**
 * Select a value from a Grafana Combobox dropdown.
 * Types to filter options (handles dropdowns with many items), then clicks the match.
 */
export async function selectOption(page: Page, placeholder: string, value: string): Promise<void> {
  await page.getByPlaceholder(placeholder).click({ force: true });
  await page.keyboard.type(value, { delay: 30 });
  await page.getByRole('option', { name: value }).click();
}

/**
 * Fill query editor fields and run a query using plugin-e2e's PanelEditPage.
 */
export async function fillAndRunQuery(
  panelEditPage: PanelEditPage,
  opts: {
    database: string;
    collection: string;
    pipeline: string;
    format?: 'table' | 'time_series';
    timeField?: string;
  }
): Promise<void> {
  const page = panelEditPage.ctx.page;

  // Select database and collection.
  await selectOption(page, 'Select database', opts.database);
  await selectOption(page, 'Select collection', opts.collection);

  // Scope to query editor row to avoid matching panel option labels.
  const queryRow = page.getByTestId('query-editor-row');

  // Set format if needed.
  if (opts.format === 'time_series') {
    await panelEditPage.setVisualization('Time series');
    await queryRow.locator('label[for*="option-time_series"]').click({ force: true });
    if (opts.timeField) {
      const timeInput = queryRow.getByPlaceholder('timestamp');
      await timeInput.clear();
      await timeInput.fill(opts.timeField);
      await timeInput.blur();
    }
  }

  // Set pipeline using the code editor (Monaco) inside our data-testid wrapper.
  const pipelineEditor = page.getByTestId('mongodb-pipeline-editor');
  const editor = pipelineEditor.locator('.monaco-editor').first();
  await editor.click({ force: true });
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+a`);
  await page.keyboard.type(opts.pipeline, { delay: 5 });

  // Click outside the editor to commit the pipeline value.
  await queryRow.locator('label', { hasText: 'Pipeline' }).click({ force: true });

  // Trigger query execution via plugin-e2e.
  await panelEditPage.refreshPanel();
}
