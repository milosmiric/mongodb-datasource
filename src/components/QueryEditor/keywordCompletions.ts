/**
 * Pure builder for the editor's macro, template-variable, and pipeline-stage
 * completions.
 *
 * Kept free of Monaco imports so the catalog and ranking can be unit-tested
 * directly; the editor maps these descriptors onto Monaco CompletionItems
 * (category → kind, `snippet` → InsertAsSnippet).
 *
 * The macro/variable catalog mirrors the backend's interpolation and macro
 * expansion (see pkg/plugin/query.go and docs/template-variables.md). Keep them
 * in sync when adding a macro or variable.
 */

/** The kind of editor keyword completion, used to pick a Monaco icon. */
export type CompletionCategory = 'macro' | 'variable' | 'stage';

/** A Monaco-agnostic description of a macro / variable / stage completion. */
export interface KeywordCompletion {
  /** The token shown in the suggestion list. */
  label: string;
  /** Short category tag shown next to the label (e.g. `macro`). */
  detail: string;
  /** One-line description shown in the expanded documentation panel. */
  documentation: string;
  /** Text inserted when accepted; a Monaco snippet when `snippet` is true. */
  insertText: string;
  /** Whether `insertText` uses Monaco snippet syntax (e.g. `${1:field}`). */
  snippet: boolean;
  /** Which catalog the completion came from. */
  category: CompletionCategory;
  /** Opaque sort key — ranks after field completions, grouped by category. */
  sortText: string;
}

/** Macros expand into JSON fragments; they insert a snippet on the field arg. */
const MACROS: Array<{ label: string; insertText: string; snippet: boolean; documentation: string }> = [
  {
    label: '$__timeFilter',
    insertText: '$__timeFilter(${1:field})',
    snippet: true,
    documentation: 'Date range filter for a BSON Date field: { field: { $gte, $lte } }.',
  },
  {
    label: '$__timeFilter_ms',
    insertText: '$__timeFilter_ms(${1:field})',
    snippet: true,
    documentation: 'Date range filter for a field storing epoch milliseconds.',
  },
  {
    label: '$__oidFilter',
    insertText: '$__oidFilter(${1:field})',
    snippet: true,
    documentation: 'ObjectId range filter — use when _id is the time axis.',
  },
  {
    label: '$__timeGroup',
    insertText: '$__timeGroup(${1:field})',
    snippet: true,
    documentation: 'Adaptive $dateTrunc bucketing expression sized to the panel interval.',
  },
  {
    label: '$__match',
    insertText: '$__match',
    snippet: false,
    documentation: 'Index-friendly smart-match stage: handles All / single / multi-value selections.',
  },
];

/** Built-in template variables replaced before the pipeline reaches MongoDB. */
const VARIABLES: Array<{ label: string; documentation: string }> = [
  { label: '$__from', documentation: 'Start of the time range (Extended JSON Date).' },
  { label: '$__to', documentation: 'End of the time range (Extended JSON Date).' },
  { label: '$__from_ms', documentation: 'Start of the time range as Unix milliseconds.' },
  { label: '$__to_ms', documentation: 'End of the time range as Unix milliseconds.' },
  { label: '$__from_s', documentation: 'Start of the time range as Unix seconds.' },
  { label: '$__to_s', documentation: 'End of the time range as Unix seconds.' },
  { label: '$__from_oid', documentation: 'Start of the time range as an ObjectId lower bound.' },
  { label: '$__to_oid', documentation: 'End of the time range as an ObjectId upper bound.' },
  { label: '$__range_ms', documentation: 'Time range duration in milliseconds.' },
  { label: '$__range_s', documentation: 'Time range duration in seconds.' },
  { label: '$__interval', documentation: 'Suggested bucket interval (e.g. 864000ms).' },
  { label: '$__interval_ms', documentation: 'Suggested bucket interval in milliseconds.' },
  { label: '$__interval_unit', documentation: 'MongoDB time unit for $dateTrunc (second/minute/hour/day).' },
  { label: '$__interval_binSize', documentation: 'Bin size for $dateTrunc.' },
  { label: '$__maxDataPoints', documentation: "The panel's maximum data points setting." },
];

/** Common aggregation pipeline stage keywords. */
const STAGES: Array<{ label: string; documentation: string }> = [
  { label: '$match', documentation: 'Filter documents by a query.' },
  { label: '$group', documentation: 'Group documents and compute accumulated values.' },
  { label: '$project', documentation: 'Reshape documents — include, exclude, or compute fields.' },
  { label: '$sort', documentation: 'Order documents by one or more fields.' },
  { label: '$limit', documentation: 'Pass the first N documents.' },
  { label: '$skip', documentation: 'Skip the first N documents.' },
  { label: '$count', documentation: 'Count documents into a single field.' },
  { label: '$sample', documentation: 'Randomly select N documents.' },
  { label: '$lookup', documentation: 'Left-outer join with another collection.' },
  { label: '$unwind', documentation: 'Deconstruct an array field into one document per element.' },
  { label: '$addFields', documentation: 'Add or overwrite computed fields.' },
  { label: '$set', documentation: 'Alias for $addFields.' },
  { label: '$bucketAuto', documentation: 'Auto-bucket documents into a target number of groups.' },
  { label: '$facet', documentation: 'Run multiple sub-pipelines on the same input.' },
  { label: '$replaceRoot', documentation: 'Promote a sub-document to the top level.' },
];

// Group prefixes order completions after field paths (which use '0'/'1'),
// then macros, variables, and stages in turn.
const MACRO_PREFIX = '2';
const VARIABLE_PREFIX = '3';
const STAGE_PREFIX = '4';

const pad = (index: number) => String(index).padStart(3, '0');

/**
 * buildKeywordCompletions returns the static catalog of macro, variable, and
 * pipeline-stage completions. The list is independent of the selected
 * collection, so these suggestions work even before a collection is chosen.
 *
 * @returns Completion descriptors ready to map onto Monaco CompletionItems.
 */
export function buildKeywordCompletions(): KeywordCompletion[] {
  const macros: KeywordCompletion[] = MACROS.map((m, i) => ({
    label: m.label,
    detail: 'macro',
    documentation: m.documentation,
    insertText: m.insertText,
    snippet: m.snippet,
    category: 'macro',
    sortText: `${MACRO_PREFIX}${pad(i)}`,
  }));

  const variables: KeywordCompletion[] = VARIABLES.map((v, i) => ({
    label: v.label,
    detail: 'variable',
    documentation: v.documentation,
    insertText: v.label,
    snippet: false,
    category: 'variable',
    sortText: `${VARIABLE_PREFIX}${pad(i)}`,
  }));

  const stages: KeywordCompletion[] = STAGES.map((s, i) => ({
    label: s.label,
    detail: 'stage',
    documentation: s.documentation,
    insertText: s.label,
    snippet: false,
    category: 'stage',
    sortText: `${STAGE_PREFIX}${pad(i)}`,
  }));

  return [...macros, ...variables, ...stages];
}
