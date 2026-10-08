import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getThermal } from '@/lib/data';
import { ThermalView } from '@/components/dashboard/views/ThermalView';

export const dynamic = 'force-dynamic';

export default async function ThermalPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getThermal(device, range);
  return <ThermalView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}