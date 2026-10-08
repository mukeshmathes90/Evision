'use client';

import { useLiveData } from '@/hooks/useLiveData';
import { HeroVehicle } from './HeroVehicle';
import type { ApiEnvelope, DataEnvelope, OverviewPayload } from '@/types';

/** Hero visual bound to the live overview endpoint (10 s refresh). */
export function HeroVisualLive({
  initial,
  deviceId,
  pollMs = 10000,
}: {
  initial: ApiEnvelope<OverviewPayload>;
  deviceId: string;
  pollMs?: number;
}) {
  const { data } = useLiveData<ApiEnvelope<OverviewPayload>>(
    `/api/dashboard?device=${encodeURIComponent(deviceId)}&range=24h`,
    initial,
    pollMs,
  );
  const env: DataEnvelope<OverviewPayload> | undefined = data?.envelope;
  return <HeroVehicle latest={env?.data.latest ?? null} battery={env?.data.battery ?? null} />;
}