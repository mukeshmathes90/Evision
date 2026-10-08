import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { getAlerts, getFleet, sourceFor } from '@/lib/data';
import { EVISION_DEVICE_ID } from '@/lib/env';
import { resolveRange } from '@/lib/time-range';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Control Centre',
  description:
    'Live control centre for EVISION AI: battery, solar, fuel cell, thermal, embedded-AI and alert telemetry streamed from the ESP32-S3 into Firebase Realtime Database.',
};

type SP = Record<string, string | string[] | undefined>;

/**
 * `searchParams` is read from the request so the shell resolves the active
 * device before the first paint. It is typed as optional because Next's typed
 * `LayoutProps` does not declare search params for layouts.
 */
export default async function DashboardLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: Promise<SP>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const requested = typeof sp?.device === 'string' ? sp.device : undefined;
  const deviceId = requested || EVISION_DEVICE_ID;

  const [devices, alertEnvelope] = await Promise.all([
    getFleet(),
    getAlerts(deviceId, resolveRange('24h'), {}).catch(() => null),
  ]);

  const link = alertEnvelope?.link ?? 'unknown';
  const lastSeen = alertEnvelope?.lastSeen ?? null;
  const source = sourceFor(deviceId);

  return (
    <DashboardShell
      devices={devices.map((d) => ({
        deviceId: d.deviceId,
        name: d.name,
        source: d.source,
        status: d.status,
        location: d.location,
        lastSeen: d.lastSeen,
      }))}
      currentDevice={deviceId}
      link={link}
      lastSeen={lastSeen}
      source={source}
      alerts={alertEnvelope?.data.alerts ?? []}
    >
      {children}
    </DashboardShell>
  );
}
