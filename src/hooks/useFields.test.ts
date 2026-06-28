import { renderHook, waitFor } from '@testing-library/react';
import { of, throwError } from 'rxjs';

import { useFields } from './useFields';
import { DataSource } from '../datasource';
import { FieldInfo } from '../types';

const fetchMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ fetch: fetchMock }),
}));

const datasource = { uid: 'ds-uid' } as DataSource;

const sampleFields: FieldInfo[] = [
  { path: 'sensor', types: ['string'], frequency: 1, indexed: true },
  { path: 'value', types: ['double'], frequency: 0.5, indexed: false },
];

describe('useFields', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('does not fetch when database or collection is empty', () => {
    const { result } = renderHook(() => useFields(datasource, '', ''));
    expect(result.current.fields).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and returns inferred fields', async () => {
    fetchMock.mockReturnValue(of({ data: sampleFields }));
    const { result } = renderHook(() => useFields(datasource, 'demo', 'readings'));

    await waitFor(() => expect(result.current.fields).toHaveLength(2));
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/resources/fields?database=demo&collection=readings'),
        method: 'GET',
      })
    );
  });

  it('caches results across remounts for the same db+collection', async () => {
    fetchMock.mockReturnValue(of({ data: sampleFields }));
    const first = renderHook(() => useFields(datasource, 'demo', 'cached-coll'));
    await waitFor(() => expect(first.result.current.fields).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useFields(datasource, 'demo', 'cached-coll'));
    expect(second.result.current.fields).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from cache, no refetch
  });

  it('surfaces an error and clears fields on failure', async () => {
    fetchMock.mockReturnValue(throwError(() => new Error('boom')));
    const { result } = renderHook(() => useFields(datasource, 'demo', 'err-coll'));

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.fields).toEqual([]);
  });
});
