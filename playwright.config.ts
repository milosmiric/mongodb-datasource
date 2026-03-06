/**
 * Playwright E2E test configuration for the MongoDB datasource plugin.
 *
 * Uses @grafana/plugin-e2e for storage-state auth and Grafana-aware fixtures.
 * Tests run against the Grafana instance started via Docker Compose on port 3105.
 */
import { defineConfig, devices } from '@playwright/test';
import type { PluginOptions } from '@grafana/plugin-e2e';
import { dirname } from 'node:path';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

export default defineConfig<PluginOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3105',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'auth',
      testDir: pluginE2eAuth,
      testMatch: [/auth\.setup/],
    },
    {
      name: 'run-tests',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
      dependencies: ['auth'],
    },
  ],
});
