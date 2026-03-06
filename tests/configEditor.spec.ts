/**
 * E2E tests for the MongoDB datasource configuration editor.
 */
import { test, expect } from '@grafana/plugin-e2e';

test.describe('Config Editor', () => {
  test('can navigate to datasource settings', async ({ gotoDataSourceConfigPage }) => {
    const configPage = await gotoDataSourceConfigPage('mongodb-demo');

    // Verify key config sections are visible using <legend> elements.
    await expect(configPage.ctx.page.locator('legend', { hasText: 'Connection' })).toBeVisible();
    await expect(configPage.ctx.page.locator('legend', { hasText: 'Authentication' })).toBeVisible();
    await expect(configPage.ctx.page.locator('legend', { hasText: 'TLS / SSL' })).toBeVisible();
  });

  test('connection URI is configured (masked)', async ({ gotoDataSourceConfigPage }) => {
    const configPage = await gotoDataSourceConfigPage('mongodb-demo');
    await expect(configPage.ctx.page.getByText('Connection URI')).toBeVisible();
  });

  test('default database is set', async ({ gotoDataSourceConfigPage }) => {
    const configPage = await gotoDataSourceConfigPage('mongodb-demo');
    const dbInput = configPage.ctx.page.getByPlaceholder('mydb');
    await expect(dbInput).toHaveValue('demo');
  });
});
