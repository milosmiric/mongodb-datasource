/**
 * Shared Playwright test utilities for MongoDB datasource E2E tests.
 *
 * Grafana 12.4 DOM reference (prefer data-testid selectors):
 *   - Panel container:   div[data-viz-panel-key="panel-N"]
 *   - Panel header:      [data-testid="data-testid Panel header {Title}"]
 *   - Panel content:     [data-testid="data-testid panel content"]
 *   - Panel error:       [data-testid="data-testid Panel data error message"]
 *   - Panel status:      [data-testid="data-testid Panel status error"]
 *   - Refresh (run):     [data-testid="data-testid RefreshPicker run button"]
 *   - Refresh interval:  [data-testid="data-testid RefreshPicker interval button"]
 *   - Viz picker toggle: [data-testid="data-testid toggle-viz-picker"]
 *   - Viz type option:   [data-testid="data-testid Plugin visualization item {Name}"]
 *
 * Plugin component data-testid attributes:
 *   - Database select:   input#mongodb-database-select
 *   - Collection select: input#mongodb-collection-select
 *   - Pipeline editor:   [data-testid="mongodb-pipeline-editor"]
 */
import { type Page, type Locator, expect } from '@playwright/test';

/** Navigate to a provisioned dashboard and wait for it to load. */
export async function navigateToDashboard(page: Page, uid: string): Promise<void> {
  await page.goto(`/d/${uid}`);
  await page.locator('[data-viz-panel-key]').first().waitFor({ state: 'attached', timeout: 30000 });
}

/** Get a panel locator by its title text using Grafana's data-testid convention. */
export function getPanelByTitle(page: Page, title: string): Locator {
  return page.locator('[data-viz-panel-key]', {
    has: page.getByTestId(`data-testid Panel header ${title}`),
  });
}

/**
 * Wait until a specific panel has rendered data (no "No data" message).
 * Returns the panel locator for further assertions.
 */
export async function waitForPanelData(page: Page, panelTitle: string): Promise<Locator> {
  const panel = getPanelByTitle(page, panelTitle);
  await expect(panel).toBeVisible({ timeout: 20000 });
  await expect(panel.getByText('No data')).not.toBeVisible({ timeout: 20000 });
  return panel;
}

/**
 * Open a new panel editor with the MongoDB datasource.
 *
 * Grafana 12 flow:
 * 1. /dashboard/new → empty dashboard with "Add" button
 * 2. Click "Add visualization" → datasource selector modal opens
 * 3. Click MongoDB in the modal → panel editor opens with viz picker sidebar
 * 4. Select "Table" visualization from the viz picker
 */
export async function openNewPanelEditor(page: Page): Promise<void> {
  await page.goto('/dashboard/new');
  await page.getByRole('button', { name: /add visualization/i }).click();

  // Wait for the "Select data source" modal, then click MongoDB within it.
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  await modal.getByText('MongoDB').first().click();

  // Select "Table" visualization from the viz picker sidebar using data-testid.
  const tableViz = page.getByTestId('data-testid Plugin visualization item Table');
  if (await tableViz.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tableViz.click({ force: true });
  }

  // Wait for the query editor to render (pipeline editor has our data-testid).
  await expect(page.getByTestId('mongodb-pipeline-editor')).toBeVisible({ timeout: 10000 });
}

/**
 * Click on a Grafana Combobox dropdown by its placeholder text.
 * Uses force:true to bypass overlay interception issues.
 */
export async function clickSelect(page: Page, placeholder: string): Promise<void> {
  await page.getByPlaceholder(placeholder).click({ force: true });
}

/**
 * Select a value from a Grafana Combobox dropdown.
 * Types to filter options (handles dropdowns with many items), then clicks the match.
 */
export async function selectOption(page: Page, placeholder: string, value: string): Promise<void> {
  await clickSelect(page, placeholder);
  await page.keyboard.type(value, { delay: 30 });
  await page.getByRole('option', { name: value }).click();
}

/**
 * Commit the pipeline editor value and trigger query execution.
 * The Monaco editor's default value isn't committed until onBlur fires.
 */
export async function commitPipelineAndRefresh(page: Page): Promise<void> {
  const pipelineEditor = page.getByTestId('mongodb-pipeline-editor');
  await pipelineEditor.locator('.monaco-editor').first().click({ force: true });
  await page.locator('label', { hasText: 'Pipeline' }).click({ force: true });
  await page.getByTestId('data-testid RefreshPicker run button').click();
}
