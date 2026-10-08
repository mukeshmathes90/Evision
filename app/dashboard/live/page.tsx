import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getLive } from '@/lib/data';
import { LiveVehicleView } from '@/components/dashboard/views/LiveVehicleView';

export const dynamic = 'force-dynamic';

export default async function LiveVehiclePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams, '1h');
  const envelope = await getLive(device, range);
  return <LiveVehicleView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}