/**
 * E2E tests for native dashboard variable (Query type) support.
 *
 * Covers both ends of the feature:
 *  - the variable editor UI (builder vs raw pipeline modes), and
 *  - real variable resolution on a provisioned dashboard, where a Query
 *    variable populates a dropdown and feeds a panel through `$__match`.
 *
 * The provisioned `mongodb-variables` dashboard defines two Query variables over
 * the seeded `demo.users` collection (roles: admin, editor, viewer):
 *  - index 0, "Role"       — builder mode (distinct values of the `role` field)
 *  - index 1, "Role (raw)" — raw pipeline mode (hand-written $group/$project)
 */
import { test, expect, type Page } from '@grafana/plugin-e2e';

import { selectOption } from './helpers';

const EXPECTED_ROLES = ['admin', 'editor', 'viewer'];

/** Open the Nth dashboard template-variable dropdown (provisioned order). */
async function openVariable(page: Page, index: number) {
  await page.getByTestId('data-testid template variable').nth(index).getByRole('combobox').click({ force: true });
}

/**
 * Assert the Nth variable dropdown offers all `expected` options.
 *
 * The dropdown can momentarily show only "All" and then re-render (closing
 * itself) once the async query resolves, so we retry opening until the options
 * are present.
 */
async function expectVariableOptions(page: Page, index: number, expected: string[]) {
  await expect(async () => {
    if ((await page.getByRole('option').count()) === 0) {
      await openVariable(page, index);
    }
    for (const name of expected) {
      await expect(page.getByRole('option', { name, exact: true })).toBeVisible({ timeout: 2000 });
    }
  }).toPass({ timeout: 20000 });
}

test.describe('Dashboard variable support', () => {
  test('builder-mode variable resolves to the distinct field values', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: 'mongodb-variables' });
    await expectVariableOptions(page, 0, EXPECTED_ROLES);
  });

  test('raw-pipeline variable resolves to the option values', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: 'mongodb-variables' });
    await expectVariableOptions(page, 1, EXPECTED_ROLES);
  });

  test('a selected variable value feeds the panel via $__match', async ({ gotoDashboardPage, page }) => {
    // Baseline: with the default "All" selection, the panel shows every role.
    const allPage = await gotoDashboardPage({ uid: 'mongodb-variables' });
    await allPage.getPanelByTitle('Users by role').scrollIntoView();
    await expect(page.getByRole('region', { name: 'Users by role' })).toContainText('viewer', { timeout: 15000 });

    // Pin `selrole` to "admin" via the URL (deterministic across Grafana 12/13,
    // avoiding multi-select All/deselect quirks) and confirm $__match filters
    // the panel down to the admin row only.
    const adminPage = await gotoDashboardPage({
      uid: 'mongodb-variables',
      queryParams: new URLSearchParams({ 'var-selrole': 'admin' }),
    });
    await adminPage.getPanelByTitle('Users by role').scrollIntoView();
    const panel = page.getByRole('region', { name: 'Users by role' });
    await expect(panel).toContainText('admin', { timeout: 15000 });
    await expect(panel).not.toContainText('viewer');
    await expect(panel).not.toContainText('editor');
  });

  test('variable editor exposes builder and raw modes', async ({ gotoVariablePage, page }) => {
    const variablePage = await gotoVariablePage({});
    const variableEditPage = await variablePage.clickAddNew();
    await variableEditPage.setVariableType('Query');
    await variableEditPage.datasource.set('MongoDB');

    // Builder mode (default): database, collection and field inputs are shown.
    await expect(page.getByText('Mode', { exact: true })).toBeVisible();
    await selectOption(page, 'Select database', 'demo');
    await selectOption(page, 'Select collection', 'users');
    await expect(page.getByPlaceholder('sensor')).toBeVisible();

    // Switching to raw mode reveals the pipeline editor instead.
    await page.getByText('Raw pipeline', { exact: true }).click({ force: true });
    await expect(page.getByTestId('mongodb-pipeline-editor')).toBeVisible();
    await expect(page.getByPlaceholder('sensor')).toBeHidden();
  });
});
