import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getTelemetryPage } from '@/lib/data';
import { DataView } from '@/components/dashboard/views/DataView';

export const dynamic = 'force-dynamic';

export default async function DataPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getTelemetryPage(device, range, { page: 1, pageSize: 25 });
  return <DataView initial={envelope} deviceId={device} range={range} />;
}