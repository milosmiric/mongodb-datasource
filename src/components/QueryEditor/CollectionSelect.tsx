/**
 * CollectionSelect component for choosing a MongoDB collection.
 *
 * Fetches the list of collections for the selected database from the backend.
 */
import { Combobox, ComboboxOption, InlineField, Alert } from '@grafana/ui';

import { DataSource } from '../../datasource';
import { useCollections } from '../../hooks/useCollections';

/** Props for the CollectionSelect component. */
interface CollectionSelectProps {
  /** The MongoDB datasource instance. */
  datasource: DataSource;
  /** The selected database name. */
  database: string;
  /** The currently selected collection name. */
  value: string;
  /** Callback when the collection selection changes. */
  onChange: (collection: string) => void;
}

/**
 * CollectionSelect renders a dropdown populated with collections from the backend.
 */
export function CollectionSelect({ datasource, database, value, onChange }: CollectionSelectProps) {
  const { collections, loading, error } = useCollections(datasource, database);

  const options: Array<ComboboxOption<string>> = collections.map((c) => ({
    label: c,
    value: c,
  }));

  return (
    <>
      <InlineField label="Collection" labelWidth={14} tooltip="Select the MongoDB collection to query">
        <Combobox
          id="mongodb-collection-select"
          options={options}
          value={value || null}
          onChange={(option) => onChange(option?.value ?? '')}
          loading={loading}
          isClearable
          disabled={!database}
          placeholder={database ? 'Select collection' : 'Select a database first'}
          width={30}
          createCustomValue
        />
      </InlineField>
      {error && <Alert title="Collection fetch error" severity="error">{error}</Alert>}
    </>
  );
}
