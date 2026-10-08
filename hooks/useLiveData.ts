'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface LiveState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  refresh: () => void;
  refreshing: boolean;
}

/**
 * Polls a server-side JSON endpoint. Server-rendered data is passed in as
 * `initial` so the first paint never flickers; the hook then keeps the view in
 * sync without ever touching the database credentials.
 */
export function useLiveData<T>(url: string, initial: T | null, intervalMs = 5000, enabled = true): LiveState<T> {
  const [data, setData] = useState<T | null>(initial);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const first = useRef(true);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      if (controller.current) controller.current.abort();
      const ac = new AbortController();
      controller.current = ac;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const json = (await res.json()) as T;
        setData(json);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [url],
  );

  useEffect(() => {
    setData(initial);
    setUpdatedAt(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setInterval(() => load(true), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, load]);

  return {
    data,
    loading,
    refreshing,
    error,
    updatedAt,
    refresh: () => load(true),
  };
}
