import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getDevicePage, getFleet } from '@/lib/data';
import { databaseHealth } from '@/lib/mongodb';
import { AUTH_ENABLED, MONGODB_COLLECTIONS, MONGODB_DATABASE } from '@/lib/env';
import { THRESHOLDS } from '@/lib/constants';
import { SettingsView } from '@/components/dashboard/views/SettingsView';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device } = parseParams(await searchParams);
  const [deviceEnvelope, fleet, health] = await Promise.all([getDevicePage(device), getFleet(), databaseHealth()]);

  return (
    <SettingsView
      envelope={deviceEnvelope}
      runtime={{
        deviceId: device,
        database: { ...health, name: MONGODB_DATABASE, collections: MONGODB_COLLECTIONS },
        fleet,
        authRequired: AUTH_ENABLED,
        generatedAt: new Date().toISOString(),
        thresholds: THRESHOLDS,
      }}
    />
  );
}