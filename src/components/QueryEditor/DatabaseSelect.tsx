/**
 * DatabaseSelect component for choosing a MongoDB database.
 *
 * Fetches the list of available databases from the backend
 * and renders a searchable dropdown.
 */
import { SelectableValue } from '@grafana/data';
import { InlineField, Select, Alert } from '@grafana/ui';

import { DataSource } from '../../datasource';
import { useDatabases } from '../../hooks/useDatabases';

/** Props for the DatabaseSelect component. */
interface DatabaseSelectProps {
  /** The MongoDB datasource instance. */
  datasource: DataSource;
  /** The currently selected database name. */
  value: string;
  /** Callback when the database selection changes. */
  onChange: (database: string) => void;
}

/**
 * DatabaseSelect renders a dropdown populated with databases from the backend.
 */
export function DatabaseSelect({ datasource, value, onChange }: DatabaseSelectProps) {
  const { databases, loading, error } = useDatabases(datasource);

  const options: Array<SelectableValue<string>> = databases.map((db) => ({
    label: db,
    value: db,
  }));

  const selected = options.find((o) => o.value === value) ?? (value ? { label: value, value } : undefined);

  return (
    <>
      <InlineField label="Database" labelWidth={14} tooltip="Select the MongoDB database to query">
        <Select
          inputId="mongodb-database-select"
          options={options}
          value={selected}
          onChange={(v) => onChange(v.value ?? '')}
          isLoading={loading}
          isClearable
          placeholder="Select database"
          width={30}
          allowCustomValue
        />
      </InlineField>
      {error && <Alert title="Database fetch error" severity="error">{error}</Alert>}
    </>
  );
}
