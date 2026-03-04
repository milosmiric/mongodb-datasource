/**
 * PipelineEditor component for editing MongoDB aggregation pipelines.
 *
 * Uses Grafana's CodeEditor with JSON language mode for syntax highlighting.
 */
import { useCallback, useRef } from 'react';
import { InlineField, CodeEditor, Button, type monacoTypes } from '@grafana/ui';

/** Props for the PipelineEditor component. */
interface PipelineEditorProps {
  /** The current pipeline JSON string. */
  value: string;
  /** Callback when the pipeline text changes. */
  onChange: (pipeline: string) => void;
}

/**
 * Try to pretty-print a pipeline string.
 *
 * The pipeline may contain Grafana template variables ($__from, $__to, etc.)
 * which are not valid JSON, so we temporarily replace them before formatting.
 */
function formatPipeline(raw: string): string {
  const placeholders: Map<string, string> = new Map();
  let idx = 0;

  // Replace template variables with valid JSON placeholders.
  const sanitized = raw.replace(/\$__\w+/g, (match) => {
    const key = `"__PLACEHOLDER_${idx++}__"`;
    placeholders.set(key, match);
    return key;
  });

  try {
    const formatted = JSON.stringify(JSON.parse(sanitized), null, 2);
    // Restore template variables.
    let result = formatted;
    for (const [key, original] of placeholders) {
      result = result.replace(key, original);
    }
    return result;
  } catch {
    // If parsing fails, return the original string unchanged.
    return raw;
  }
}

/**
 * PipelineEditor renders a code editor for MongoDB aggregation pipeline JSON.
 */
export function PipelineEditor({ value, onChange }: PipelineEditorProps) {
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);

  const handleFormat = useCallback(() => {
    const current = editorRef.current?.getValue() ?? value;
    const formatted = formatPipeline(current);
    if (formatted !== current) {
      editorRef.current?.setValue(formatted);
      onChange(formatted);
    }
  }, [value, onChange]);

  const handleEditorDidMount = useCallback((editor: monacoTypes.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  return (
    <InlineField
      label="Pipeline"
      labelWidth={14}
      tooltip="MongoDB aggregation pipeline as a JSON array. $__from and $__to are replaced with epoch milliseconds — wrap them with {$toDate: $__from} to convert to DateTime for $match comparisons."
      grow
    >
      <div data-testid="mongodb-pipeline-editor" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Button variant="secondary" size="sm" icon="brackets-curly" onClick={handleFormat} tooltip="Format JSON">
            Format
          </Button>
        </div>
        <CodeEditor
          value={value}
          language="json"
          showLineNumbers
          showMiniMap={false}
          height="200px"
          onBlur={onChange}
          onEditorDidMount={handleEditorDidMount}
        />
      </div>
    </InlineField>
  );
}
