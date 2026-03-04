/**
 * FormatSelect component for toggling between table and time-series output.
 */
import { SelectableValue } from '@grafana/data';
import { InlineField, RadioButtonGroup } from '@grafana/ui';

import { QueryFormatType } from '../../types';

/** Props for the FormatSelect component. */
interface FormatSelectProps {
  /** The currently selected format. */
  value: QueryFormatType;
  /** Callback when the format changes. */
  onChange: (format: QueryFormatType) => void;
}

const FORMAT_OPTIONS: Array<SelectableValue<QueryFormatType>> = [
  { label: 'Table', value: 'table' },
  { label: 'Time Series', value: 'time_series' },
];

/**
 * FormatSelect renders a radio button group for choosing the output format.
 */
export function FormatSelect({ value, onChange }: FormatSelectProps) {
  return (
    <InlineField label="Format" labelWidth={14} tooltip="Choose the output format for query results">
      <RadioButtonGroup
        options={FORMAT_OPTIONS}
        value={value}
        onChange={onChange}
      />
    </InlineField>
  );
}
