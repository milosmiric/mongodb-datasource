# E2E Testing Learnings — Grafana 12.4 + Playwright

## Grafana 12 DOM Selectors

| Element | Selector |
|---------|----------|
| Panel wrapper | `[data-viz-panel-key]` or `[data-viz-panel-key="panel-N"]` |
| Panel header | `[data-testid="data-testid Panel header {Title}"]` |
| Panel content | `[data-testid="data-testid panel content"]` |
| Panel error | `[data-testid="data-testid Panel data error message"]` |
| Panel status error icon | `[data-testid="data-testid Panel status error"]` |
| Refresh (run) button | `[data-testid="data-testid RefreshPicker run button"]` |
| Refresh interval dropdown | `[data-testid="data-testid RefreshPicker interval button"]` |
| Time picker | `[data-testid="data-testid TimePicker Open Button"]` |
| Viz picker toggle | `[data-testid="data-testid toggle-viz-picker"]` (Back button) |
| Viz type option | `[data-testid="data-testid Plugin visualization item {Name}"]` |
| Save dashboard | `[data-testid="data-testid Save dashboard button"]` |
| Discard panel | `[data-testid="data-testid Discard changes button"]` |
| Back to dashboard | `[data-testid="data-testid Back to dashboard button"]` |
| Duplicate query | `[data-testid="data-testid Duplicate query"]` |
| Remove query | `[data-testid="data-testid Remove query"]` |
| Hide response | `[data-testid="data-testid Hide response"]` |
| Add query | `[data-testid="data-testid query-tab-add-query"]` |
| Add expression | `[data-testid="data-testid query-tab-add-expression"]` |
| Query name | `[data-testid="query-name-div"]` |

## Panel Editor Flow (Grafana 12)

1. Navigate to `/dashboard/new`
2. Click "Add visualization" button
3. Wait for `page.getByRole('dialog')` — datasource selector modal
4. Click datasource name **within the modal** (scope to dialog to avoid matching query row text)
5. Viz picker sidebar opens on the right — select "Table" or desired visualization
6. Query editor renders below the panel preview

## Key Gotchas

### Refresh Button is Split
The top-bar "Refresh" area has **two separate buttons**:
- `data-testid="data-testid RefreshPicker run button"` — **executes refresh** (use this!)
- `data-testid="data-testid RefreshPicker interval button"` — opens auto-refresh interval dropdown
- `getByRole('button', { name: /refresh/i })` matches the run button but can be unreliable

### Monaco Editor Default Value Not Committed
The `CodeEditor` (Monaco) shows a default value but doesn't commit it to the query model until `onBlur` fires. To commit:
```typescript
await page.locator('.monaco-editor').first().click({ force: true });
await page.locator('label', { hasText: 'Pipeline' }).click({ force: true }); // blur
```

### onRunQuery Doesn't Always Execute
In a new (unsaved) panel, `onRunQuery()` called from component onChange may not trigger a backend call. Use the RefreshPicker run button to explicitly trigger execution.

### Combobox Dropdowns (formerly Select)
We use Grafana's `Combobox` component (replaced deprecated `Select`). Combobox renders an `<input>` element, so use `getByPlaceholder` (not `getByText`) to locate it, and `getByRole('option')` to click options:
```typescript
await page.getByPlaceholder('Select database').click({ force: true });
await page.keyboard.type(value, { delay: 30 });
await page.getByRole('option', { name: value }).click();
```
Key differences from Select: placeholder text lives in the `<input>` element (invisible to `getByText`), and dropdown options use ARIA `option` role.

### force: true Required for Overlapped Elements
The viz picker sidebar and portal containers can intercept clicks. Use `{ force: true }` for clicks on query editor elements that might be partially covered.

### Config Editor: Use `legend` Not `getByText` for Section Headers
Section headers like "Connection", "Authentication" also appear in nav sidebar. Scope with:
```typescript
page.locator('legend', { hasText: 'Connection' })
```

### Scrolling for Below-Fold Panels
Dashboard panels below the fold need explicit scrolling:
```typescript
await page.evaluate(() => window.scrollBy(0, 800));
```

## Template Variable Pitfalls

### Variable Names Collide with MongoDB Field Refs
Grafana replaces `$variable_name` globally in the pipeline string. If a variable is named `location`, then MongoDB field references like `"$location"` get replaced too.
**Solution**: Use non-colliding names like `sensor_type`, `loc`, `cat` with friendly labels.

### $__from/$__to Are Replaced by Frontend
Grafana frontend replaces `$__from` and `$__to` with **epoch milliseconds** (e.g., `1772572529755`) BEFORE the Go backend sees the query. The backend's own `$__from` interpolation never runs for dashboard queries.
**Solution**: Use the `$__timeFilter` macro instead of raw `$__from`/`$__to`:
```json
{"$match": {$__timeFilter(timestamp)}}
```
The macro is processed server-side and produces correct Extended JSON dates. If you need manual control, use `$expr` + `$toDate`:
```json
{"$match": {"$expr": {"$and": [
  {"$gte": ["$timestamp", {"$toDate": $__from}]},
  {"$lte": ["$timestamp", {"$toDate": $__to}]}
]}}}
```

### $__all Normalization
When using `$__match` with `allValue: "$__all"`, Grafana outputs the bare string `$__all` without JSON quotes even when using `:json` format. The backend normalizes this automatically, but be aware of it when debugging pipeline interpolation.

## Test Patterns

### Wait for Panel Data (not loading, not "No data")
```typescript
async function waitForPanelData(page, panelTitle) {
  const panel = getPanelByTitle(page, panelTitle);
  await expect(panel).toBeVisible({ timeout: 20000 });
  await expect(panel.getByText('No data')).not.toBeVisible({ timeout: 20000 });
  return panel;
}
```

### Get Panel by Title
```typescript
function getPanelByTitle(page, title) {
  return page.locator('[data-viz-panel-key]', {
    has: page.getByTestId(`data-testid Panel header ${title}`),
  });
}
```

### Check No Error Panels
```typescript
const errorCount = await page.getByTestId('data-testid Panel data error message').count();
expect(errorCount).toBe(0);
```

### Interact with Template Variable Dropdowns (Multi-Select Combobox)
Grafana 12 multi-select template variables use a combobox pattern. Locate the variable container by its `data-testid`, then find the combobox input:
```typescript
const sensorVar = page.getByTestId('data-testid template variable').filter({
  has: page.getByTestId('data-testid Dashboard template variables submenu Label Sensor'),
});
const combobox = sensorVar.getByRole('combobox');
await combobox.click();
await combobox.fill('temperature');
await page.getByRole('option', { name: 'temperature' }).first().click();
await page.keyboard.press('Escape');
```

### Scope Selectors to Avoid Strict Mode Violations
Some elements like radio buttons appear in both the query editor and the panel options sidebar. Scope to the query editor row to avoid matching duplicates:
```typescript
page.getByTestId('query-editor-row').locator('input[id*="option-table"]')
```
