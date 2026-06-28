/**
 * PipelineEditor component for editing MongoDB aggregation pipelines.
 *
 * Uses Grafana's CodeEditor with JSON language mode for syntax highlighting and
 * registers a Monaco completion provider that suggests field paths (when inferred
 * fields are supplied), the plugin's macros and template variables, and common
 * aggregation pipeline stages.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { InlineField, CodeEditor, Button, type Monaco, type monacoTypes } from '@grafana/ui';

import { FieldInfo } from '../../types';
import { buildFieldCompletions } from './fieldCompletions';
import { buildKeywordCompletions, CompletionCategory } from './keywordCompletions';

/** Props for the PipelineEditor component. */
interface PipelineEditorProps {
  /** The current pipeline JSON string. */
  value: string;
  /** Callback when the pipeline text changes. */
  onChange: (pipeline: string) => void;
  /** Inferred field paths used for autocomplete (hints only). */
  fields?: FieldInfo[];
}

/**
 * PipelineEditor renders a code editor for MongoDB aggregation pipeline JSON.
 */
export function PipelineEditor({ value, onChange, fields = [] }: PipelineEditorProps) {
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
  // Keep the latest fields in a ref so the long-lived completion provider always
  // reads current suggestions without re-registering on every change.
  const fieldsRef = useRef<FieldInfo[]>(fields);
  const providerRef = useRef<monacoTypes.IDisposable | null>(null);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // Dispose the completion provider when the editor unmounts.
  useEffect(() => () => providerRef.current?.dispose(), []);

  const handleFormat = useCallback(() => {
    // Trigger Monaco's built-in format action (same as Alt+Shift+F).
    // It handles our non-standard macros/variables gracefully.
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const handleEditorDidMount = useCallback((editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;

    // Register a JSON completion provider scoped to this editor's model. The
    // provider reads fieldsRef so it always reflects the current collection.
    providerRef.current?.dispose();
    providerRef.current = monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['$', '"', '.'],
      provideCompletionItems: (model, position) => {
        // Scope to this editor only — avoids duplicate suggestions when several
        // pipeline editors share the global Monaco instance.
        if (model !== editorRef.current?.getModel()) {
          return { suggestions: [] };
        }

        // Replace the token under the cursor, including any leading `$` — so
        // `$`-prefixed macros/variables/stages don't double the dollar sign.
        const line = model.getLineContent(position.lineNumber);
        const prefix = line.slice(0, position.column - 1);
        const tokenLen = (prefix.match(/[$A-Za-z0-9_]*$/) ?? [''])[0].length;
        const range: monacoTypes.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - tokenLen,
          endColumn: position.column,
        };

        const fieldSuggestions = buildFieldCompletions(fieldsRef.current).map((c) => ({
          label: c.label,
          kind: monaco.languages.CompletionItemKind.Field,
          detail: c.detail,
          insertText: c.insertText,
          sortText: c.sortText,
          range,
        }));

        const kindFor: Record<CompletionCategory, monacoTypes.languages.CompletionItemKind> = {
          macro: monaco.languages.CompletionItemKind.Function,
          variable: monaco.languages.CompletionItemKind.Variable,
          stage: monaco.languages.CompletionItemKind.Keyword,
        };
        const keywordSuggestions = buildKeywordCompletions().map((c) => ({
          label: c.label,
          kind: kindFor[c.category],
          detail: c.detail,
          documentation: c.documentation,
          insertText: c.insertText,
          insertTextRules: c.snippet
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          sortText: c.sortText,
          range,
        }));

        return { suggestions: [...fieldSuggestions, ...keywordSuggestions] };
      },
    });
  }, []);

  return (
    <InlineField
      label="Pipeline"
      labelWidth={14}
      tooltip="MongoDB aggregation pipeline as a JSON array. Macros: $__timeFilter(field), $__timeFilter_ms(field), $__oidFilter(field), $__timeGroup(field), $__match. Field names autocomplete from the selected collection. See template variable docs for details."
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
