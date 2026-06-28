/**
 * VariableQueryEditor component for MongoDB dashboard template variables.
 *
 * Offers two modes: a guided builder that returns the distinct values of a
 * field, and a raw aggregation pipeline for full control. Both reuse the same
 * database/collection pickers as the panel query editor.
 */
import React, { ChangeEvent } from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, Input, RadioButtonGroup } from '@grafana/ui';

import { DataSource } from '../../datasource';
import {
  DEFAULT_VARIABLE_QUERY,
  MongoDBDataSourceOptions,
  MongoDBQuery,
  MongoDBVariableQuery,
  VariableEditorMode,
} from '../../types';
import { DatabaseSelect } from '../QueryEditor/DatabaseSelect';
import { CollectionSelect } from '../QueryEditor/CollectionSelect';
import { PipelineEditor } from '../QueryEditor/PipelineEditor';

/** Props for the VariableQueryEditor component. */
type Props = QueryEditorProps<DataSource, MongoDBQuery, MongoDBDataSourceOptions, MongoDBVariableQuery>;

const MODE_OPTIONS: Array<SelectableValue<VariableEditorMode>> = [
  { label: 'Builder', value: 'builder' },
  { label: 'Raw pipeline', value: 'raw' },
];

/**
 * VariableQueryEditor renders the editor shown for Query-type dashboard
 * variables that use the MongoDB datasource.
 */
export function VariableQueryEditor({ query, onChange, datasource }: Props) {
  // Grafana may pass a bare { refId } on first render; fill in defaults.
  const current: MongoDBVariableQuery = { ...DEFAULT_VARIABLE_QUERY, ...query } as MongoDBVariableQuery;

  // Only update the variable model here; the query is run by Grafana's "Run
  // query" button (and on dashboard load). Calling onRunQuery() on every change
  // races the model commit and fires queries with a stale/empty collection.
  const update = (patch: Partial<MongoDBVariableQuery>) => onChange({ ...current, ...patch });

  const onModeChange = (mode: VariableEditorMode) => update({ mode });
  const onDatabaseChange = (database: string) => update({ database, collection: '' });
  const onCollectionChange = (collection: string) => update({ collection });
  const onFieldChange = (event: ChangeEvent<HTMLInputElement>) => update({ field: event.target.value });
  const onPipelineChange = (pipeline: string) => update({ pipeline });

  return (
    <div>
      <InlineField label="Mode" labelWidth={14} tooltip="Builder returns the distinct values of a field; Raw runs a custom aggregation pipeline.">
        <RadioButtonGroup options={MODE_OPTIONS} value={current.mode} onChange={onModeChange} />
      </InlineField>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        <DatabaseSelect datasource={datasource} value={current.database} onChange={onDatabaseChange} />
        <CollectionSelect
          datasource={datasource}
          database={current.database}
          value={current.collection}
          onChange={onCollectionChange}
        />
      </div>

      {current.mode === 'builder' ? (
        <InlineField
          label="Field"
          labelWidth={14}
          tooltip="Document field whose distinct values become the variable options (e.g. sensor)."
        >
          <Input
            value={current.field}
            placeholder="sensor"
            width={30}
            onChange={onFieldChange}
          />
        </InlineField>
      ) : (
        <PipelineEditor value={current.pipeline} onChange={onPipelineChange} />
      )}
    </div>
  );
}
