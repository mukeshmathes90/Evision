import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getBattery } from '@/lib/data';
import { BatteryView } from '@/components/dashboard/views/BatteryView';

export const dynamic = 'force-dynamic';

export default async function BatteryPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getBattery(device, range);
  return <BatteryView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}