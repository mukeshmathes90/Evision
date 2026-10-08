import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getAnalytics } from '@/lib/data';
import { AnalyticsView } from '@/components/dashboard/views/AnalyticsView';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getAnalytics(device, range, range.bucketMs);
  return <AnalyticsView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}