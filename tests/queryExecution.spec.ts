/**
 * E2E tests focused on query execution — verifying actual data results.
 */
import { test, expect } from '@grafana/plugin-e2e';
import { fillAndRunQuery } from './helpers';

test.describe('Query Execution', () => {
  test('table query returns data', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'users',
      pipeline: '[{"$project": {"_id": 0, "name": 1, "email": 1, "role": 1}}]',
    });

    await expect(panelEditPage.panel.data).toContainText(['Alice Chen'], { timeout: 15000 });
    await expect(panelEditPage.panel.data).toContainText(['bob@example.com']);
  });

  test('time_series query renders chart', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'sensors',
      pipeline: '[{"$match": {"sensor": "temperature"}}, {"$sort": {"timestamp": 1}}, {"$limit": 100}, {"$project": {"_id": 0, "timestamp": 1, "value": 1}}]',
      format: 'time_series',
      timeField: 'timestamp',
    });

    await expect(panelEditPage.panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });

  test('aggregation pipeline ($group) returns grouped results', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'orders',
      pipeline: '[{"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$project": {"_id": 0, "category": "$_id", "count": 1}}, {"$sort": {"category": 1}}]',
    });

    await expect(panelEditPage.panel.data).toContainText(['electronics'], { timeout: 15000 });
    await expect(panelEditPage.panel.data).toContainText(['clothing']);
    await expect(panelEditPage.panel.data).toContainText(['food']);
    await expect(panelEditPage.panel.data).toContainText(['books']);
  });

  test('invalid pipeline shows error', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'users',
      pipeline: '[{"$invalidOperator": true}]',
    });

    await expect(panelEditPage.panel.getErrorIcon()).toBeVisible({ timeout: 15000 });
  });

  test('empty result set shows "No data"', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'users',
      pipeline: '[{"$match": {"name": "NONEXISTENT_USER_12345"}}]',
    });

    await expect(panelEditPage.ctx.page.getByText('No data')).toBeVisible({ timeout: 15000 });
  });

  test('$__timeFilter macro returns time-filtered data', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'sensors',
      pipeline: '[{"$match": {$__timeFilter(timestamp)}}, {"$limit": 10}, {"$project": {"_id": 0, "timestamp": 1, "value": 1, "sensor": 1}}]',
    });

    await expect(panelEditPage.panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });

  test('$__timeGroup macro produces bucketed results', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'sensors',
      pipeline: '[{"$match": {$__timeFilter(timestamp)}}, {"$group": {"_id": $__timeGroup(timestamp), "count": {"$sum": 1}}}, {"$project": {"_id": 0, "timestamp": "$_id", "count": 1}}, {"$sort": {"timestamp": 1}}, {"$limit": 20}]',
      format: 'time_series',
      timeField: 'timestamp',
    });

    await expect(panelEditPage.panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });

  test('$__timeFilter_ms macro filters epoch-ms timestamps', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'sensors',
      pipeline: '[{"$addFields": {"ts_ms": {"$toLong": "$timestamp"}}}, {"$match": {$__timeFilter_ms(ts_ms)}}, {"$limit": 10}, {"$project": {"_id": 0, "sensor": 1, "value": 1, "ts_ms": 1}}]',
    });

    await expect(panelEditPage.panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });

  test('$__oidFilter macro filters by ObjectId range', async ({ panelEditPage }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await fillAndRunQuery(panelEditPage, {
      database: 'demo',
      collection: 'users',
      pipeline: '[{"$match": {$__oidFilter(_id)}}, {"$project": {"_id": 0, "name": 1, "email": 1}}]',
    });

    await expect(panelEditPage.panel.getErrorIcon()).not.toBeVisible({ timeout: 15000 });
  });
});
