import type { Metadata } from 'next';
import { VehicleShowcase } from '@/components/vehicle/VehicleShowcase';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { activeDeviceId, getOverview } from '@/lib/data';
import { resolveRange } from '@/lib/time-range';
import { PRODUCT } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `View my car · ${PRODUCT.name}`,
  description:
    'Interactive EV visualisation driven by live telemetry: tap the PV array, hydrogen fuel cell, battery pack, traction motor, thermal probes or the AI core to inspect the newest frame.',
  alternates: { canonical: '/vehicle' },
};

export default async function VehiclePage() {
  const deviceId = activeDeviceId();
  const range = resolveRange('1h');
  const envelope = await getOverview(deviceId, range);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <PublicNav />
      <main className="pt-16">
        <VehicleShowcase initial={{ ok: true, envelope, range }} deviceId={deviceId} />
      </main>
      <Footer />
    </div>
  );
}