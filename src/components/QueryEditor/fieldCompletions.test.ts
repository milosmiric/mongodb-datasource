import { buildFieldCompletions } from './fieldCompletions';
import { FieldInfo } from '../../types';

describe('buildFieldCompletions', () => {
  it('maps fields to completion descriptors with type detail', () => {
    const fields: FieldInfo[] = [{ path: 'sensor', types: ['string'], frequency: 1, indexed: false }];
    const [c] = buildFieldCompletions(fields);
    expect(c.label).toBe('sensor');
    expect(c.insertText).toBe('sensor');
    expect(c.detail).toBe('string');
  });

  it('joins multiple types and marks indexed fields', () => {
    const fields: FieldInfo[] = [{ path: 'id', types: ['int', 'string'], frequency: 0.8, indexed: true }];
    const [c] = buildFieldCompletions(fields);
    expect(c.detail).toBe('int | string · indexed');
  });

  it('falls back to a generic detail when no types are known', () => {
    const fields: FieldInfo[] = [{ path: 'x', types: [], frequency: 0, indexed: false }];
    const [c] = buildFieldCompletions(fields);
    expect(c.detail).toBe('field');
  });

  it('sorts indexed fields ahead of non-indexed via sortText', () => {
    const fields: FieldInfo[] = [
      { path: 'plain', types: ['string'], frequency: 1, indexed: false },
      { path: 'keyed', types: ['string'], frequency: 1, indexed: true },
    ];
    const [plain, keyed] = buildFieldCompletions(fields);
    expect(keyed.sortText < plain.sortText).toBe(true);
  });

  it('preserves input ordering within the same indexed group', () => {
    const fields: FieldInfo[] = [
      { path: 'a', types: ['string'], frequency: 1, indexed: false },
      { path: 'b', types: ['string'], frequency: 0.5, indexed: false },
    ];
    const [a, b] = buildFieldCompletions(fields);
    expect(a.sortText < b.sortText).toBe(true);
  });
});
