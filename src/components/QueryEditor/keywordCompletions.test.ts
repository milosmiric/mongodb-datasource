import { buildKeywordCompletions } from './keywordCompletions';

describe('buildKeywordCompletions', () => {
  const all = buildKeywordCompletions();
  const byLabel = (label: string) => all.find((c) => c.label === label);

  it('includes macros, variables, and stages', () => {
    expect(byLabel('$__timeFilter')?.category).toBe('macro');
    expect(byLabel('$__from')?.category).toBe('variable');
    expect(byLabel('$match')?.category).toBe('stage');
  });

  it('inserts function macros as snippets with a field placeholder', () => {
    const tf = byLabel('$__timeFilter');
    expect(tf?.snippet).toBe(true);
    expect(tf?.insertText).toBe('$__timeFilter(${1:field})');
  });

  it('treats $__match as a non-snippet macro/stage token', () => {
    const match = byLabel('$__match');
    expect(match?.snippet).toBe(false);
    expect(match?.insertText).toBe('$__match');
  });

  it('inserts variables and stages verbatim (no snippet)', () => {
    const from = byLabel('$__from');
    expect(from?.snippet).toBe(false);
    expect(from?.insertText).toBe('$__from');

    const group = byLabel('$group');
    expect(group?.snippet).toBe(false);
    expect(group?.insertText).toBe('$group');
  });

  it('gives every completion a one-line description', () => {
    expect(all.every((c) => c.documentation.length > 0)).toBe(true);
  });

  it('ranks macros before variables before stages, all after field completions', () => {
    const macro = byLabel('$__timeFilter')!;
    const variable = byLabel('$__from')!;
    const stage = byLabel('$match')!;
    expect(macro.sortText < variable.sortText).toBe(true);
    expect(variable.sortText < stage.sortText).toBe(true);

    // Field completions use a '0'/'1' prefix; keywords must sort after them.
    const fieldSortText = '100000';
    expect(fieldSortText < macro.sortText).toBe(true);
  });

  it('exposes the expected common pipeline stages', () => {
    const stages = all.filter((c) => c.category === 'stage').map((c) => c.label);
    expect(stages).toEqual(expect.arrayContaining(['$match', '$group', '$project', '$sort', '$lookup', '$unwind']));
  });
});
