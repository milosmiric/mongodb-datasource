import { toDataFrame, FieldType } from '@grafana/data';

import { buildVariablePipeline, framesToMetricFindValues, variableQueryToMongoQuery } from './variables';
import { MongoDBVariableQuery } from './types';

describe('buildVariablePipeline', () => {
  it('generates a distinct-values pipeline projected to __text/__value', () => {
    const pipeline = JSON.parse(buildVariablePipeline('sensor'));
    expect(pipeline).toEqual([
      { $group: { _id: { $getField: 'sensor' } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, __text: '$_id', __value: '$_id' } },
    ]);
  });

  it('references the field via $getField so it survives variable interpolation', () => {
    // A variable named after its field (e.g. `role` over `role`) must not be
    // clobbered by templateSrv.replace — so no bare `$role` token may appear.
    expect(buildVariablePipeline('role')).not.toContain('$role');
  });
});

describe('variableQueryToMongoQuery', () => {
  const base: MongoDBVariableQuery = {
    refId: 'A',
    mode: 'builder',
    database: 'demo',
    collection: 'sensors',
    field: 'sensor',
    pipeline: '',
  };

  it('builds a table query from the builder field in builder mode', () => {
    const q = variableQueryToMongoQuery(base);
    expect(q.format).toBe('table');
    expect(q.database).toBe('demo');
    expect(q.collection).toBe('sensors');
    expect(JSON.parse(q.pipeline)).toEqual(JSON.parse(buildVariablePipeline('sensor')));
  });

  it('passes the raw pipeline through unchanged in raw mode', () => {
    const raw = '[{"$group":{"_id":"$x"}}]';
    const q = variableQueryToMongoQuery({ ...base, mode: 'raw', pipeline: raw });
    expect(q.pipeline).toBe(raw);
  });
});

describe('framesToMetricFindValues', () => {
  it('returns [] for empty input', () => {
    expect(framesToMetricFindValues([])).toEqual([]);
    expect(framesToMetricFindValues([toDataFrame({ fields: [] })])).toEqual([]);
  });

  it('maps __text/__value columns to label/value', () => {
    const frame = toDataFrame({
      fields: [
        { name: '__text', type: FieldType.string, values: ['Alpha', 'Beta'] },
        { name: '__value', type: FieldType.string, values: ['a', 'b'] },
      ],
    });
    expect(framesToMetricFindValues([frame])).toEqual([
      { text: 'Alpha', value: 'a' },
      { text: 'Beta', value: 'b' },
    ]);
  });

  it('honours the underscore-less text/value convention', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'text', type: FieldType.string, values: ['Alpha'] },
        { name: 'value', type: FieldType.string, values: ['a'] },
      ],
    });
    expect(framesToMetricFindValues([frame])).toEqual([{ text: 'Alpha', value: 'a' }]);
  });

  it('uses a single column for both label and value', () => {
    const frame = toDataFrame({
      fields: [{ name: '_id', type: FieldType.string, values: ['temp-01', 'temp-02'] }],
    });
    expect(framesToMetricFindValues([frame])).toEqual([
      { text: 'temp-01', value: 'temp-01' },
      { text: 'temp-02', value: 'temp-02' },
    ]);
  });

  it('de-duplicates by value and skips nulls', () => {
    const frame = toDataFrame({
      fields: [{ name: 'sensor', type: FieldType.string, values: ['a', 'a', null, 'b'] }],
    });
    expect(framesToMetricFindValues([frame])).toEqual([
      { text: 'a', value: 'a' },
      { text: 'b', value: 'b' },
    ]);
  });

  it('preserves numeric values', () => {
    const frame = toDataFrame({
      fields: [{ name: '__value', type: FieldType.number, values: [1, 2] }],
    });
    expect(framesToMetricFindValues([frame])).toEqual([
      { text: '1', value: 1 },
      { text: '2', value: 2 },
    ]);
  });
});
