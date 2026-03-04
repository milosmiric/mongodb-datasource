/**
 * QueryEditor component for the MongoDB datasource.
 *
 * Provides the main query editing interface with database/collection selection,
 * aggregation pipeline editor, time field selector, and output format toggle.
 */
import { ChangeEvent } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { InlineField, Input } from '@grafana/ui';

import { DataSource } from '../../datasource';
import { MongoDBDataSourceOptions, MongoDBQuery, QueryFormatType } from '../../types';
import { DatabaseSelect } from './DatabaseSelect';
import { CollectionSelect } from './CollectionSelect';
import { PipelineEditor } from './PipelineEditor';
import { FormatSelect } from './FormatSelect';

/** Props for the QueryEditor component. */
type MongoDBQueryEditorProps = QueryEditorProps<DataSource, MongoDBQuery, MongoDBDataSourceOptions>;

/**
 * QueryEditor renders the complete query editing form for MongoDB queries.
 *
 * @description Includes database and collection dropdowns, an aggregation pipeline
 * code editor, time field input, format toggle, and legend format input.
 */
export function QueryEditor({ query, onChange, onRunQuery, datasource }: MongoDBQueryEditorProps) {
  const onDatabaseChange = (database: string) => {
    onChange({ ...query, database, collection: '' });
    onRunQuery();
  };

  const onCollectionChange = (collection: string) => {
    onChange({ ...query, collection });
    onRunQuery();
  };

  const onPipelineChange = (pipeline: string) => {
    onChange({ ...query, pipeline });
    onRunQuery();
  };

  const onTimeFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, timeField: event.target.value });
  };

  const onFormatChange = (format: QueryFormatType) => {
    onChange({ ...query, format });
    onRunQuery();
  };

  const onLegendFormatChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, legendFormat: event.target.value });
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        <DatabaseSelect
          datasource={datasource}
          value={query.database ?? ''}
          onChange={onDatabaseChange}
        />
        <CollectionSelect
          datasource={datasource}
          database={query.database ?? ''}
          value={query.collection ?? ''}
          onChange={onCollectionChange}
        />
      </div>

      <PipelineEditor
        value={query.pipeline ?? '[{"$limit": 100}]'}
        onChange={onPipelineChange}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        <FormatSelect
          value={query.format ?? 'table'}
          onChange={onFormatChange}
        />

        {query.format === 'time_series' && (
          <>
            <InlineField label="Time Field" labelWidth={14} tooltip="Document field to use as the time axis">
              <Input
                value={query.timeField ?? ''}
                placeholder="timestamp"
                width={20}
                onChange={onTimeFieldChange}
                onBlur={onRunQuery}
              />
            </InlineField>

            <InlineField label="Legend" labelWidth={14} tooltip="Legend format string (e.g., {{sensor}})">
              <Input
                value={query.legendFormat ?? ''}
                placeholder="{{label}}"
                width={20}
                onChange={onLegendFormatChange}
                onBlur={onRunQuery}
              />
            </InlineField>
          </>
        )}
      </div>
    </div>
  );
}
