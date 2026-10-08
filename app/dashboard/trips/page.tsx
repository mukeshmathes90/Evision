import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getTrips } from '@/lib/data';
import { TripsView } from '@/components/dashboard/views/TripsView';

export const dynamic = 'force-dynamic';

export default async function TripsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getTrips(device, range);
  return <TripsView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}