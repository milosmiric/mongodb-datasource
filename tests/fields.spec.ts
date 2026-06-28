/**
 * E2E tests for field-name autocomplete via schema inference.
 *
 * Two layers:
 *  - the backend `/resources/fields` endpoint, which infers field paths/types by
 *    sampling the seeded `demo.users` collection, and
 *  - the panel pipeline editor, which surfaces those fields as Monaco
 *    completions.
 *
 * The seeded `demo.users` collection has fields including `name`, `email`, and
 * `role` (see docker/mongo-seed), so those paths must appear in suggestions.
 */
import { test, expect } from '@grafana/plugin-e2e';

import { selectOption } from './helpers';

const DS_UID = 'mongodb-demo';

test.describe('Field autocomplete', () => {
  test('resource endpoint infers field paths and types', async ({ page }) => {
    const response = await page.request.get(
      `/api/datasources/uid/${DS_UID}/resources/fields?database=demo&collection=users`
    );
    expect(response.ok()).toBeTruthy();

    const fields = (await response.json()) as Array<{ path: string; types: string[]; indexed: boolean }>;
    const paths = fields.map((f) => f.path);

    // Known seeded fields are surfaced.
    expect(paths).toEqual(expect.arrayContaining(['email', 'role']));

    // The implicit _id index makes _id rank as indexed and appear first.
    const idField = fields.find((f) => f.path === '_id');
    expect(idField?.indexed).toBe(true);

    // Types are inferred (email is a string).
    const email = fields.find((f) => f.path === 'email');
    expect(email?.types).toContain('string');
  });

  test('returns 400 when collection is missing', async ({ page }) => {
    const response = await page.request.get(`/api/datasources/uid/${DS_UID}/resources/fields?database=demo`);
    expect(response.status()).toBe(400);
  });

  test('pipeline editor offers field-name completions', async ({ panelEditPage, page }) => {
    await panelEditPage.datasource.set('MongoDB');
    await panelEditPage.setVisualization('Table');

    await selectOption(page, 'Select database', 'demo');
    await selectOption(page, 'Select collection', 'users');

    // Wait for inferred fields to load before relying on completions.
    await page.waitForResponse(
      (r) => r.url().includes('/resources/fields') && r.url().includes('collection=users') && r.ok(),
      { timeout: 15000 }
    );

    const pipelineEditor = page.getByTestId('mongodb-pipeline-editor');
    const editor = pipelineEditor.locator('.monaco-editor').first();
    await editor.click({ force: true });

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+a`);
    // Type a field-reference prefix, then trigger Monaco's suggestion widget.
    await page.keyboard.type('[{"$project":{"ema', { delay: 10 });

    // Triggering the suggestion widget can be version-sensitive; retry until it
    // shows. Monaco's "trigger suggest" is Ctrl+Space on all platforms.
    await expect(async () => {
      await page.keyboard.press('Control+Space');
      const suggest = page.locator('.monaco-editor .suggest-widget');
      await expect(suggest).toBeVisible({ timeout: 2000 });
      await expect(suggest).toContainText('email', { timeout: 2000 });
    }).toPass({ timeout: 15000 });
  });
});
