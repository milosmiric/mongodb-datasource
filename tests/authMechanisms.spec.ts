/**
 * E2E tests for MongoDB authentication mechanisms.
 *
 * Creates datasources via Grafana API and verifies health checks + queries
 * for SCRAM-SHA-256, SCRAM-SHA-1, X.509, and TLS-only connections.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const CERT_DIR = path.join(__dirname, '..', 'docker', 'tls', 'certs');

/** Read a PEM file from the certs directory. */
function readCert(filename: string): string {
  return fs.readFileSync(path.join(CERT_DIR, filename), 'utf-8');
}

/** Create or update a datasource via API. Fully idempotent. */
async function ensureDatasource(request: import('@playwright/test').APIRequestContext, payload: Record<string, unknown>): Promise<void> {
  const uid = payload.uid as string;

  // Try to delete by UID first (ignore 404).
  await request.delete(`/api/datasources/uid/${uid}`);

  const res = await request.post('/api/datasources', { data: payload });

  // If 409 (name conflict from a previous run), delete by name and retry.
  if (res.status() === 409) {
    const allDs = await request.get('/api/datasources');
    const list = await allDs.json();
    const existing = list.find((d: { name: string }) => d.name === payload.name);
    if (existing) {
      await request.delete(`/api/datasources/${existing.id}`);
    }
    const retry = await request.post('/api/datasources', { data: payload });
    if (!retry.ok()) {
      const body = await retry.text();
      throw new Error(`Failed to create datasource ${uid} on retry: ${retry.status()} ${body}`);
    }
    return;
  }

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Failed to create datasource ${uid}: ${res.status()} ${body}`);
  }
}

// Run all auth tests serially in a single worker to avoid race conditions.
test.describe('Auth Mechanisms', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    const caCert = readCert('ca.pem');
    const clientCert = readCert('client.pem');
    const clientKey = readCert('client-key.pem');

    // SCRAM-SHA-256
    await ensureDatasource(request, {
      uid: 'e2e-scram256',
      name: 'E2E SCRAM-SHA-256',
      type: 'milosmiric-mongodb-datasource',
      access: 'proxy',
      jsonData: {
        uri: 'mongodb://mongodb:27017',
        database: 'demo',
        authMechanism: 'SCRAM-SHA-256',
        username: 'scramUser256',
        tlsEnabled: true,
        tlsCaCert: caCert,
      },
      secureJsonData: {
        password: 'testpass256',
      },
    });

    // SCRAM-SHA-1
    await ensureDatasource(request, {
      uid: 'e2e-scram1',
      name: 'E2E SCRAM-SHA-1',
      type: 'milosmiric-mongodb-datasource',
      access: 'proxy',
      jsonData: {
        uri: 'mongodb://mongodb:27017',
        database: 'demo',
        authMechanism: 'SCRAM-SHA-1',
        username: 'scramUser1',
        tlsEnabled: true,
        tlsCaCert: caCert,
      },
      secureJsonData: {
        password: 'testpass1',
      },
    });

    // X.509
    await ensureDatasource(request, {
      uid: 'e2e-x509',
      name: 'E2E X.509',
      type: 'milosmiric-mongodb-datasource',
      access: 'proxy',
      jsonData: {
        uri: 'mongodb://mongodb:27017',
        database: 'demo',
        authMechanism: 'MONGODB-X509',
        tlsEnabled: true,
        tlsCaCert: caCert,
      },
      secureJsonData: {
        tlsClientCert: clientCert,
        tlsClientKey: clientKey,
      },
    });

    // TLS-only (no auth)
    await ensureDatasource(request, {
      uid: 'e2e-tls',
      name: 'E2E TLS Only',
      type: 'milosmiric-mongodb-datasource',
      access: 'proxy',
      jsonData: {
        uri: 'mongodb://mongodb:27017',
        database: 'demo',
        tlsEnabled: true,
        tlsCaCert: caCert,
      },
      secureJsonData: {},
    });

    // Wrong password (for failure test)
    await ensureDatasource(request, {
      uid: 'e2e-wrong-pass',
      name: 'E2E Wrong Password',
      type: 'milosmiric-mongodb-datasource',
      access: 'proxy',
      jsonData: {
        uri: 'mongodb://mongodb:27017',
        database: 'demo',
        authMechanism: 'SCRAM-SHA-256',
        username: 'scramUser256',
        tlsEnabled: true,
        tlsCaCert: caCert,
      },
      secureJsonData: {
        password: 'wrong-password',
      },
    });
  });

  /** Navigate to datasource settings and click Save & test. */
  async function saveAndTest(page: import('@playwright/test').Page, uid: string) {
    await page.goto(`/connections/datasources/edit/${uid}`);
    await page.waitForSelector('text=MongoDB');
    await page.getByRole('button', { name: /save & test/i }).click();
  }

  test('SCRAM-SHA-256 health check succeeds', async ({ page }) => {
    await saveAndTest(page, 'e2e-scram256');
    await expect(page.getByText(/MongoDB connected/i)).toBeVisible({ timeout: 15000 });
  });

  test('SCRAM-SHA-1 health check succeeds', async ({ page }) => {
    await saveAndTest(page, 'e2e-scram1');
    await expect(page.getByText(/MongoDB connected/i)).toBeVisible({ timeout: 15000 });
  });

  test('X.509 health check succeeds', async ({ page }) => {
    await saveAndTest(page, 'e2e-x509');
    await expect(page.getByText(/MongoDB connected/i)).toBeVisible({ timeout: 15000 });
  });

  test('TLS-only health check succeeds', async ({ page }) => {
    await saveAndTest(page, 'e2e-tls');
    await expect(page.getByText(/MongoDB connected/i)).toBeVisible({ timeout: 15000 });
  });

  test('SCRAM-SHA-256 query returns data', async ({ request }) => {
    const res = await request.post('/api/ds/query', {
      data: {
        queries: [
          {
            refId: 'A',
            datasource: { uid: 'e2e-scram256' },
            database: 'demo',
            collection: 'users',
            pipeline: '[{"$limit": 5}]',
            format: 'table',
          },
        ],
        from: 'now-1h',
        to: 'now',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.results.A.frames.length).toBeGreaterThan(0);
  });

  test('SCRAM-SHA-1 query returns data', async ({ request }) => {
    const res = await request.post('/api/ds/query', {
      data: {
        queries: [
          {
            refId: 'A',
            datasource: { uid: 'e2e-scram1' },
            database: 'demo',
            collection: 'users',
            pipeline: '[{"$limit": 5}]',
            format: 'table',
          },
        ],
        from: 'now-1h',
        to: 'now',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.results.A.frames.length).toBeGreaterThan(0);
  });

  test('X.509 query returns data', async ({ request }) => {
    const res = await request.post('/api/ds/query', {
      data: {
        queries: [
          {
            refId: 'A',
            datasource: { uid: 'e2e-x509' },
            database: 'demo',
            collection: 'users',
            pipeline: '[{"$limit": 5}]',
            format: 'table',
          },
        ],
        from: 'now-1h',
        to: 'now',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.results.A.frames.length).toBeGreaterThan(0);
  });

  test('wrong password fails health check', async ({ page }) => {
    await saveAndTest(page, 'e2e-wrong-pass');
    await expect(page.getByText(/not initialized/i)).toBeVisible({ timeout: 15000 });
  });
});
