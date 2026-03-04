/**
 * Hook for fetching the list of MongoDB databases from the backend.
 *
 * @example
 * ```tsx
 * const { databases, loading, error } = useDatabases(datasource);
 * ```
 */
import { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { DatabaseListResponse } from '../types';
import { DataSource } from '../datasource';

interface UseDatabasesResult {
  /** The list of database names. */
  databases: string[];
  /** Whether the request is in progress. */
  loading: boolean;
  /** Error message if the request failed. */
  error: string | null;
}

/**
 * useDatabases fetches the list of databases from the MongoDB backend.
 *
 * @param datasource - The MongoDB datasource instance.
 * @returns An object with databases, loading state, and error.
 */
export function useDatabases(datasource: DataSource): UseDatabasesResult {
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchDatabases = async () => {
      try {
        const response = await lastValueFrom(
          getBackendSrv().fetch<DatabaseListResponse>({
            url: `/api/datasources/uid/${datasource.uid}/resources/databases`,
            method: 'GET',
          })
        );
        if (!cancelled) {
          setDatabases(response.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to fetch databases';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDatabases();

    return () => {
      cancelled = true;
    };
  }, [datasource.uid]);

  return { databases, loading, error };
}
