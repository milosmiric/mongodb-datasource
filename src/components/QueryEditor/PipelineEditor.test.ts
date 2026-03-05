import { formatPipeline } from './PipelineEditor';

describe('formatPipeline', () => {
  it('formats valid JSON pipeline', () => {
    const input = '[{"$limit":10}]';
    const result = formatPipeline(input);
    expect(result).toBe('[\n  {\n    "$limit": 10\n  }\n]');
  });

  it('preserves bare template variables ($__from, $__to)', () => {
    const input = '[{"$match":{"ts":{"$gte":$__from,"$lte":$__to}}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__from');
    expect(result).toContain('$__to');
    expect(result).not.toContain('__PLACEHOLDER_');
  });

  it('preserves $__timeFilter macro with argument', () => {
    const input = '[{"$match":{$__timeFilter(timestamp)}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__timeFilter(timestamp)');
    expect(result).not.toContain('__PLACEHOLDER_');
  });

  it('preserves $__timeFilter_ms macro with argument', () => {
    const input = '[{"$match":{$__timeFilter_ms(created_at)}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__timeFilter_ms(created_at)');
  });

  it('preserves $__oidFilter macro with argument', () => {
    const input = '[{"$match":{$__oidFilter(_id)}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__oidFilter(_id)');
  });

  it('preserves $__timeGroup macro with argument', () => {
    const input = '[{"$group":{"_id":$__timeGroup(timestamp),"count":{"$sum":1}}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__timeGroup(timestamp)');
  });

  it('preserves macro with dotted field name', () => {
    const input = '[{"$match":{$__timeFilter(metadata.timestamp)}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__timeFilter(metadata.timestamp)');
  });

  it('preserves multiple macros and variables in one pipeline', () => {
    const input = '[{"$match":{$__timeFilter(ts)}},{"$group":{"_id":$__timeGroup(ts),"avg":{"$avg":"$value"}}},{"$project":{"_id":0,"ts":"$_id","avg":1,"range":$__range_ms}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__timeFilter(ts)');
    expect(result).toContain('$__timeGroup(ts)');
    expect(result).toContain('$__range_ms');
    expect(result).not.toContain('__PLACEHOLDER_');
  });

  it('preserves $__match stage key', () => {
    const input = '[{"$__match":{"sensor":"temperature"}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__match');
  });

  it('preserves $__interval_unit and $__interval_binSize', () => {
    const input = '[{"$group":{"_id":{"$dateTrunc":{"date":"$ts","unit":$__interval_unit,"binSize":$__interval_binSize}}}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__interval_unit');
    expect(result).toContain('$__interval_binSize');
  });

  it('preserves $__maxDataPoints', () => {
    const input = '[{"$bucketAuto":{"groupBy":"$ts","buckets":$__maxDataPoints}}]';
    const result = formatPipeline(input);
    expect(result).toContain('$__maxDataPoints');
  });

  it('returns invalid JSON unchanged', () => {
    const input = 'not valid json {{{';
    const result = formatPipeline(input);
    expect(result).toBe(input);
  });
});
