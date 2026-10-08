import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getOverview } from '@/lib/data';
import { OverviewView } from '@/components/dashboard/views/OverviewView';

export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getOverview(device, range);
  return <OverviewView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}