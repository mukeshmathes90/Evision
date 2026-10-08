import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getEnergy } from '@/lib/data';
import { EnergyView } from '@/components/dashboard/views/EnergyView';

export const dynamic = 'force-dynamic';

export default async function EnergyPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getEnergy(device, range, range.bucketMs);
  return <EnergyView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}