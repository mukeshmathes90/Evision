import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getAnalytics } from '@/lib/data';
import { ReportsView } from '@/components/dashboard/views/ReportsView';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getAnalytics(device, range, range.bucketMs);
  return <ReportsView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}