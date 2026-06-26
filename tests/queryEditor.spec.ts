/**
 * E2E tests for the MongoDB query editor.
 */
import { test, expect } from '@grafana/plugin-e2e';
import { selectOption } from './helpers';

test.describe('Query Editor', () => {
  test('can create a table query', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await expect(page.getByTestId('mongodb-pipeline-editor')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Database' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Collection' })).toBeVisible();
    // Format control: assert the radio options render (works on Grafana 12 and 13,
    // whose radiogroup accessible-name handling differs).
    await expect(page.getByText('Time Series', { exact: true })).toBeVisible();
  });

  test('table format hides time field', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await expect(page.getByRole('radio', { name: 'Table', includeHidden: true })).toBeChecked();
    await expect(page.getByPlaceholder('timestamp')).not.toBeVisible();
  });

  test('switching to time_series format shows Time Field', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('MongoDB');

    await page.getByText('Time Series', { exact: true }).click({ force: true });

    await expect(page.getByPlaceholder('timestamp')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('{{label}}')).toBeVisible();
  });

  test('database dropdown loads real databases', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('MongoDB');

    await page.getByPlaceholder('Select database').click({ force: true });
    await expect(page.getByText('demo', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('collection dropdown loads after selecting database', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('MongoDB');

    await selectOption(page, 'Select database', 'demo');
    await page.getByPlaceholder('Select collection').click({ force: true });

    await expect(page.getByRole('option', { name: 'sensors' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('option', { name: 'users' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'events' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'orders' })).toBeVisible();
  });

  test('running a query returns data in the panel', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await selectOption(page, 'Select database', 'demo');
    await selectOption(page, 'Select collection', 'users');

    // Commit the default pipeline and trigger query execution.
    const pipelineEditor = page.getByTestId('mongodb-pipeline-editor');
    await pipelineEditor.locator('.monaco-editor').first().click({ force: true });
    await pipelineEditor.locator('textarea').first().blur();

    await panelEditPage.refreshPanel();

    await expect(panelEditPage.panel.data).toContainText(['alice@example.com'], { timeout: 15000 });
  });
});
