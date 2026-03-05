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

  // Wait for the query editor to render (pipeline editor has our data-testid).
  await expect(page.getByTestId('mongodb-pipeline-editor')).toBeVisible({ timeout: 10000 });

  // Select "Table" visualization. The viz picker sidebar may or may not be open.
  await selectVisualization(page, 'Table');
}

/**
 * Select a visualization type in the panel editor.
 * Opens the viz picker if needed, then clicks the target visualization.
 * Works across Grafana 12.3.x and 12.4+.
 */
export async function selectVisualization(page: Page, name: string): Promise<void> {
  const vizItem =
    page.getByTestId(`data-testid Plugin visualization item ${name}`)
      .or(page.getByLabel(`Plugin visualization item ${name}`));

  // If the viz picker sidebar is already open, just click.
  if (await vizItem.isVisible({ timeout: 1000 }).catch(() => false)) {
    await vizItem.click({ force: true });
    return;
  }

  // Open the viz picker by clicking the visualization type dropdown.
  // Try the toggle button first (12.4+), then the visualization type text (12.3.x).
  const vizToggle = page.getByTestId('data-testid toggle-viz-picker');
  if (await vizToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
    await vizToggle.click();
  } else {
    // In 12.3.x, click the viz type selector area in the options sidebar.
    await page.locator('[id="data-testid select a panel type button"]').click();
  }

  await expect(vizItem).toBeVisible({ timeout: 5000 });
  await vizItem.click({ force: true });
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
  const queryRow = page.getByTestId('query-editor-row');
  const pipelineEditor = page.getByTestId('mongodb-pipeline-editor');
  await pipelineEditor.locator('.monaco-editor').first().click({ force: true });
  await queryRow.locator('label', { hasText: 'Pipeline' }).click({ force: true });
  await page.getByTestId('data-testid RefreshPicker run button').click();
}
