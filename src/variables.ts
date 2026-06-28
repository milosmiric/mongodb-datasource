/**
 * Dashboard template-variable support for the MongoDB datasource.
 *
 * Implements Grafana's CustomVariableSupport so users can define Query-type
 * variables with a guided builder (distinct values of a field) or a raw
 * aggregation pipeline. Variable queries are executed through the normal
 * backend query path, so they inherit template-variable interpolation, time
 * macros ($__timeFilter, $__from/$__to) and $__match handling.
 */
import {
  CustomVariableSupport,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
} from '@grafana/data';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import type { DataSource } from './datasource';
import { MongoDBQuery, MongoDBVariableQuery } from './types';
import { VariableQueryEditor } from './components/VariableQueryEditor/VariableQueryEditor';

/** Column names recognised as the option value, most specific first. */
const VALUE_FIELD_NAMES = ['__value', 'value'];
/** Column names recognised as the option label, most specific first. */
const TEXT_FIELD_NAMES = ['__text', 'text'];

/**
 * buildVariablePipeline generates an aggregation pipeline returning the distinct
 * values of `field`, projected into the __text/__value convention.
 */
export function buildVariablePipeline(field: string): string {
  const fieldRef = `$${field}`;
  return JSON.stringify([
    { $group: { _id: fieldRef } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, __text: '$_id', __value: '$_id' } },
  ]);
}

/**
 * variableQueryToMongoQuery translates a variable query into a standard table
 * query the backend can execute. Builder mode generates the distinct-values
 * pipeline; raw mode passes the user pipeline through unchanged.
 */
export function variableQueryToMongoQuery(variableQuery: MongoDBVariableQuery): MongoDBQuery {
  const pipeline =
    variableQuery.mode === 'raw' ? variableQuery.pipeline : buildVariablePipeline(variableQuery.field);

  return {
    refId: variableQuery.refId,
    database: variableQuery.database,
    collection: variableQuery.collection,
    pipeline,
    format: 'table',
    timeField: '',
    legendFormat: '',
  };
}

/** firstFieldByName returns the first field whose name matches one of `names`. */
function firstFieldByName(frame: DataFrame, names: string[]) {
  return frame.fields.find((field) => names.includes(field.name));
}

/**
 * framesToMetricFindValues converts query result frames into variable options.
 *
 * It honours the __text/__value (and text/value) column convention, falls back
 * to a single column used as both label and value, and de-duplicates by value
 * so raw pipelines that don't $group still produce a clean option list.
 */
export function framesToMetricFindValues(data: DataFrame[]): MetricFindValue[] {
  const frame = data?.[0];
  if (!frame || frame.fields.length === 0 || frame.length === 0) {
    return [];
  }

  const valueField = firstFieldByName(frame, VALUE_FIELD_NAMES);
  const textField = firstFieldByName(frame, TEXT_FIELD_NAMES);
  const primary = valueField ?? textField ?? frame.fields[0];
  const valueSource = valueField ?? primary;
  const textSource = textField ?? primary;

  const values: MetricFindValue[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < frame.length; i++) {
    const rawValue = valueSource.values[i];
    const rawText = textSource.values[i];
    if (rawValue == null && rawText == null) {
      continue;
    }

    const value = (rawValue ?? rawText) as string | number;
    const key = String(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    values.push({ text: String(rawText ?? rawValue), value });
  }

  return values;
}

/**
 * MongoVariableSupport powers Query-type dashboard variables for the datasource.
 */
export class MongoVariableSupport extends CustomVariableSupport<DataSource, MongoDBVariableQuery> {
  constructor(private readonly datasource: DataSource) {
    super();
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<MongoDBVariableQuery>): Observable<DataQueryResponse> {
    const variableQuery = request.targets[0];
    if (!variableQuery) {
      return of({ data: [] });
    }

    const mongoQuery = variableQueryToMongoQuery(variableQuery);
    const dsRequest = {
      ...request,
      targets: [mongoQuery],
    } as unknown as DataQueryRequest<MongoDBQuery>;

    // datasource.query() applies template variables and time-range macros, then
    // hits the backend; we map the resulting frames into variable options.
    return this.datasource.query(dsRequest).pipe(
      map((response) => ({
        ...response,
        data: framesToMetricFindValues(response.data),
      }))
    );
  }
}
