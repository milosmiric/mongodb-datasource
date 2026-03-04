/**
 * Playwright E2E test configuration for the MongoDB datasource plugin.
 *
 * Tests run against the Grafana instance started via Docker Compose on port 3105.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3105',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    httpCredentials: {
      username: 'admin',
      password: 'admin',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
