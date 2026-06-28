/**
 * Hook for fetching inferred field descriptors for a MongoDB collection.
 *
 * Fields are inferred by the backend (from a $jsonSchema validator when present,
 * otherwise by sampling documents) and feed autocomplete in the query editors.
 * Results are treated as hints only and never block a query.
 *
 * @example
 * ```tsx
 * const { fields, loading, error } = useFields(datasource, 'demo', 'readings');
 * ```
 */
import { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { FieldInfo, FieldListResponse } from '../types';
import { DataSource } from '../datasource';

interface UseFieldsResult {
  /** The inferred field descriptors, indexed fields first. */
  fields: FieldInfo[];
  /** Whether the request is in progress. */
  loading: boolean;
  /** Error message if the request failed. */
  error: string | null;
}

/**
 * Per-session cache keyed by datasource + database + collection. Schema inference
 * involves a sampling round-trip, so we avoid re-fetching while the user types.
 */
const fieldsCache = new Map<string, FieldInfo[]>();

const cacheKey = (uid: string, database: string, collection: string) => `${uid}|${database}|${collection}`;

/**
 * useFields fetches inferred field paths for a specific database + collection.
 *
 * @param datasource - The MongoDB datasource instance.
 * @param database - The database name.
 * @param collection - The collection name.
 * @returns An object with fields, loading state, and error.
 */
export function useFields(datasource: DataSource, database: string, collection: string): UseFieldsResult {
  const key = cacheKey(datasource.uid, database, collection);
  const [fields, setFields] = useState<FieldInfo[]>(() => (database && collection ? (fieldsCache.get(key) ?? []) : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!database || !collection) {
      setFields([]);
      return;
    }

    const cached = fieldsCache.get(key);
    if (cached) {
      setFields(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchFields = async () => {
      try {
        const response = await lastValueFrom(
          getBackendSrv().fetch<FieldListResponse>({
            url:
              `/api/datasources/uid/${datasource.uid}/resources/fields` +
              `?database=${encodeURIComponent(database)}&collection=${encodeURIComponent(collection)}`,
            method: 'GET',
          })
        );
        if (!cancelled) {
          const data = response.data ?? [];
          fieldsCache.set(key, data);
          setFields(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to fetch fields';
          setError(message);
          setFields([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchFields();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource.uid, database, collection]);

  return { fields, loading, error };
}
