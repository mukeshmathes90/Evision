import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getDevicePage, getFleet } from '@/lib/data';
import { firebaseHealth } from '@/lib/firebase';
import { AUTH_ENABLED } from '@/lib/env';
import { FIREBASE_PROJECT_ID } from '@/lib/firebase-core';
import { THRESHOLDS } from '@/lib/constants';
import { SettingsView } from '@/components/dashboard/views/SettingsView';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device } = parseParams(await searchParams);
  const [deviceEnvelope, fleet, health] = await Promise.all([getDevicePage(device), getFleet(), firebaseHealth()]);

  return (
    <SettingsView
      envelope={deviceEnvelope}
      runtime={{
        deviceId: device,
        database: { ...health, name: FIREBASE_PROJECT_ID, collections: {} },
        fleet,
        authRequired: AUTH_ENABLED,
        generatedAt: new Date().toISOString(),
        thresholds: THRESHOLDS,
      }}
    />
  );
}