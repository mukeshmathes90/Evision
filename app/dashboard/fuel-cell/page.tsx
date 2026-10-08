import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getChannelPage } from '@/lib/data';
import { ChannelView } from '@/components/dashboard/views/ChannelView';

export const dynamic = 'force-dynamic';

export default async function FuelCellPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getChannelPage(device, 'fuelCell', range);
  return <ChannelView channel="fuelCell" initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}