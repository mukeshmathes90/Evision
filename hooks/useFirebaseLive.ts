'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { discoverLayout, fetchFrames, FIREBASE_RTDB_URL, framesToSeries, pickLatest } from '@/lib/firebase-core';
import { batteryStatsFromPoints, deriveBattery, statsFromPoints } from '@/lib/stats';
import { linkStateFromAge } from '@/lib/format';
import type { ApiEnvelope, LinkState, LivePayload, TelemetryReading, TimeRange } from '@/types';

/**
 * Live payload that mirrors the shape served by `/api/live`, built entirely
 * in the browser from Firebase Realtime Database. The browser subscribes to
 * the RTDB streaming endpoint (SSE) so new frames push an update without a
 * page refresh; a polling fallback keeps the dashboard alive when SSE is
 * unavailable. Nothing is ever fabricated here.
 */

const ONLINE_WINDOW_S = 10;
const DELAYED_WINDOW_S = 30;
const NO_DATA_MSG = 'Waiting for telemetry…';
const OFFLINE_MSG = 'Device offline — the last known sample is shown.';

export interface FirebaseLiveState {
  payload: ApiEnvelope<LivePayload>;
  updatedAt: number | null;
  refreshing: boolean;
  error: string | null;
  transport: 'sse' | 'poll' | null;
  refresh: () => void;
}

function buildPayload(
  frames: TelemetryReading[],
  deviceId: string,
  range: TimeRange,
  prior: ApiEnvelope<LivePayload>,
): ApiEnvelope<LivePayload> {
  const latest = pickLatest(frames);
  const pts = framesToSeries(frames, range.from, range.to, 120);
  const lastSeen = latest?.timestamp ?? null;
  const age = lastSeen ? (Date.now() - Date.parse(lastSeen)) / 1000 : null;
  const link = linkStateFromAge(age, ONLINE_WINDOW_S, DELAYED_WINDOW_S) as LinkState;
  const empty = latest ? null : link === 'offline' ? OFFLINE_MSG : NO_DATA_MSG;
  const payload: LivePayload = {
    latest,
    battery: latest ? deriveBattery(latest) : null,
    points: pts,
    link,
    stats: {
      solar: statsFromPoints(pts, 'solar'),
      fuelCell: statsFromPoints(pts, 'fuelCell'),
      vehicle: statsFromPoints(pts, 'vehicle'),
      battery: batteryStatsFromPoints(pts),
    },
  };
  const base = prior?.envelope;
  return {
    ok: true,
    range,
    envelope: {
      source: 'live',
      deviceId: base?.deviceId ?? deviceId,
      deviceLabel: base?.deviceLabel ?? 'LIVE DEVICE',
      generatedAt: new Date().toISOString(),
      link,
      lastSeen,
      empty,
      data: payload,
    },
  };
}

export function useFirebaseLive(
  deviceId: string,
  range: TimeRange,
  initial: ApiEnvelope<LivePayload>,
  enabled = true,
): FirebaseLiveState {
  const [payload, setPayload] = useState<ApiEnvelope<LivePayload>>(initial);
  const [updatedAt, setUpdatedAt] = useState<number | null>(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<'sse' | 'poll' | null>(null);
  const priorRef = useRef(initial);
  priorRef.current = initial;

  const push = useCallback(
    async (force: boolean) => {
      try {
        const frames = await fetchFrames(deviceId, { force });
        const built = buildPayload(frames, deviceId, range, priorRef.current);
        setPayload(built);
        setUpdatedAt(Date.now());
        setError(null);
        setRefreshing(false);
      } catch (err) {
        setError((err as Error).message);
        setRefreshing(false);
      }
    },
    [deviceId, range],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    return push(true);
  }, [push]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let failures = 0;

    const startPolling = () => {
      if (poll) return;
      setTransport('poll');
      poll = setInterval(() => {
        void push(true);
      }, 3000);
    };

    void (async () => {
      let root: string | null = null;
      try {
        const layout = await discoverLayout(deviceId);
        root = layout.root;
      } catch {
        root = null;
      }
      if (disposed) return;

      if (root && typeof EventSource !== 'undefined') {
        try {
          es = new EventSource(`${FIREBASE_RTDB_URL}/${root.replace(/^\/+/, '')}.json`);
          const onEvent = () => {
            void push(true);
          };
          es.addEventListener('put', onEvent);
          es.addEventListener('patch', onEvent);
          es.onopen = () => {
            failures = 0;
            setTransport('sse');
          };
          es.onerror = () => {
            failures += 1;
            if (failures >= 6) {
              es?.close();
              es = null;
              startPolling();
            }
          };
        } catch {
          startPolling();
        }
      } else {
        startPolling();
      }
    })();

    return () => {
      disposed = true;
      es?.close();
      es = null;
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    };
  }, [enabled, deviceId, range, push]);

  return { payload, updatedAt, refreshing, error, transport, refresh };
}