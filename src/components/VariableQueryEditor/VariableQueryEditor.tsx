/**
 * VariableQueryEditor component for MongoDB dashboard template variables.
 *
 * Offers two modes: a guided builder that returns the distinct values of a
 * field, and a raw aggregation pipeline for full control. Both reuse the same
 * database/collection pickers as the panel query editor.
 */
import React, { ChangeEvent, useEffect, useId, useRef, useState } from 'react';
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
import { useFields } from '../../hooks/useFields';
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
  const onPipelineChange = (pipeline: string) => update({ pipeline });

  // Inferred fields drive autocomplete: a datalist on the builder Field input and
  // Monaco completions in the raw pipeline editor.
  const { fields } = useFields(datasource, current.database, current.collection);
  const fieldListId = useId();

  // The Field input is debounced: each keystroke would otherwise change the
  // variable model and make Grafana re-run the preview query. We keep a local
  // draft for instant typing and commit to the model after a short pause (or
  // immediately on blur).
  const [fieldDraft, setFieldDraft] = useState(current.field);
  const commitTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(commitTimer.current), []);

  const onFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFieldDraft(value);
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => update({ field: value }), 600);
  };

  const onFieldBlur = () => {
    clearTimeout(commitTimer.current);
    if (fieldDraft !== current.field) {
      update({ field: fieldDraft });
    }
  };

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
        <>
          <InlineField
            label="Field"
            labelWidth={14}
            tooltip="Document field whose distinct values become the variable options (e.g. sensor). Suggestions come from the selected collection."
          >
            <Input
              value={fieldDraft}
              placeholder="sensor"
              width={30}
              list={fields.length > 0 ? fieldListId : undefined}
              onChange={onFieldChange}
              onBlur={onFieldBlur}
            />
          </InlineField>
          {fields.length > 0 && (
            <datalist id={fieldListId} data-testid="mongodb-field-suggestions">
              {fields.map((field) => (
                <option key={field.path} value={field.path} />
              ))}
            </datalist>
          )}
        </>
      ) : (
        <PipelineEditor value={current.pipeline} onChange={onPipelineChange} fields={fields} />
      )}
    </div>
  );
}
