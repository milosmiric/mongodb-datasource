/**
 * Pure helpers for building Monaco field-name completions from inferred fields.
 *
 * Kept free of Monaco imports so the ranking/labelling logic can be unit-tested
 * directly; the editor maps these descriptors onto Monaco CompletionItems.
 */
import { FieldInfo } from '../../types';

/** A Monaco-agnostic description of a single field completion. */
export interface FieldCompletion {
  /** The field path shown and inserted. */
  label: string;
  /** Secondary text (types and an indexed marker). */
  detail: string;
  /** Text inserted when the completion is accepted. */
  insertText: string;
  /** Opaque sort key — indexed fields and more frequent fields rank first. */
  sortText: string;
}

/**
 * buildFieldCompletions converts inferred fields into completion descriptors,
 * preserving the backend's ordering (indexed first, then by frequency) via a
 * stable, zero-padded sortText.
 *
 * @param fields - Inferred field descriptors from the `/fields` endpoint.
 * @returns Completion descriptors ready to map onto Monaco CompletionItems.
 */
export function buildFieldCompletions(fields: FieldInfo[]): FieldCompletion[] {
  return fields.map((field, index) => {
    const typeLabel = field.types.length > 0 ? field.types.join(' | ') : 'field';
    const detail = field.indexed ? `${typeLabel} · indexed` : typeLabel;
    return {
      label: field.path,
      detail,
      insertText: field.path,
      // Indexed group ('0') sorts before non-indexed ('1'); the padded index
      // preserves the backend's frequency ordering within each group.
      sortText: `${field.indexed ? '0' : '1'}${String(index).padStart(5, '0')}`,
    };
  });
}
