# E2E Testing — @grafana/plugin-e2e + Playwright

## Framework

Tests use [`@grafana/plugin-e2e`](https://grafana.com/developers/plugin-tools/e2e-test-a-plugin/introduction) — Grafana's official E2E testing framework. It provides fixtures and utilities that abstract away Grafana version differences:

- **Storage-state auth** — no `httpCredentials`, uses `auth.setup` project
- **`panelEditPage`** — fixture for creating panels, setting datasource/visualization, refreshing
- **`gotoDashboardPage`** — fixture for navigating to provisioned dashboards
- **`gotoDataSourceConfigPage`** — fixture for datasource settings pages
- **`panel.getErrorIcon()`** — version-safe error detection on panels
- **`panel.data`** — table data assertions (works in panel edit mode)
- **`panelEditPage.setVisualization()`** — version-safe viz picker (replaces manual DOM interaction)
- **`panelEditPage.refreshPanel()`** — triggers query execution
- **`configPage.saveAndTest()`** — health check with `toBeOK()` matcher

## Configuration

`playwright.config.ts` defines two projects:

1. **`auth`** — runs `@grafana/plugin-e2e`'s `auth.setup` to create `playwright/.auth/admin.json`
2. **`run-tests`** — uses stored auth state, depends on `auth` project

```typescript
import { defineConfig, devices } from '@playwright/test';
import type { PluginOptions } from '@grafana/plugin-e2e';
import { dirname } from 'node:path';
const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

export default defineConfig<PluginOptions>({
  testDir: './tests',
  use: { baseURL: 'http://localhost:3105' },
  projects: [
    { name: 'auth', testDir: pluginE2eAuth, testMatch: [/auth\.setup/] },
    {
      name: 'run-tests',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
      dependencies: ['auth'],
    },
  ],
});
```

## Test Files

| File | Tests | What it covers |
|------|-------|----------------|
| `healthCheck.spec.ts` | 1 | `saveAndTest()` + `toBeOK()` |
| `configEditor.spec.ts` | 3 | Datasource settings page fields and sections |
| `queryEditor.spec.ts` | 6 | Panel editor components, format toggle, datasource selection |
| `queryExecution.spec.ts` | 9 | Table/time-series queries, macros, errors, empty states |
| `dashboards.spec.ts` | 22 | Sample dashboard panels, template variables, scrolling |
| `authMechanisms.spec.ts` | 8 | SCRAM-SHA-256/1, X.509, wrong password, API queries |

**Total: 49 E2E tests** — verified across Grafana 12.3, 12.4, and 13.0.

## Helpers (`tests/helpers.ts`)

Only two plugin-specific helpers — everything else is handled by `@grafana/plugin-e2e`:

| Helper | Purpose |
|--------|---------|
| `selectOption(page, placeholder, value)` | Interact with Grafana Combobox dropdowns |
| `fillAndRunQuery(panelEditPage, opts)` | Fill database/collection/pipeline and run query |

## Test Patterns

### Health Check
```typescript
import { test, expect } from '@grafana/plugin-e2e';
test('datasource health check succeeds', async ({ gotoDataSourceConfigPage }) => {
  const configPage = await gotoDataSourceConfigPage({ uid: 'mongodb-demo' });
  await expect(configPage.saveAndTest()).toBeOK();
});
```

### Query Execution (Panel Edit)
```typescript
test('table query returns data', async ({ panelEditPage }) => {
  await panelEditPage.datasource.set('MongoDB');
  await panelEditPage.setVisualization('Table');
  await fillAndRunQuery(panelEditPage, {
    database: 'demo', collection: 'users',
    pipeline: '[{"$match": {}}]',
  });
  await expect(panelEditPage.panel.data).toContainText(['Alice']);
});
```

### Dashboard Panel Assertions
```typescript
test('panel renders without errors', async ({ gotoDashboardPage }) => {
  const dashboardPage = await gotoDashboardPage({ uid: 'mongodb-sample' });
  const panel = await dashboardPage.getPanelByTitle('Temperature Over Time');
  await expect(panel.getErrorIcon()).not.toBeVisible();
});
```

### Error Detection
```typescript
await expect(panelEditPage.panel.getErrorIcon()).toBeVisible();
```

## Key Gotchas

### `panel.data` Only Works in Panel Edit Mode
On dashboard pages, `getPanelByTitle()` scopes the `Panel` locator to the panel header, not the full panel container. This means `panel.data` (which looks for `[role="gridcell"]`) finds 0 elements. Use `panel.getErrorIcon()` for dashboard assertions instead.

### Monaco Editor Default Value Not Committed
The `CodeEditor` (Monaco) shows a default value but doesn't commit it to the query model until `onBlur` fires:
```typescript
await editor.click({ force: true });
await page.keyboard.type(pipeline, { delay: 5 });
await queryRow.locator('label', { hasText: 'Pipeline' }).click({ force: true }); // blur to commit
```

### Combobox Dropdowns
Grafana's `Combobox` renders an `<input>` — use `getByPlaceholder` (not `getByText`):
```typescript
await page.getByPlaceholder('Select database').click({ force: true });
await page.keyboard.type(value, { delay: 30 });
await page.getByRole('option', { name: value }).click();
```

### force: true for Overlapped Elements
The viz picker sidebar and portal containers can intercept clicks. Use `{ force: true }` for clicks on query editor elements.

### Scrolling for Below-Fold Panels
Dashboard panels below the fold need explicit scrolling — Grafana virtualizes off-screen panels:
```typescript
await page.evaluate(() => window.scrollBy(0, 800));
```

### Scope Selectors to Query Editor Row
Some elements appear in both the query editor and panel options sidebar:
```typescript
page.getByTestId('query-editor-row').locator('label[for*="option-time_series"]')
```

## Template Variable Pitfalls

### Variable Names Collide with MongoDB Field Refs
Grafana replaces `$variable_name` globally. If a variable is named `location`, then `"$location"` in pipelines gets replaced too.
**Solution**: Use non-colliding names like `sensor_type`, `loc` with friendly labels.

### $__from/$__to Are Replaced by Frontend
Grafana frontend replaces `$__from` and `$__to` with epoch milliseconds before the backend sees the query.
**Solution**: Use `$__timeFilter(field)` macro instead — it's processed server-side with proper Extended JSON dates.

### $__all Normalization
When using `$__match` with `allValue: "$__all"`, Grafana outputs the bare string `$__all` without JSON quotes. The backend normalizes this automatically.

## Cross-Version Testing

```bash
# Test against specific Grafana versions
make e2e-version GRAFANA_E2E_VERSION=12.3.4 GRAFANA_E2E_IMAGE=grafana-enterprise
make e2e-version GRAFANA_E2E_VERSION=12.4.0 GRAFANA_E2E_IMAGE=grafana-enterprise
make e2e-version GRAFANA_E2E_VERSION=13.0.0-dev GRAFANA_E2E_IMAGE=grafana-dev
make e2e-compat  # Run all three
```

## Grafana 12 DOM Selectors (Reference)

These are useful when writing plugin-specific selectors outside of `@grafana/plugin-e2e` abstractions:

| Element | Selector |
|---------|----------|
| Panel header | `[data-testid="data-testid Panel header {Title}"]` |
| Panel error icon | `[data-testid="data-testid Panel status error"]` |
| Refresh button | `[data-testid="data-testid RefreshPicker run button"]` |
| Viz type option | `[data-testid="data-testid Plugin visualization item {Name}"]` |
| Time picker | `[data-testid="data-testid TimePicker Open Button"]` |
| Query editor row | `[data-testid="query-editor-row"]` |
