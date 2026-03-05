/**
 * PipelineEditor component for editing MongoDB aggregation pipelines.
 *
 * Uses Grafana's CodeEditor with JSON language mode for syntax highlighting.
 */
import React, { useCallback, useRef } from 'react';
import { InlineField, CodeEditor, Button, type monacoTypes } from '@grafana/ui';

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
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);

  const handleFormat = useCallback(() => {
    // Trigger Monaco's built-in format action (same as Alt+Shift+F).
    // It handles our non-standard macros/variables gracefully.
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const handleEditorDidMount = useCallback((editor: monacoTypes.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  return (
    <InlineField
      label="Pipeline"
      labelWidth={14}
      tooltip="MongoDB aggregation pipeline as a JSON array. Macros: $__timeFilter(field), $__timeFilter_ms(field), $__oidFilter(field), $__timeGroup(field), $__match. See template variable docs for details."
      grow
    >
      <div data-testid="mongodb-pipeline-editor" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 4 }}>
          <Button
            variant="secondary"
            size="sm"
            icon="question-circle"
            tooltip="View variable & macro reference"
            onClick={() => window.open('https://github.com/milosmiric/mongodb-datasource/blob/main/docs/template-variables.md', '_blank')}
          >
            Help
          </Button>
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
