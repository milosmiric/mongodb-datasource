/**
 * Comprehensive E2E tests for the provisioned MongoDB sample dashboard.
 *
 * Uses @grafana/plugin-e2e's DashboardPage and Panel abstractions.
 * Panel assertions use getErrorIcon() (not panel.data) because plugin-e2e's
 * getPanelByTitle scopes the Panel locator to the header element — gridcell
 * lookups don't work on dashboard pages. Data content assertions live in
 * queryExecution.spec.ts via panelEditPage where panel.data works correctly.
 */
import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'mongodb-sample';

test.describe('Sample Dashboard', () => {
  test('dashboard loads with correct title', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });
    await expect(page.getByText('MongoDB Sample Dashboard')).toBeVisible({ timeout: 15000 });
  });

  // --- Row 1: Time Series — Sensors ---

  test('Sensor Readings panel renders chart', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getPanelByTitle('Sensor Readings Over Time');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Sensor Gauge panel renders', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getPanelByTitle('Sensor Gauge');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Reading Count stat panel shows a number', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getPanelByTitle('Reading Count');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Total Sensor Readings stat panel renders', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getPanelByTitle('Total Sensor Readings');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  // --- Row 2: Aggregations ---

  test('Avg Value by Sensor Type bar chart renders', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getPanelByTitle('Avg Value by Sensor Type');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Readings by Location pie chart renders', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getPanelByTitle('Readings by Location');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Event Type Distribution bar gauge renders', async ({ gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getPanelByTitle('Event Type Distribution');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  // --- Row 3: Tables ---

  test('Recent Events table renders', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 800));
    const panel = dashboardPage.getPanelByTitle('Recent Events');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Users table renders', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 800));
    const panel = dashboardPage.getPanelByTitle('Users');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  // --- Row 4: Orders Analytics ---

  test('Revenue Over Time panel renders chart', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 1200));
    const panel = dashboardPage.getPanelByTitle('Revenue Over Time');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Sales by Category pie chart renders', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 1200));
    const panel = dashboardPage.getPanelByTitle('Sales by Category');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Top Products table renders', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 1200));
    const panel = dashboardPage.getPanelByTitle('Top Products');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  // --- Row 5: Orders by Region ---

  test('Orders by Region bar chart renders', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 1800));
    const panel = dashboardPage.getPanelByTitle('Orders by Region');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  test('Order Status Breakdown pie chart renders', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 1800));
    const panel = dashboardPage.getPanelByTitle('Order Status Breakdown');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  // --- Row 6: BSON Types ---

  test('Types Showcase table renders', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 2400));
    const panel = dashboardPage.getPanelByTitle('Types Showcase');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 20000 });
  });

  // --- Template variables ---

  test('template variable dropdowns are present', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });
    await expect(page.getByText('Sensor').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Location').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
  });

  // --- Error state ---

  test('no panels show error state', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.waitForTimeout(5000);
    const errorCount = await page.getByTestId('data-testid Panel data error message').count();
    expect(errorCount).toBe(0);
  });

  test('no panels show "No data"', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.waitForTimeout(8000);
    const noDataCount = await page.getByText('No data').count();
    expect(noDataCount).toBe(0);
  });

  test('selecting single sensor type still renders panels', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const sensorVar = page.getByTestId('data-testid template variable').filter({
      has: page.getByTestId('data-testid Dashboard template variables submenu Label Sensor'),
    });
    const combobox = sensorVar.getByRole('combobox');
    await combobox.click();
    await combobox.fill('temperature');
    await page.getByRole('option', { name: 'temperature' }).first().click();
    await page.keyboard.press('Escape');

    await page.waitForTimeout(5000);

    const panel = dashboardPage.getPanelByTitle('Sensor Readings Over Time');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });

  test('selecting multiple sensor types still renders panels', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const sensorVar = page.getByTestId('data-testid template variable').filter({
      has: page.getByTestId('data-testid Dashboard template variables submenu Label Sensor'),
    });
    const combobox = sensorVar.getByRole('combobox');
    await combobox.click();
    await combobox.fill('temperature');
    await page.getByRole('option', { name: 'temperature' }).first().click();

    await combobox.fill('humidity');
    await page.getByRole('option', { name: 'humidity' }).first().click();
    await page.keyboard.press('Escape');

    await page.waitForTimeout(5000);

    const panel = dashboardPage.getPanelByTitle('Sensor Readings Over Time');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });

  test('selecting single category still renders order panels', async ({ gotoDashboardPage, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await page.evaluate(() => window.scrollBy(0, 1200));

    const catVar = page.getByTestId('data-testid template variable').filter({
      has: page.getByTestId('data-testid Dashboard template variables submenu Label Category'),
    });
    const combobox = catVar.getByRole('combobox');
    await combobox.click();
    await combobox.fill('electronics');
    await page.getByRole('option', { name: 'electronics' }).first().click();
    await page.keyboard.press('Escape');

    await page.waitForTimeout(5000);

    const panel = dashboardPage.getPanelByTitle('Sales by Category');
    await expect(panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });
});
