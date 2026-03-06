/**
 * E2E tests for the MongoDB datasource health check.
 */
import { test, expect } from '@grafana/plugin-e2e';

test.describe('Health Check', () => {
  test('datasource health check succeeds', async ({ gotoDataSourceConfigPage }) => {
    const configPage = await gotoDataSourceConfigPage('mongodb-demo');
    await expect(configPage.saveAndTest()).toBeOK();
    await expect(configPage.ctx.page.getByText(/MongoDB connected/i)).toBeVisible({ timeout: 15000 });
  });
});
