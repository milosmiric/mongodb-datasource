/**
 * Hook for fetching the list of MongoDB collections for a given database.
 *
 * @example
 * ```tsx
 * const { collections, loading, error } = useCollections(datasource, 'mydb');
 * ```
 */
import { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { CollectionListResponse } from '../types';
import { DataSource } from '../datasource';

interface UseCollectionsResult {
  /** The list of collection names. */
  collections: string[];
  /** Whether the request is in progress. */
  loading: boolean;
  /** Error message if the request failed. */
  error: string | null;
}

/**
 * useCollections fetches the list of collections for a specific database.
 *
 * @param datasource - The MongoDB datasource instance.
 * @param database - The database name to list collections for.
 * @returns An object with collections, loading state, and error.
 */
export function useCollections(datasource: DataSource, database: string): UseCollectionsResult {
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!database) {
      setCollections([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchCollections = async () => {
      try {
        const response = await lastValueFrom(
          getBackendSrv().fetch<CollectionListResponse>({
            url: `/api/datasources/uid/${datasource.uid}/resources/collections?database=${encodeURIComponent(database)}`,
            method: 'GET',
          })
        );
        if (!cancelled) {
          setCollections(response.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to fetch collections';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCollections();

    return () => {
      cancelled = true;
    };
  }, [datasource.uid, database]);

  return { collections, loading, error };
}
