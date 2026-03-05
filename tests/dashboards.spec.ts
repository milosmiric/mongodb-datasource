/**
 * Comprehensive E2E tests for the provisioned MongoDB sample dashboard.
 *
 * Grafana 12.4 selectors:
 *   - Panel wrapper: [data-viz-panel-key]
 *   - Panel header:  [data-testid="data-testid Panel header {Title}"]
 *   - Error message: [data-testid="data-testid Panel data error message"]
 */
import { test, expect } from '@playwright/test';
import { navigateToDashboard, waitForPanelData } from './helpers';

const DASHBOARD_UID = 'mongodb-sample';

test.describe('Sample Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, DASHBOARD_UID);
  });

  test('dashboard loads with correct title', async ({ page }) => {
    await expect(page.getByText('MongoDB Sample Dashboard')).toBeVisible({ timeout: 15000 });
  });

  // --- Row 1: Time Series — Sensors ---

  test('Sensor Readings panel renders chart', async ({ page }) => {
    const panel = await waitForPanelData(page, 'Sensor Readings Over Time');
    // Time series panels render a canvas element for the chart.
    await expect(panel.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('Sensor Gauge panel renders', async ({ page }) => {
    const panel = await waitForPanelData(page, 'Sensor Gauge');
    await expect(panel.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('Reading Count stat panel shows a number', async ({ page }) => {
    await waitForPanelData(page, 'Reading Count');
  });

  test('Total Sensor Readings stat panel renders', async ({ page }) => {
    await waitForPanelData(page, 'Total Sensor Readings');
  });

  // --- Row 2: Aggregations ---

  test('Avg Value by Sensor Type bar chart renders', async ({ page }) => {
    const panel = await waitForPanelData(page, 'Avg Value by Sensor Type');
    await expect(panel.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('Readings by Location pie chart renders', async ({ page }) => {
    const panel = await waitForPanelData(page, 'Readings by Location');
    // Pie charts use either canvas or SVG.
    const hasCanvas = await panel.locator('canvas').count();
    const hasSvg = await panel.locator('svg').count();
    expect(hasCanvas + hasSvg).toBeGreaterThan(0);
  });

  test('Event Type Distribution bar gauge renders', async ({ page }) => {
    await waitForPanelData(page, 'Event Type Distribution');
  });

  // --- Row 3: Tables ---

  test('Recent Events table has data rows', async ({ page }) => {
    // Scroll down to make table panels visible.
    await page.evaluate(() => window.scrollBy(0, 800));
    const panel = await waitForPanelData(page, 'Recent Events');
    await expect(panel.getByText('page_view').first()).toBeVisible({ timeout: 15000 });
  });

  test('Users table shows user data', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 800));
    const panel = await waitForPanelData(page, 'Users');
    await expect(panel.getByText('Alice Chen')).toBeVisible({ timeout: 15000 });
    await expect(panel.getByText('admin').first()).toBeVisible();
  });

  // --- Row 4: Orders Analytics ---

  test('Revenue Over Time panel renders chart', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 1200));
    const panel = await waitForPanelData(page, 'Revenue Over Time');
    await expect(panel.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('Sales by Category pie chart renders', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await waitForPanelData(page, 'Sales by Category');
  });

  test('Top Products table has data', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 1200));
    const panel = await waitForPanelData(page, 'Top Products');
    await expect(panel.getByText('product').first()).toBeVisible({ timeout: 15000 });
  });

  // --- Row 5: Orders by Region ---

  test('Orders by Region bar chart renders', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 1800));
    const panel = await waitForPanelData(page, 'Orders by Region');
    await expect(panel.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('Order Status Breakdown pie chart renders', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await waitForPanelData(page, 'Order Status Breakdown');
  });

  // --- Row 6: BSON Types ---

  test('Types Showcase table renders BSON data', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 2400));
    const panel = await waitForPanelData(page, 'Types Showcase');
    await expect(panel.getByText('hello world').first()).toBeVisible({ timeout: 15000 });
  });

  // --- Template variables ---

  test('template variable dropdowns are present', async ({ page }) => {
    // Grafana renders template variables with their label at the top of the dashboard.
    // Variable names are sensor_type/loc/cat but labels are Sensor/Location/Category.
    await expect(page.getByText('Sensor').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Location').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
  });

  // --- Error state ---

  test('no panels show error state', async ({ page }) => {
    // Wait for panels to finish loading.
    await page.waitForTimeout(5000);

    // Check there are no panel error indicators (Grafana 12 uses this data-testid).
    const errorCount = await page.getByTestId('data-testid Panel data error message').count();
    expect(errorCount).toBe(0);
  });

  test('no panels show "No data"', async ({ page }) => {
    // Give panels time to finish loading.
    await page.waitForTimeout(8000);

    const noDataCount = await page.getByText('No data').count();
    expect(noDataCount).toBe(0);
  });

  test('selecting single sensor type still renders panels', async ({ page }) => {
    // Grafana multi-select variable: find the variable container by its label data-testid,
    // then locate the combobox input inside it.
    const sensorVar = page.getByTestId('data-testid template variable').filter({
      has: page.getByTestId('data-testid Dashboard template variables submenu Label Sensor'),
    });
    const combobox = sensorVar.getByRole('combobox');
    await combobox.click();
    await combobox.fill('temperature');
    await page.getByRole('option', { name: 'temperature' }).first().click();
    await page.keyboard.press('Escape');

    // Wait for panels to refresh after variable change.
    await page.waitForTimeout(5000);

    // Sensor Readings panel should still render data (not error or "No data").
    const panel = await waitForPanelData(page, 'Sensor Readings Over Time');
    await expect(panel.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('selecting multiple sensor types still renders panels', async ({ page }) => {
    // Find the Sensor variable container and interact with combobox.
    const sensorVar = page.getByTestId('data-testid template variable').filter({
      has: page.getByTestId('data-testid Dashboard template variables submenu Label Sensor'),
    });
    const combobox = sensorVar.getByRole('combobox');
    await combobox.click();
    await combobox.fill('temperature');
    await page.getByRole('option', { name: 'temperature' }).first().click();

    // Add a second value.
    await combobox.fill('humidity');
    await page.getByRole('option', { name: 'humidity' }).first().click();
    await page.keyboard.press('Escape');

    // Wait for panels to refresh after variable change.
    await page.waitForTimeout(5000);

    // Sensor Readings panel should still render data (multi-select → $in).
    const panel = await waitForPanelData(page, 'Sensor Readings Over Time');
    await expect(panel.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('selecting single category still renders order panels', async ({ page }) => {
    // Scroll to Orders row.
    await page.evaluate(() => window.scrollBy(0, 1200));

    // Find Category variable container and interact with combobox.
    const catVar = page.getByTestId('data-testid template variable').filter({
      has: page.getByTestId('data-testid Dashboard template variables submenu Label Category'),
    });
    const combobox = catVar.getByRole('combobox');
    await combobox.click();
    await combobox.fill('electronics');
    await page.getByRole('option', { name: 'electronics' }).first().click();
    await page.keyboard.press('Escape');

    // Wait for panels to refresh.
    await page.waitForTimeout(5000);

    // Sales by Category should still render.
    await waitForPanelData(page, 'Sales by Category');
  });
});
