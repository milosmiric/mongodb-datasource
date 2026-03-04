/**
 * PipelineEditor component for editing MongoDB aggregation pipelines.
 *
 * Uses Grafana's CodeEditor with JSON language mode for syntax highlighting.
 */
import { InlineField, CodeEditor } from '@grafana/ui';

/** Props for the PipelineEditor component. */
interface PipelineEditorProps {
  /** The current pipeline JSON string. */
  value: string;
  /** Callback when the pipeline text changes. */
  onChange: (pipeline: string) => void;
}

/**
 * PipelineEditor renders a code editor for MongoDB aggregation pipeline JSON.
 */
export function PipelineEditor({ value, onChange }: PipelineEditorProps) {
  return (
    <InlineField
      label="Pipeline"
      labelWidth={14}
      tooltip="MongoDB aggregation pipeline as a JSON array. $__from and $__to are replaced with epoch milliseconds — wrap them with {$toDate: $__from} to convert to DateTime for $match comparisons."
      grow
    >
      <div data-testid="mongodb-pipeline-editor">
        <CodeEditor
          value={value}
          language="json"
          showLineNumbers
          showMiniMap={false}
          height="200px"
          onBlur={onChange}
        />
      </div>
    </InlineField>
  );
}
